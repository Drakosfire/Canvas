/**
 * useMapExport Hook
 * 
 * Hook for exporting maps as flattened images.
 * Handles API communication with the backend export endpoint.
 */

import { useCallback } from 'react';
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

// Default fallback URL (should be overridden by consuming app)
const DEFAULT_API_BASE_URL = 'http://localhost:7860';

/**
 * Hook for exporting maps
 * 
 * @param options - Configuration options including API base URL
 */
export function useMapExport(options: UseMapExportOptions = {}) {
  const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
  /**
   * Export a map as a flattened image
   * 
   * @param params - Map data to export
   * @param format - Export format ('png' or 'jpeg')
   * @returns Promise resolving to export response with image URL
   */
  const exportMap = useCallback(
    async (
      params: ExportMapParams,
      format: 'png' | 'jpeg' = 'png'
    ): Promise<ExportMapResponse> => {
      console.log('📤 [useMapExport] Exporting map:', {
        format,
        hasGrid: params.gridConfig.visible,
        labelCount: params.labels.length,
      });

      try {
        const response = await fetch(`${apiBaseUrl}/api/mapgenerator/export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            format,
            project: {
              baseImageUrl: params.baseImageUrl,
              gridConfig: params.gridConfig,
              labels: params.labels,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
          throw new Error(errorData.message || `Export failed: ${response.statusText}`);
        }

        const data: ExportMapResponse = await response.json();
        console.log('✅ [useMapExport] Export complete:', {
          imageUrl: data.imageUrl,
          fileSize: data.fileSize,
          dimensions: `${data.width}x${data.height}`,
        });

        return data;
      } catch (error) {
        console.error('❌ [useMapExport] Export failed:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Download exported image as a file
   * 
   * Uses a backend proxy to bypass CORS restrictions on R2 presigned URLs.
   * 
   * @param imageUrl - URL to the exported image (R2 presigned URL)
   * @param filename - Filename for the download
   */
  const downloadImage = useCallback(async (imageUrl: string, filename: string) => {
    console.log('💾 [useMapExport] Downloading image:', filename);

    try {
      // Use backend proxy to bypass CORS on R2 URLs
      const proxyUrl = `${apiBaseUrl}/api/mapgenerator/download?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`;
      
      const response = await fetch(proxyUrl, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ [useMapExport] Download complete');
    } catch (error) {
      console.error('❌ [useMapExport] Download failed:', error);
      throw error;
    }
  }, [apiBaseUrl]);

  return {
    exportMap,
    downloadImage,
  };
}
