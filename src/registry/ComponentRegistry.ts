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
export function createComponentRegistry(
    entries: Record<string, ComponentRegistryEntry>
): Record<string, ComponentRegistryEntry> {
    return entries;
}

/**
 * Get a component registry entry by type
 */
export function getComponentEntry(
    registry: Record<string, ComponentRegistryEntry>,
    type: CanvasComponentType
): ComponentRegistryEntry | undefined {
    return registry[type];
}

/**
 * Get all available component types from a registry
 */
export function getAllComponentTypes(
    registry: Record<string, ComponentRegistryEntry>
): CanvasComponentType[] {
    return Object.keys(registry) as CanvasComponentType[];
}

/**
 * Get core components (commonly used)
 * Note: This is domain-specific - applications should provide their own core list
 */
export function getCoreComponents(
    registry: Record<string, ComponentRegistryEntry>
): CanvasComponentType[] {
    // Return all components by default
    // Applications can override this or filter as needed
    return Object.keys(registry) as CanvasComponentType[];
}

/**
 * Get utility components (layout helpers)
 * Note: This is domain-specific - applications should provide their own utility list
 */
export function getUtilityComponents(
    registry: Record<string, ComponentRegistryEntry>
): CanvasComponentType[] {
    // Return components marked as utilities, or filter by pattern
    // Applications can override this
    return Object.keys(registry).filter((type) => 
        type.includes('divider') || 
        type.includes('spacer') || 
        type.includes('quote')
    ) as CanvasComponentType[];
}

/**
 * Check if a component type exists in a registry
 */
export function isValidComponentType(
    registry: Record<string, ComponentRegistryEntry>,
    type: string
): type is CanvasComponentType {
    return type in registry;
}
