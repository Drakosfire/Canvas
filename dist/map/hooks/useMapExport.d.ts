/**
 * useMapExport Hook
 *
 * Hook for exporting maps as flattened images.
 * Handles API communication with the backend export endpoint.
 */
import { GridConfig, MapLabel } from '../types/map.types';
export interface ExportMapParams {
    baseImageUrl: string;
    gridConfig: GridConfig;
    labels: MapLabel[];
}
export interface ExportMapResponse {
    imageUrl: string;
    fileSize: number;
    width: number;
    height: number;
}
export interface UseMapExportOptions {
    /** Base URL for the API (e.g., 'http://localhost:7860') */
    apiBaseUrl?: string;
}
/**
 * Hook for exporting maps
 *
 * @param options - Configuration options including API base URL
 */
export declare function useMapExport(options?: UseMapExportOptions): {
    exportMap: (params: ExportMapParams, format?: 'png' | 'jpeg') => Promise<ExportMapResponse>;
    downloadImage: (imageUrl: string, filename: string) => Promise<void>;
};
//# sourceMappingURL=useMapExport.d.ts.map