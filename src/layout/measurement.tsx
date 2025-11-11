import React, { useCallback, useEffect, useRef } from 'react';

import type { MeasurementEntry, MeasurementRecord } from './types';
import { MEASUREMENT_THROTTLE_MS, regionKey } from './utils';
import { isDebugEnabled } from './debugFlags';

/**
 * Measurement semantics
 *
 * Each entry in the measurement layer renders the full component at its canonical scale inside an
 * offscreen wrapper. We measure `node.getBoundingClientRect().height`, which returns the distance in
 * CSS pixels from the top border edge to the bottom border edge of the component’s margin box within
 * the measurement layer. Because the layer sits at the origin (0,0) and is not transformed, the
 * rect’s `height` corresponds to the true block height of the component as if it were placed at
 * (top-left) inside the unscaled statblock column.
 *
 * We do not track the component’s bottom-left absolute coordinates; pagination consumes these
 * heights as scalar magnitudes. The layout engine starts each region at `yOffset = 0` (top of the
 * column) and increments by `estimatedHeight + COMPONENT_VERTICAL_SPACING_PX` after placing each
 * component. This matches the top-down flow we get by measuring from the top-left reference frame.
 */
const shouldLogMeasurements = (): boolean => isDebugEnabled('measurement-spellcasting');
const MEASUREMENT_EPSILON = 0.25;

type MeasurementLoopEvent = 'attach' | 'detach';
type MeasurementEventType = MeasurementLoopEvent | 'measure' | 'enqueue' | 'resize' | 'raf';

interface MeasurementLoopHistory {
    events: Array<{ type: MeasurementLoopEvent; timestamp: number }>;
    firstAttachLogged: boolean;
    firstDetachLogged: boolean;
    loopNotifiedAt: number | null;
}

interface MeasurementHeightHistory {
    lastHeight: number;
    lastLoggedAt: number;
}

const LOOP_DETECTION_WINDOW_MS = 1500;
const LOOP_ALERT_THRESHOLD = 3;
const HEIGHT_LOG_EPSILON = 0.75;
const HEIGHT_LOG_COOLDOWN_MS = 1500;

const measurementLoopHistory = new Map<string, MeasurementLoopHistory>();
const measurementHeightHistory = new Map<string, MeasurementHeightHistory>();

interface LoopEvaluationResult {
    shouldLog: boolean;
    reason?: 'first-attach' | 'first-detach' | 'loop-detected';
    meta?: Record<string, unknown>;
}

interface HeightEvaluationResult {
    shouldLog: boolean;
    reason?: 'first-measurement' | 'height-change' | 'delete';
}

const evaluateLoopEvent = (key: string, type: MeasurementLoopEvent): LoopEvaluationResult => {
    const now = Date.now();
    let history = measurementLoopHistory.get(key);

    if (!history) {
        history = {
            events: [],
            firstAttachLogged: false,
            firstDetachLogged: false,
            loopNotifiedAt: null,
        };
        measurementLoopHistory.set(key, history);
    }

    history.events.push({ type, timestamp: now });
    const windowStart = now - LOOP_DETECTION_WINDOW_MS;
    history.events = history.events.filter((event) => event.timestamp >= windowStart);

    let shouldLog = false;
    let reason: LoopEvaluationResult['reason'];
    let meta: LoopEvaluationResult['meta'];

    if (type === 'attach' && !history.firstAttachLogged) {
        shouldLog = true;
        reason = 'first-attach';
        history.firstAttachLogged = true;
    } else if (type === 'detach' && !history.firstDetachLogged) {
        shouldLog = true;
        reason = 'first-detach';
        history.firstDetachLogged = true;
    }

    const attachCount = history.events.filter((event) => event.type === 'attach').length;
    const detachCount = history.events.filter((event) => event.type === 'detach').length;
    const transitions = history.events.reduce((count, event, index, arr) => {
        if (index === 0) {
            return count;
        }
        return count + (arr[index - 1].type !== event.type ? 1 : 0);
    }, 0);

    if (attachCount >= LOOP_ALERT_THRESHOLD && detachCount >= LOOP_ALERT_THRESHOLD && transitions >= (LOOP_ALERT_THRESHOLD * 2 - 1)) {
        const shouldNotify = !history.loopNotifiedAt || now - history.loopNotifiedAt > LOOP_DETECTION_WINDOW_MS;
        if (shouldNotify) {
            shouldLog = true;
            reason = 'loop-detected';
            meta = {
                attachCount,
                detachCount,
                transitions,
                windowMs: LOOP_DETECTION_WINDOW_MS,
            };
            history.loopNotifiedAt = now;
        }
    }

    if (history.loopNotifiedAt && now - history.loopNotifiedAt > LOOP_DETECTION_WINDOW_MS * 2) {
        history.loopNotifiedAt = null;
        history.firstAttachLogged = false;
        history.firstDetachLogged = false;
    }

    return { shouldLog, reason, meta };
};

