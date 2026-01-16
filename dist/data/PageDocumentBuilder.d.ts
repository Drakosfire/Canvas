/**
 * Page Document Builder
 *
 * Utilities for building PageDocument instances from live data.
 * Handles data hydration and template instantiation.
 */
import type { PageDocument, TemplateConfig } from '../types/canvas.types';
/**
 * TODO: Add a data source type for the character data and statblock
 */
interface BuildPageDocumentOptions<T = unknown, C = unknown> {
    template: TemplateConfig;
    statblockData?: T;
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
export declare function updatePageDataSources<T = unknown, C = unknown>(page: PageDocument, statblockData?: T, characterData?: C, customData?: Record<string, unknown>): PageDocument;
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