import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import type { MeasurementEntry, MeasurementRecord } from './types';
import { MEASUREMENT_THROTTLE_MS, regionKey } from './utils';
import { isDebugEnabled } from './debugFlags';
import { isComponentDebugEnabled, normalizeComponentId } from './paginate';

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
// Resize/raf logs are very verbose - only log when measurement flag is enabled AND loop detected
const SUPPRESS_ANCILLARY_LOGS_BY_DEFAULT = true;

const measurementLoopHistory = new Map<string, MeasurementLoopHistory>();
const measurementHeightHistory = new Map<string, MeasurementHeightHistory>();

const buildMeasurementEntriesSignature = (entries: MeasurementEntry[]): string => {
    if (entries.length === 0) {
        return 'empty';
    }
    return entries
        .map((entry) => {
            const region = entry.region;
            return [
                entry.measurementKey,
                entry.instance.id,
                entry.slotIndex,
                entry.orderIndex,
                region?.page ?? 'x',
                region?.column ?? 'x',
                entry.homeRegionKey ?? 'none',
                entry.regionContent?.kind ?? 'none',
            ].join(':');
        })
        .join('|');
};

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
    if (!shouldLogMeasurements()) {
        return;
    }

    // Extract component ID and check if it's debug-enabled
    const componentId = extractComponentId(key);
    const isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;

    // Only log if component is debug-enabled (spellcasting measurements also require component filtering)
    if (!isDebugComponent) {
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
            // Resize/raf logs are very verbose - only log when explicitly enabled AND loop detected
            // This prevents excessive logging when measurement flag is off
            shouldLog = shouldLogAncillaryEvent(key) && !SUPPRESS_ANCILLARY_LOGS_BY_DEFAULT;
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

/**
 * Extract component ID from measurement key
 * Format: "component-X:block" or "component-X:spell-list:..." or "component-X:..."
 */
const extractComponentId = (key: string): string | null => {
    const match = key.match(/^(component-\d+):/);
    return match ? match[1] : null;
};

const isSpellcastingMeasurementKey = (key: string): boolean =>
    key.includes(SPELLCASTING_MEASUREMENT_TAG) ||
    key.includes(SPELLCASTING_REGION_KIND);

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
                // Use negative height to signal explicit deletion
                deletions.push({ key: entry.key, height: -1, measuredAt: entry.measuredAt });
            } else {
                // Include zero-height measurements (e.g., metadata blocks) as present
                measurements.push(entry);
            }
        });

        const combined = [...deletions, ...measurements];
        if (combined.length === 0) {
            return;
        }

        if (shouldLogMeasurements()) {
            const deletedKeys = new Set(deletions.map(({ key }) => key));
            // Filter to debug-enabled components only
            const targeted = combined.filter((entry) => {
                const componentId = extractComponentId(entry.key);
                return componentId ? isComponentDebugEnabled(componentId) : false;
            });
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
            if (height === null) {
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
                componentId: normalizeComponentId(componentId),
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
                componentId: normalizeComponentId(componentId),
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

        const componentId = extractComponentId(this.key);
        const isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
        if (shouldLogMeasurements() && isDebugComponent) {
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

        const componentId = extractComponentId(this.key);
        const isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
        if (shouldLogMeasurements() && isDebugComponent) {
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

        // Debug: Check width constraints for image components
        const hasImages = this.node.querySelectorAll('img').length > 0;
        const componentId = extractComponentId(this.key);
        const isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;

        // Debug logging for image measurements (always log for debug components, even if warning doesn't fire)
        if (shouldLogMeasurements() && isDebugComponent && hasImages) {
            const parent = this.node.parentElement;
            const parentRect = parent?.getBoundingClientRect();
            const parentComputed = parent ? window.getComputedStyle(parent) : null;
            const image = this.node.querySelector('img') as HTMLImageElement | null;

            // Log width diagnostics for image components
            console.log('[MeasurementObserver] 🔍 Image measurement diagnostics:', {
                key: this.key,
                componentId: componentId ? normalizeComponentId(componentId) : componentId,
                height,
                nodeWidth: rect.width,
                nodeComputedWidth: computed?.width,
                nodeMaxWidth: computed?.maxWidth,
                parentWidth: parentRect?.width,
                parentComputedWidth: parentComputed?.width,
                parentMaxWidth: parentComputed?.maxWidth,
                imageCount: this.node.querySelectorAll('img').length,
                image: image ? {
                    naturalWidth: image.naturalWidth,
                    naturalHeight: image.naturalHeight,
                    width: image.width,
                    height: image.height,
                    computedWidth: window.getComputedStyle(image).width,
                    computedHeight: window.getComputedStyle(image).height,
                } : null,
            });
        }

        if (hasImages && height > 500) {
            const parent = this.node.parentElement;
            const parentRect = parent?.getBoundingClientRect();
            const parentComputed = parent ? window.getComputedStyle(parent) : null;

            // Only warn for debug-enabled components when measurement logging is enabled
            if (shouldLogMeasurements() && isDebugComponent) {
                console.warn('[MeasurementObserver] ⚠️ LARGE IMAGE MEASUREMENT:', {
                    key: this.key,
                    componentId: componentId ? normalizeComponentId(componentId) : componentId,
                    height,
                    nodeWidth: rect.width,
                    nodeComputedWidth: computed?.width,
                    nodeMaxWidth: computed?.maxWidth,
                    parentWidth: parentRect?.width,
                    parentComputedWidth: parentComputed?.width,
                    parentMaxWidth: parentComputed?.maxWidth,
                    imageCount: this.node.querySelectorAll('img').length,
                    images: Array.from(this.node.querySelectorAll('img')).map(img => ({
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        width: img.width,
                        height: img.height,
                        computedWidth: window.getComputedStyle(img).width,
                        computedHeight: window.getComputedStyle(img).height,
                    })),
                });
            }
        }

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

            const componentId = extractComponentId(this.key);
            const isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
            if (shouldLogMeasurements() && isDebugComponent) {
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

type MeasurementStagingMode = 'fixed-offscreen' | 'embedded';

export interface MeasurementLayerProps {
    entries: MeasurementEntry[];
    renderComponent: (entry: MeasurementEntry) => React.ReactNode;
    onMeasurements: MeasurementDispatcher;
    onMeasurementComplete?: (measurementVersion: number) => void; // Callback when all measurements are published
    coordinator?: MeasurementCoordinator; // Phase 1: Optional coordinator for locking
    measuredColumnWidth?: number | null; // Explicit column width for accurate image scaling
    publishOnce?: boolean; // Spike: accumulate and publish single batch when complete
    stagingMode?: MeasurementStagingMode; // Render measurement DOM offscreen (default) or embedded
}

const readPublishOnceEnv = (): boolean => {
    try {
        const v = (process.env.REACT_APP_CANVAS_PUBLISH_ONCE || '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes' || v === 'on';
    } catch {
        return false; // Default to false for backward compatibility
    }
};

export const MeasurementLayer: React.FC<MeasurementLayerProps> = ({
    entries,
    renderComponent,
    onMeasurements,
    onMeasurementComplete,
    coordinator,
    measuredColumnWidth,
    publishOnce,
    stagingMode = 'fixed-offscreen',
}) => {
    const effectivePublishOnce = typeof publishOnce === 'boolean' ? publishOnce : readPublishOnceEnv();
    const cumulativeRef = useRef(new Map<string, MeasurementRecord>());
    const publishedRef = useRef(false);
    const measurementVersionRef = useRef(0); // Track measurement version for proper incrementing
    const previousEntriesSignatureRef = useRef<string | null>(null);
    const previousPublishModeRef = useRef<boolean>(effectivePublishOnce);

    const requiredKeysRef = useRef(new Set<string>());
    const measurementEntriesSignature = useMemo(() => buildMeasurementEntriesSignature(entries), [entries]);

    useEffect(() => {
        // Defer resets when there are no entries to measure yet (e.g., pre-refresh initialization)
        if (entries.length === 0) {
            requiredKeysRef.current = new Set();
            cumulativeRef.current.clear();
            publishedRef.current = false;
            previousEntriesSignatureRef.current = measurementEntriesSignature;
            previousPublishModeRef.current = effectivePublishOnce;
            if (shouldLogMeasurements()) {
                console.log('⏸️ [Measurement] no entries to measure, waiting for components', {
                    publishOnce: effectivePublishOnce,
                });
            }
            return;
        }

        const signatureChanged = previousEntriesSignatureRef.current !== measurementEntriesSignature;
        const publishModeChanged = previousPublishModeRef.current !== effectivePublishOnce;

        if (!signatureChanged && !publishModeChanged) {
            if (shouldLogMeasurements()) {
                console.log('📭 [Measurement] entries unchanged, skipping reset', {
                    signature: measurementEntriesSignature || 'empty',
                });
            }
            return;
        }

        previousEntriesSignatureRef.current = measurementEntriesSignature;
        previousPublishModeRef.current = effectivePublishOnce;

        const required = new Set<string>();
        entries.forEach((e) => required.add(e.measurementKey));
        requiredKeysRef.current = required;
        // Reset for new cycle
        cumulativeRef.current.clear();
        publishedRef.current = false;
        // Note: measurementStatus will be set to 'measuring' by MEASUREMENTS_UPDATED action
        // when first measurements arrive, so we don't need to dispatch MEASUREMENT_START here
        if (shouldLogMeasurements()) {
            console.log('📐 [Measurement] start', {
                requiredCount: required.size,
                publishOnce: effectivePublishOnce,
            });
        }
    }, [entries, measurementEntriesSignature, effectivePublishOnce]);

    const checkAndSignalCompletion = useCallback(
        (mode: 'incremental' | 'publish-once'): number | null => {
            if (publishedRef.current) {
                return null;
            }

            const required = requiredKeysRef.current;
            if (required.size === 0) {
                return null;
            }

            let allPresent = true;
            required.forEach((key) => {
                if (!cumulativeRef.current.has(key)) {
                    allPresent = false;
                }
            });

            if (!allPresent) {
                return null;
            }

            publishedRef.current = true;
            const version = measurementVersionRef.current + 1;
            measurementVersionRef.current = version;

            if (shouldLogMeasurements()) {
                const logPayload = {
                    publishedCount: cumulativeRef.current.size,
                    requiredCount: required.size,
                    measurementVersion: version,
                };
                if (mode === 'publish-once') {
                    console.log('✅ [Measurement] publish-complete', logPayload);
                } else {
                    console.log('✅ [Measurement] measurement-complete (incremental)', logPayload);
                }
            }

            if (onMeasurementComplete) {
                onMeasurementComplete(version);
            }

            return version;
        },
        [onMeasurementComplete]
    );

    const dispatcher = useIdleMeasurementDispatcher((updates) => {
        // Hard-stop: if we've already published (publish-once mode), ignore all further updates
        if (effectivePublishOnce && publishedRef.current) {
            return;
        }

        updates.forEach((u) => {
            // Treat zero-height metadata as present; only remove on explicit delete (negative height)
            if (u.height >= 0) {
                cumulativeRef.current.set(u.key, u);
            } else {
                cumulativeRef.current.delete(u.key);
            }
        });

        if (!effectivePublishOnce) {
            onMeasurements(updates);
            checkAndSignalCompletion('incremental');
            return;
        }

        const completionVersion = checkAndSignalCompletion('publish-once');
        if (completionVersion == null) {
            return;
        }

        // Publish one consolidated batch to reducer
        onMeasurements(Array.from(cumulativeRef.current.values()));
        // Immediately detach all observers to prevent post-publish churn
        try {
            observers.current.forEach((observer, key) => {
                logSpellcastingEvent(key, 'detach', '🧹', 'detach-after-publish', {}, { force: true });
                observer.detach();
                coordinator?.unregisterObserver(key);
            });
            observers.current.clear();
        } catch {
            // best-effort cleanup
        }
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
                    // In publish-once mode (pre-initial publish), suppress deletion dispatches.
                    // Detach/attach churn during React StrictMode and initial measurement can
                    // cause required keys to be removed, preventing the first publish.
                    if (!effectivePublishOnce || !publishedRef.current) {
                        dispatcher(key, null);
                    }
                }
                return;
            }

            if (existingObserver) {
                return;
            }

            const componentId = extractComponentId(key);
            const isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
            const isEntryDebugComponent = isComponentDebugEnabled(entry.instance.id);

            if (isDebugComponent || isEntryDebugComponent) {
                logSpellcastingEvent(key, 'attach', '➕', 'attach', {
                    entryId: normalizeComponentId(entry.instance.id),
                    slotIndex: entry.slotIndex,
                    orderIndex: entry.orderIndex,
                    regionContentKind: entry.regionContent?.kind,
                }, { force: isEntryDebugComponent && !isDebugComponent });
            }

            const observer = new MeasurementObserver(key, node, dispatcher);
            observer.attach();
            observers.current.set(key, observer);

            coordinator?.registerObserver(key, observer);
        },
        [dispatcher, coordinator, effectivePublishOnce]
    );

    useEffect(() => () => {
        observers.current.forEach((observer, key) => {
            logSpellcastingEvent(key, 'detach', '🧨', 'cleanup', {}, { force: true });
            observer.detach();
            coordinator?.unregisterObserver(key);
        });
        observers.current.clear();
    }, [coordinator]);

    const containerStyle: React.CSSProperties =
        stagingMode === 'embedded'
            ? {
                position: 'relative',
                width: measuredColumnWidth != null ? `${measuredColumnWidth}px` : '100%',
                maxWidth: measuredColumnWidth != null ? `${measuredColumnWidth}px` : '100%',
                visibility: 'hidden',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
            }
            : {
                position: 'fixed',
                left: '-100000px',
                top: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                width: measuredColumnWidth != null ? `${measuredColumnWidth}px` : 'auto',
                maxWidth: measuredColumnWidth != null ? `${measuredColumnWidth}px` : 'none',
            };

    return (
        <div className="dm-measurement-layer" style={containerStyle}>
            {entries.map((entry) => (
                <div
                    key={entry.measurementKey}
                    ref={handleRef(entry)}
                    className="dm-measurement-entry"
                    data-measurement-key={entry.measurementKey}
                    style={{
                        width: measuredColumnWidth != null ? `${measuredColumnWidth}px` : '100%',
                        maxWidth: measuredColumnWidth != null ? `${measuredColumnWidth}px` : '100%',
                        boxSizing: 'border-box',
                        height: 'auto',
                        minHeight: 0,
                        flexShrink: 0,
                        flexGrow: 0,
                        overflow: 'hidden',
                        transform: 'none',
                    }}
                >
                    {renderComponent(entry)}
                </div>
            ))}
        </div>
    );
};