const evaluateHeightEvent = (key: string, height: number | null): HeightEvaluationResult => {
    const now = Date.now();

    if (height == null) {
        measurementHeightHistory.delete(key);
        return { shouldLog: true, reason: 'delete' };
    }

    const previous = measurementHeightHistory.get(key);
    if (!previous) {
        measurementHeightHistory.set(key, { lastHeight: height, lastLoggedAt: now });
        return { shouldLog: true, reason: 'first-measurement' };
    }

    if (Math.abs(previous.lastHeight - height) > HEIGHT_LOG_EPSILON || now - previous.lastLoggedAt >= HEIGHT_LOG_COOLDOWN_MS) {
        measurementHeightHistory.set(key, { lastHeight: height, lastLoggedAt: now });
        return { shouldLog: true, reason: 'height-change' };
    }

    return { shouldLog: false };
};

const shouldLogAncillaryEvent = (key: string): boolean => {
    const history = measurementLoopHistory.get(key);
    if (!history) {
        return false;
    }
    if (!history.loopNotifiedAt) {
        return false;
    }
    return Date.now() - history.loopNotifiedAt <= LOOP_DETECTION_WINDOW_MS * 2;
};

type SpellcastingEventPayload = Record<string, unknown> & { height?: number | null };

const logSpellcastingEvent = (
    key: string,
    type: MeasurementEventType,
    emoji: string,
    label: string,
    payload: SpellcastingEventPayload = {},
    { force = false }: { force?: boolean } = {}
): void => {
    if (!shouldLogMeasurements() || !isSpellcastingMeasurementKey(key)) {
        return;
    }

    let shouldLog = force;
    let reason: LoopEvaluationResult['reason'] | HeightEvaluationResult['reason'];
    let meta: Record<string, unknown> | undefined;

    if (!shouldLog) {
        if (type === 'attach' || type === 'detach') {
            const result = evaluateLoopEvent(key, type);
            shouldLog = result.shouldLog;
            reason = result.reason;
            meta = result.meta;
        } else if (type === 'measure' || type === 'enqueue') {
            const result = evaluateHeightEvent(key, typeof payload.height === 'number' ? payload.height : null);
            shouldLog = result.shouldLog;
            reason = result.reason;
        } else if (type === 'resize' || type === 'raf') {
            shouldLog = shouldLogAncillaryEvent(key);
        }
    }

    if (!shouldLog) {
        return;
    }

    console.log(`${emoji} [Measurement][Spellcasting] ${label}`, {
        key,
        ...payload,
        ...(reason ? { reason } : {}),
        ...(meta ? { meta } : {}),
    });
};

type MeasurementDispatcher = (updates: MeasurementRecord[]) => void;

/**
 * Extended measurement record that can signal deletion.
 * When deleted=true, the reducer should remove the measurement key entirely.
 */
interface InternalMeasurementRecord extends MeasurementRecord {
    deleted?: boolean;
}

const scheduleFlush = (
    flush: () => void,
    idleHandle: React.MutableRefObject<number | null>
) => {
    if (typeof window === 'undefined') {
        idleHandle.current = setTimeout(() => {
            idleHandle.current = null;
            flush();
        }, MEASUREMENT_THROTTLE_MS) as unknown as number;
        return;
    }

    if (typeof window.requestIdleCallback === 'function') {
        idleHandle.current = window.requestIdleCallback(() => {
            idleHandle.current = null;
            flush();
        });
        return;
    }

    idleHandle.current = window.setTimeout(() => {
        idleHandle.current = null;
        flush();
    }, MEASUREMENT_THROTTLE_MS);
};

const SPELLCASTING_MEASUREMENT_TAG = 'spellcasting-block';
const SPELLCASTING_REGION_KIND = ':spell-list';
const DEBUG_COMPONENT_IDS = ['component-12'];

