/**
 * Page Document Builder
 *
 * Utilities for building PageDocument instances from live data.
 * Handles data hydration and template instantiation.
 */
import type { PageDocument, TemplateConfig } from '../types/canvas.types';
interface BuildPageDocumentOptions<T = unknown, C = unknown> {
    template: TemplateConfig;
    /** @deprecated Prefer `primaryData` — kept for StatblockGenerator compatibility */
    statblockData?: T;
    /** Primary document payload (creates a typed data source when set) */
    primaryData?: T;
    /** Data source type for primary payload (default: 'statblock' for backward compatibility) */
    primaryDataSourceType?: string;
    /** Data source id for primary payload (default: 'statblock-main' for backward compatibility) */
    primaryDataSourceId?: string;
    characterData?: C;
    customData?: Record<string, unknown>;
    projectId?: string;
    ownerId?: string;
}
/**
 * Build a complete page document from a template and live data
 */
export declare function buildPageDocument<T = unknown, C = unknown>(options: BuildPageDocumentOptions<T, C>): PageDocument;
/**
 * Update data sources in an existing page document
 */
export declare function updatePageDataSources<T = unknown, C = unknown>(page: PageDocument, primaryOrStatblockData?: T, characterData?: C, customData?: Record<string, unknown>, primaryDataSourceType?: string): PageDocument;
/**
 * Extract custom data object from selected assets
 */
export declare function extractCustomData(selectedAssets: {
    creatureImage?: string;
    selectedImageIndex?: number;
    generatedImages?: string[];
    modelFile?: string;
}): Record<string, unknown>;
export {};
//# sourceMappingURL=PageDocumentBuilder.d.ts.map