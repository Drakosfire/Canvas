/**
 * Test utilities for Canvas tests
 * Provides generic helpers that don't depend on statblock-specific types
 */
import type { ComponentInstance } from '../types/canvas.types';
import type { CanvasLayoutEntry } from '../layout/types';
/**
 * Create a generic component instance for testing
 */
export declare function createTestInstance(id: string, overrides?: Partial<ComponentInstance>): ComponentInstance;
/**
 * Create a test layout entry
 */
export declare function createTestEntry(id: string, estimatedHeight: number, overrides?: Partial<CanvasLayoutEntry>): CanvasLayoutEntry;
/**
 * Create a test list entry with generic items
 */
export declare function createTestListEntry(id: string, items: unknown[], estimatedHeight: number, overrides?: Partial<CanvasLayoutEntry>): CanvasLayoutEntry;
/**
 * Create a simple mock item for list testing
 */
export interface MockListItem {
    id: string;
    name: string;
    description?: string;
}
export declare function createMockItem(id: string, name: string, description?: string): MockListItem;
/**
 * Create test page variables
 */
import type { PageVariables } from '../types/canvas.types';
export declare function createTestPageVariables(overrides?: Partial<PageVariables>): PageVariables;
/**
 * Create test template config
 */
import type { TemplateConfig } from '../types/canvas.types';
export declare function createTestTemplate(overrides?: Partial<TemplateConfig>): TemplateConfig;
//# sourceMappingURL=test-utils.d.ts.map