const isSpellcastingMeasurementKey = (key: string): boolean =>
    key.includes(SPELLCASTING_MEASUREMENT_TAG) ||
    key.includes(SPELLCASTING_REGION_KIND) ||
    DEBUG_COMPONENT_IDS.some((id) => key.includes(id));

export const useIdleMeasurementDispatcher = (
    dispatch: (entries: MeasurementRecord[]) => void
): ((key: string, height: number | null) => void) => {
    const pending = useRef(new Map<string, InternalMeasurementRecord>());
    const idleHandle = useRef<number | null>(null);

    const flush = useCallback(() => {
        if (pending.current.size === 0) {
            return;
        }
        const entries = Array.from(pending.current.values());
        pending.current.clear();

        // Filter and separate deletions from measurements
        const deletions: MeasurementRecord[] = [];
        const measurements: MeasurementRecord[] = [];

        entries.forEach((entry) => {
            if (entry.deleted) {
                deletions.push({ key: entry.key, height: 0, measuredAt: entry.measuredAt });
            } else if (entry.height > MEASUREMENT_EPSILON) {
                measurements.push(entry);
            }
        });

        const combined = [...deletions, ...measurements];
        if (combined.length === 0) {
            return;
        }

        if (shouldLogMeasurements()) {
            const deletedKeys = new Set(deletions.map(({ key }) => key));
            const targeted = combined.filter((entry) => isSpellcastingMeasurementKey(entry.key));
            if (targeted.length > 0) {
                console.log('🧮 [Measurement][Spellcasting] dispatcher summary', {
                    pendingCount: combined.length,
                    entries: targeted.map((entry) => ({
                        key: entry.key,
                        height: entry.height,
                        deleted: deletedKeys.has(entry.key),
                        measuredAt: entry.measuredAt,
                    })),
                });
            }
        }

        dispatch(combined);
    }, [dispatch]);

    return useCallback(
        (key: string, height: number | null) => {
            const measuredAt = Date.now();

            logSpellcastingEvent(key, 'enqueue', '📥', 'enqueue', {
                height,
                measuredAt,
                isDeletion: height === null || height <= 0,
            });

            // null height signals deletion
            if (height === null || height <= 0) {
                pending.current.set(key, { key, height: 0, measuredAt, deleted: true });
            } else {
                const previous = pending.current.get(key);
                if (previous && !previous.deleted && Math.abs(previous.height - height) < MEASUREMENT_EPSILON) {
                    return;
                }
                pending.current.set(key, { key, height, measuredAt, deleted: false });
            }

            if (idleHandle.current != null) {
                return;
            }

            scheduleFlush(() => {
                flush();
            }, idleHandle);
        },
        [flush]
    );
};

/**
 * Phase 1: Coordinator for managing measurement locks across multiple observers
 * Provides a central interface for components to lock/unlock their measurements
 */
export class MeasurementCoordinator {
    private observers: Map<string, MeasurementObserver> = new Map();

    registerObserver(key: string, observer: MeasurementObserver): void {
        this.observers.set(key, observer);
    }

    unregisterObserver(key: string): void {
        this.observers.delete(key);
    }

    lockComponent(componentId: string): void {
        // Lock all observers that match this component ID pattern
        // Component IDs like "action-section" should lock observers with keys starting with that pattern
        this.observers.forEach((observer, key) => {
            if (key.includes(componentId)) {
                observer.lock();
            }
        });

        if (shouldLogMeasurements()) {
            console.log('🔒 [Measurement][Spellcasting] lock', {
                componentId,
            });
        }
    }

    unlockComponent(componentId: string): void {
        // Unlock all observers that match this component ID pattern
        this.observers.forEach((observer, key) => {
            if (key.includes(componentId)) {
                observer.unlock();
            }
        });

        if (shouldLogMeasurements()) {
            console.log('🔓 [Measurement][Spellcasting] unlock', {
                componentId,
            });
        }
    }
}

/**
 * Encapsulates DOM observation for a single measurement entry.
 * Manages ResizeObserver, requestAnimationFrame, and image load listeners.
 */
class MeasurementObserver {
    private observer: ResizeObserver | null = null;
    private rafHandle: number | null = null;
    private imageCleanup: (() => void) | null = null;
    private hasLogged = false; // Track if we've logged this component

