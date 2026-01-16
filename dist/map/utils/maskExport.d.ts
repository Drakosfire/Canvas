/**
 * Mask Export Utility
 *
 * Exports mask strokes to base64 PNG for backend inpainting.
 * Implements TDD tests from T162-T164.
 *
 * Alpha channel semantics:
 * - 0 (transparent): AI may generate/replace
 * - 1 (opaque): AI must not alter
 */
import type { MaskExportOptions, MaskExportResult } from '../types/mask.types';
/**
 * Export mask strokes to a base64-encoded PNG.
 */
export declare function exportMaskToBase64(options: MaskExportOptions): Promise<MaskExportResult>;
//# sourceMappingURL=maskExport.d.ts.map