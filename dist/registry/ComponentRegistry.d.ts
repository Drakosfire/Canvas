/**
 * Canvas Component Registry
 *
 * Factory functions for creating component registries.
 * Applications should create their own registries with their component implementations.
 */
import type { ComponentRegistryEntry, CanvasComponentType } from '../types/canvas.types';
/**
 * Create a component registry from a record of entries
 */
export declare function createComponentRegistry(entries: Record<string, ComponentRegistryEntry>): Record<string, ComponentRegistryEntry>;
/**
 * Get a component registry entry by type
 */
export declare function getComponentEntry(registry: Record<string, ComponentRegistryEntry>, type: CanvasComponentType): ComponentRegistryEntry | undefined;
/**
 * Get all available component types from a registry
 */
export declare function getAllComponentTypes(registry: Record<string, ComponentRegistryEntry>): CanvasComponentType[];
/**
 * Get core components (commonly used)
 * Note: This is domain-specific - applications should provide their own core list
 */
export declare function getCoreComponents(registry: Record<string, ComponentRegistryEntry>): CanvasComponentType[];
/**
 * Get utility components (layout helpers)
 * Note: This is domain-specific - applications should provide their own utility list
 */
export declare function getUtilityComponents(registry: Record<string, ComponentRegistryEntry>): CanvasComponentType[];
/**
 * Check if a component type exists in a registry
 */
export declare function isValidComponentType(registry: Record<string, ComponentRegistryEntry>, type: string): type is CanvasComponentType;
//# sourceMappingURL=ComponentRegistry.d.ts.map