    // Phase 1: Dynamic Component Locking
    private isLocked: boolean = false;
    private pendingMeasurement: number | null = null;

    constructor(
        private key: string,
        private node: HTMLDivElement,
        private onMeasure: (key: string, height: number) => void
    ) { }

    /**
     * Lock this observer - measurements will be stored but not dispatched
     * Used during component editing to prevent layout thrashing
     */
    lock(): void {
        this.isLocked = true;

        if (process.env.NODE_ENV !== 'production' && isSpellcastingMeasurementKey(this.key)) {
            console.log('🔒 [Measurement][Spellcasting] lock', {
                key: this.key,
            });
        }
    }

    /**
     * Unlock this observer - dispatch any pending measurement
     * Called after editing completes to trigger layout update
     */
    unlock(): void {
        this.isLocked = false;

        if (process.env.NODE_ENV !== 'production' && isSpellcastingMeasurementKey(this.key)) {
            console.log('🔓 [Measurement][Spellcasting] unlock', {
                key: this.key,
                hasPendingMeasurement: this.pendingMeasurement != null,
            });
        }

        // Dispatch pending measurement if it changed while locked
        if (this.pendingMeasurement !== null) {
            this.onMeasure(this.key, this.pendingMeasurement);
            this.pendingMeasurement = null;
        }
    }

    attach(): void {
        this.measure();
        this.attachImageListeners();
        this.attachResizeObserver();
    }

    detach(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.rafHandle !== null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.rafHandle);
            }
            this.rafHandle = null;
        }

        if (this.imageCleanup) {
            this.imageCleanup();
            this.imageCleanup = null;
        }
    }

    private measure = (): void => {
        const rect = this.node.getBoundingClientRect();
        const height = rect.height > 0 ? rect.height : 0;

        const computed = typeof window !== 'undefined' ? window.getComputedStyle(this.node) : null;
        logSpellcastingEvent(this.key, 'measure', '📏', 'measure', {
            height,
            offsetHeight: this.node.offsetHeight,
            scrollHeight: this.node.scrollHeight,
            clientHeight: this.node.clientHeight,
            className: this.node.className,
            isLocked: this.isLocked,
            pendingMeasurement: this.pendingMeasurement,
            display: computed?.display,
            position: computed?.position,
            flexGrow: computed?.flexGrow,
            flexShrink: computed?.flexShrink,
        });

        // Warn about abnormally large measurements (>4000px)
        if (process.env.NODE_ENV !== 'production' && height > 4000) {
            const computed = window.getComputedStyle(this.node);
            console.warn('[MeasurementObserver] ⚠️ ABNORMAL HEIGHT:', {
                key: this.key,
                height,
                likelyCauses: {
                    hasHeightPercent: computed.height.includes('%'),
                    hasFlexGrow: computed.flexGrow !== '0',
                },
            });
        }

        // Phase 1: Check lock state before dispatching
        if (this.isLocked) {
            // Store but don't dispatch yet
            this.pendingMeasurement = height;
        } else {
            // Dispatch immediately
            this.onMeasure(this.key, height);
        }
    };

    private attachResizeObserver(): void {
        if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') {
            return;
        }

        this.observer = new window.ResizeObserver(() => {
            logSpellcastingEvent(this.key, 'resize', '🔁', 'resize observed');
            this.scheduleRAF();
        });
        this.observer.observe(this.node);
    }

    private attachImageListeners(): void {
        const images = Array.from(this.node.querySelectorAll('img'));
        if (images.length === 0) {
            return;
        }

        const handleImageEvent = () => {
            this.scheduleRAF();
        };

        images.forEach((img) => {
            img.addEventListener('load', handleImageEvent);
            img.addEventListener('error', handleImageEvent);
            if (img.complete && img.naturalHeight > 0) {
                handleImageEvent();
            }
        });

        this.imageCleanup = () => {
            images.forEach((img) => {
                img.removeEventListener('load', handleImageEvent);
                img.removeEventListener('error', handleImageEvent);
            });

            if (shouldLogMeasurements() && isSpellcastingMeasurementKey(this.key)) {
                console.log('🧹 [Measurement][Spellcasting] image listeners cleaned', {
                    key: this.key,
                });
            }
        };
    }

    private scheduleRAF(): void {
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
            setTimeout(() => {
                this.measure();
            }, MEASUREMENT_THROTTLE_MS);
            return;
        }

        if (this.rafHandle !== null) {
            return; // Already scheduled
        }

        this.rafHandle = window.requestAnimationFrame(() => {
            this.rafHandle = null;
            this.measure();
        });
        logSpellcastingEvent(this.key, 'raf', '🎯', 'raf scheduled');
    }
}

