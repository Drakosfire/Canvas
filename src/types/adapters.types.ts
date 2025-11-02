/**
 * Adapter interfaces for Canvas system
 * 
 * Applications implement these adapters to provide domain-specific behavior
 * to the generic Canvas layout engine.
 */

import type { ComponentDataSource, ComponentDataReference, RegionListContent } from './canvas.types';

/**
 * Data resolution adapter
 * Resolves data references to actual values from data sources
 */
export interface DataResolver {
    /**
     * Resolve a data reference to its value
     * @param dataSources - Available data sources
     * @param dataRef - Reference to resolve
     * @returns Resolved value or undefined if not found
     */
    resolveDataReference<T = unknown>(
        dataSources: ComponentDataSource[],
        dataRef: ComponentDataReference
    ): T | undefined;

    /**
     * Get the primary data source of a specific type
     * @param dataSources - Available data sources
     * @param type - Type of source to retrieve
     * @returns Primary source payload or undefined
     */
    getPrimarySource<T = unknown>(dataSources: ComponentDataSource[], type: string): T | undefined;
}

/**
 * List normalization adapter
 * Normalizes and transforms list items
 */
export interface ListNormalizer {
    /**
     * Normalize list items (ensure array, filter nulls, etc.)
     * @param items - Raw items (may be undefined, null, or not an array)
     * @returns Normalized array of items
     */
    normalizeListItems<T = unknown>(items: T[] | undefined | null): T[];
}

/**
 * Region content adapter
 * Creates region-specific list content
 */
export interface RegionContentFactory {
    /**
     * Create region list content from items
     * @param kind - Content kind identifier
     * @param items - List items
     * @param startIndex - Starting index for this slice
     * @param totalCount - Total number of items across all segments
     * @param isContinuation - Whether this is a continuation from previous region
     * @param metadata - Optional metadata for the list
     * @returns Region list content
     */
    createRegionContent<T = unknown>(
        kind: string,
        items: T[],
        startIndex: number,
        totalCount: number,
        isContinuation: boolean,
        metadata?: Record<string, unknown>
    ): import('../types/canvas.types').RegionListContent;
}

/**
 * Height estimation adapter
 * Estimates component heights before measurement
 */
export interface HeightEstimator {
    /**
     * Estimate height of a single list item
     * @param item - Item to estimate
     * @returns Estimated height in pixels
     */
    estimateItemHeight<T = unknown>(item: T): number;

    /**
     * Estimate total height of a list
     * @param items - List items
     * @param isContinuation - Whether this is a continuation
     * @returns Estimated height in pixels
     */
    estimateListHeight<T = unknown>(items: T[], isContinuation: boolean): number;

    /**
     * Estimate height of a component
     * @param component - Component to estimate
     * @returns Estimated height in pixels
     */
    estimateComponentHeight<T = unknown>(component: T): number;
}

/**
 * Metadata extraction adapter
 * Extracts metadata from data sources for export/display
 */
export interface MetadataExtractor {
    /**
     * Extract display name from data source
     * @param dataSources - Available data sources
     * @returns Display name or undefined
     */
    extractDisplayName(dataSources: ComponentDataSource[]): string | undefined;

    /**
     * Extract metadata for export
     * @param dataSources - Available data sources
     * @returns Metadata object
     */
    extractExportMetadata(dataSources: ComponentDataSource[]): Record<string, unknown>;
}

/**
 * Complete adapter bundle
 * Combines all adapters into a single interface
 */
export interface CanvasAdapters {
    dataResolver: DataResolver;
    listNormalizer: ListNormalizer;
    regionContentFactory: RegionContentFactory;
    heightEstimator: HeightEstimator;
    metadataExtractor: MetadataExtractor;
}

/**
 * Default implementations (basic, no domain knowledge)
 */
export const createDefaultDataResolver = (): DataResolver => ({
    resolveDataReference<T = unknown>(
        dataSources: ComponentDataSource[],
        dataRef: ComponentDataReference
    ): T | undefined {
        if (dataRef.type === 'statblock') {
            const source = dataSources.find((s) => s.type === 'statblock');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                return payload[dataRef.path] as T | undefined;
            }
        } else if (dataRef.type === 'custom') {
            const source = dataSources.find((s) => s.type === 'custom');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                return payload[dataRef.key] as T | undefined;
            }
        }
        return undefined;
    },

    getPrimarySource<T = unknown>(dataSources: ComponentDataSource[], type: string): T | undefined {
        const source = dataSources.find((s) => s.type === type);
        return source?.payload as T | undefined;
    },
});

export const createDefaultListNormalizer = (): ListNormalizer => ({
    normalizeListItems<T = unknown>(items: T[] | undefined | null): T[] {
        return items ? (Array.isArray(items) ? items : []) : [];
    },
});

export const createDefaultHeightEstimator = (
    defaultItemHeight: number = 50,
    defaultComponentHeight: number = 200
): HeightEstimator => ({
    estimateItemHeight: () => defaultItemHeight,
    estimateListHeight: (items: unknown[]) => items.length * defaultItemHeight,
    estimateComponentHeight: () => defaultComponentHeight,
});

export const createDefaultMetadataExtractor = (): MetadataExtractor => ({
    extractDisplayName: () => 'Untitled',
    extractExportMetadata: () => ({}),
});

/**
 * Create default adapter bundle
 * @param options - Configuration options
 * @returns Complete adapter bundle with defaults
 */
export function createDefaultAdapters(options?: {
    defaultItemHeight?: number;
    defaultComponentHeight?: number;
}): CanvasAdapters {
    return {
        dataResolver: createDefaultDataResolver(),
        listNormalizer: createDefaultListNormalizer(),
        regionContentFactory: {
            createRegionContent: (kind, items, startIndex, totalCount, isContinuation, metadata) => ({
                kind,
                items,
                startIndex,
                totalCount,
                isContinuation,
                metadata,
            }),
        },
        heightEstimator: createDefaultHeightEstimator(
            options?.defaultItemHeight,
            options?.defaultComponentHeight
        ),
        metadataExtractor: createDefaultMetadataExtractor(),
    };
}

