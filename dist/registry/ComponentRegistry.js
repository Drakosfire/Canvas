/**
 * Canvas Component Registry
 *
 * Factory functions for creating component registries.
 * Applications should create their own registries with their component implementations.
 */
/**
 * Create a component registry from a record of entries
 */
export function createComponentRegistry(entries) {
    return entries;
}
/**
 * Get a component registry entry by type
 */
export function getComponentEntry(registry, type) {
    return registry[type];
}
/**
 * Get all available component types from a registry
 */
export function getAllComponentTypes(registry) {
    return Object.keys(registry);
}
/**
 * Get core components (commonly used)
 * Note: This is domain-specific - applications should provide their own core list
 */
export function getCoreComponents(registry) {
    // Return all components by default
    // Applications can override this or filter as needed
    return Object.keys(registry);
}
/**
 * Get utility components (layout helpers)
 * Note: This is domain-specific - applications should provide their own utility list
 */
export function getUtilityComponents(registry) {
    // Return components marked as utilities, or filter by pattern
    // Applications can override this
    return Object.keys(registry).filter(function (type) {
        return type.includes('divider') ||
            type.includes('spacer') ||
            type.includes('quote');
    });
}
/**
 * Check if a component type exists in a registry
 */
export function isValidComponentType(registry, type) {
    return type in registry;
}
