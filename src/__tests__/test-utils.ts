/**
 * Test utilities for Canvas tests
 * Provides generic helpers that don't depend on statblock-specific types
 */

import type { ComponentInstance, RegionListContent } from '../types/canvas.types';
import type { CanvasLayoutEntry } from '../layout/types';

/**
 * Create a generic component instance for testing
 */
export function createTestInstance(
    id: string,
    overrides: Partial<ComponentInstance> = {}
): ComponentInstance {
    return {
        id,
        type: 'test-component',
        dataRef: { type: 'custom', key: 'testData' },
        layout: { isVisible: true },
        ...overrides,
    };
}

/**
 * Create a test layout entry
 */
export function createTestEntry(
    id: string,
    estimatedHeight: number,
    overrides: Partial<CanvasLayoutEntry> = {}
): CanvasLayoutEntry {
    return {
        instance: createTestInstance(id),
        slotIndex: 0,
        orderIndex: 0,
        sourceRegionKey: '1:1',
        region: { page: 1, column: 1 },
        homeRegion: { page: 1, column: 1 },
        homeRegionKey: '1:1',
        estimatedHeight,
        measurementKey: `${id}:block`,
        needsMeasurement: false,
        ...overrides,
    };
}

/**
 * Create a test list entry with generic items
 */
export function createTestListEntry(
    id: string,
    items: unknown[],
    estimatedHeight: number,
    overrides: Partial<CanvasLayoutEntry> = {}
): CanvasLayoutEntry {
    const regionContent: RegionListContent = {
        kind: 'test-list',
        items,
        startIndex: 0,
        totalCount: items.length,
        isContinuation: false,
    };

    return createTestEntry(id, estimatedHeight, {
        regionContent,
        measurementKey: `${id}:test-list:0:${items.length}:${items.length}`,
        ...overrides,
    });
}

/**
 * Create a simple mock item for list testing
 */
export interface MockListItem {
    id: string;
    name: string;
    description?: string;
}

export function createMockItem(id: string, name: string, description?: string): MockListItem {
    return { id, name, description };
}

/**
 * Create test page variables
 */
import type { PageVariables } from '../types/canvas.types';

export function createTestPageVariables(overrides: Partial<PageVariables> = {}): PageVariables {
    return {
        mode: 'locked',
        dimensions: {
            width: 816,
            height: 1056,
            unit: 'px',
        },
        background: {
            type: 'solid',
            color: '#ffffff',
        },
        columns: {
            enabled: true,
            columnCount: 1,
            gutter: 12,
            unit: 'px',
        },
        pagination: {
            pageCount: 1,
            columnCount: 1,
        },
        snap: {
            enabled: false,
            gridSize: 10,
            gridUnit: 'px',
            snapToSlots: false,
            snapToEdges: false,
        },
        ...overrides,
    };
}

/**
 * Create test template config
 */
import type { TemplateConfig } from '../types/canvas.types';

export function createTestTemplate(overrides: Partial<TemplateConfig> = {}): TemplateConfig {
    return {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test template for unit tests',
        defaultMode: 'locked',
        defaultPageVariables: createTestPageVariables(),
        slots: [],
        defaultComponents: [],
        allowedComponents: ['test-component'],
        ...overrides,
    };
}

