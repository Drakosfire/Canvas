/**
 * HTML Export Utilities
 *
 * Export statblock canvas to standalone HTML file.
 */
import type { PageDocument, TemplateConfig } from '../types/canvas.types';
import type { CanvasAdapters } from '../types/adapters.types';
import type { BasePageDimensions } from '../layout/utils';
interface ExportOptions {
    includeStyles?: boolean;
    includeMetadata?: boolean;
    title?: string;
}
/**
 * Generate standalone HTML from page document
 */
export declare function exportToHTML(page: PageDocument, template: TemplateConfig, baseDimensions: BasePageDimensions, adapters: CanvasAdapters, options?: ExportOptions): Promise<string>;
/**
 * Download HTML as file
 */
export declare function downloadHTML(html: string, filename: string): void;
/**
 * Export page document to HTML file
 */
export declare function exportPageToHTMLFile(page: PageDocument, template: TemplateConfig, adapters: CanvasAdapters): Promise<void>;
export {};
//# sourceMappingURL=htmlExport.d.ts.map