export const createMeasurementEntry = (overrides: Partial<MeasurementEntry> = {}): MeasurementEntry => ({
    instance: {
        id: 'mock-component',
        type: 'trait-list',
        dataRef: { type: 'statblock', path: 'specialAbilities' },
        layout: { isVisible: true },
    } as MeasurementEntry['instance'],
    slotIndex: 0,
    orderIndex: 0,
    sourceRegionKey: '1:1',
    region: { page: 1, column: 1 },
    homeRegion: { page: 1, column: 1 },
    homeRegionKey: regionKey(1, 1),
    estimatedHeight: 100,
    measurementKey: 'mock-component:block',
    needsMeasurement: true,
    ...overrides,
});

export interface MeasurementLayerProps {
    entries: MeasurementEntry[];
    renderComponent: (entry: MeasurementEntry) => React.ReactNode;
    onMeasurements: MeasurementDispatcher;
    coordinator?: MeasurementCoordinator; // Phase 1: Optional coordinator for locking
}

export const MeasurementLayer: React.FC<MeasurementLayerProps> = ({ entries, renderComponent, onMeasurements, coordinator }) => {
    const dispatcher = useIdleMeasurementDispatcher((updates) => {
        onMeasurements(updates);
    });

    const observers = useRef(new Map<string, MeasurementObserver>());

    const handleRef = useCallback(
        (entry: MeasurementEntry) => (node: HTMLDivElement | null) => {
            const key = entry.measurementKey;
            const existingObserver = observers.current.get(key);

            if (!node) {
                if (existingObserver) {
                    logSpellcastingEvent(key, 'detach', '👋', 'detach');
                    existingObserver.detach();
                    observers.current.delete(key);
                    coordinator?.unregisterObserver(key);
                    dispatcher(key, null);
                }
                return;
            }

            if (existingObserver) {
                return;
            }

            if (isSpellcastingMeasurementKey(key) || DEBUG_COMPONENT_IDS.includes(entry.instance.id)) {
                logSpellcastingEvent(key, 'attach', '➕', 'attach', {
                    entryId: entry.instance.id,
                    slotIndex: entry.slotIndex,
                    orderIndex: entry.orderIndex,
                    regionContentKind: entry.regionContent?.kind,
                }, { force: DEBUG_COMPONENT_IDS.includes(entry.instance.id) && !isSpellcastingMeasurementKey(key) });
            }

            const observer = new MeasurementObserver(key, node, dispatcher);
            observer.attach();
            observers.current.set(key, observer);

            coordinator?.registerObserver(key, observer);
        },
        [dispatcher, coordinator]
    );

    useEffect(() => () => {
        observers.current.forEach((observer, key) => {
            logSpellcastingEvent(key, 'detach', '🧨', 'cleanup', {}, { force: true });
            observer.detach();
            coordinator?.unregisterObserver(key);
        });
        observers.current.clear();
    }, [coordinator]);

    return (
        <>
            {entries.map((entry) => (
                <div
                    key={entry.measurementKey}
                    ref={handleRef(entry)}
                    className="dm-measurement-entry"
                    data-measurement-key={entry.measurementKey}
                    style={{
                        // CRITICAL: Render in flex context to match visible layout
                        // Parent container is already positioned offscreen, so no need for absolute positioning
                        // Let column width naturally constrain - DO NOT use template slotDimensions.widthPx
                        // as it may not match actual rendered column width, causing incorrect text wrapping
                        width: 'auto',
                        // Natural height - let content determine height
                        // Infinite expansion is detected via computed style checks (flexGrow, height: 100%)
                        height: 'auto',
                        minHeight: 0,
                        // Prevent flex/grid expansion
                        flexShrink: 0,
                        flexGrow: 0,
                        overflow: 'hidden', // Prevent visual bleed during measurement
                        transform: 'none',
                    }}
                >
                    {renderComponent(entry)}
                </div>
            ))}
        </>
    );
};


