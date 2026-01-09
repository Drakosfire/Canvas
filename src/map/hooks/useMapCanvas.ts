/**
 * useMapCanvas Hook
 * 
 * Main orchestration hook for map canvas state management.
 * Manages grid config, labels, view state, and dirty tracking.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  GridConfig,
  MapLabel,
  MapViewState,
  MapEditMode,
  DEFAULT_GRID_CONFIG,
} from '../types/map.types';

export interface UseMapCanvasConfig {
  /** Initial grid configuration */
  initialGridConfig?: GridConfig;
  /** Initial labels */
  initialLabels?: MapLabel[];
  /** Initial view state */
  initialView?: MapViewState;
}

export interface UseMapCanvasResult {
  // State
  gridConfig: GridConfig;
  labels: MapLabel[];
  view: MapViewState;
  mode: MapEditMode;
  isDirty: boolean;
  selectedLabelId: string | null;

  // Grid actions
  setGridConfig: (updates: Partial<GridConfig>) => void;

  // Label actions
  addLabel: (label: Omit<MapLabel, 'id' | 'rotation' | 'fontFamily' | 'fontSize' | 'color'> & Partial<MapLabel>) => void;
  updateLabel: (id: string, updates: Partial<MapLabel>) => void;
  removeLabel: (id: string) => void;
  setLabels: (labels: MapLabel[]) => void;
  selectLabel: (id: string | null) => void;

  // View actions
  setView: (view: Partial<MapViewState>) => void;
  resetView: () => void;
  fitToViewport: (imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number) => void;

  // Mode actions
  setMode: (mode: MapEditMode) => void;

  // State management
  clearDirty: () => void;
}

const DEFAULT_VIEW: MapViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

/**
 * Hook for managing map canvas state
 */
export function useMapCanvas(config: UseMapCanvasConfig = {}): UseMapCanvasResult {
  const {
    initialGridConfig = DEFAULT_GRID_CONFIG,
    initialLabels = [],
    initialView = DEFAULT_VIEW,
  } = config;

  // State
  const [gridConfig, setGridConfigState] = useState<GridConfig>(initialGridConfig);
  const [labels, setLabelsState] = useState<MapLabel[]>(initialLabels);
  const [view, setViewState] = useState<MapViewState>(initialView);
  const [mode, setModeState] = useState<MapEditMode>('view');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

  // Grid config actions
  const setGridConfig = useCallback((updates: Partial<GridConfig>) => {
    setGridConfigState((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
    console.log('🔲 [MapCanvas] Grid config updated:', updates);
  }, []);

  // Label actions
  const addLabel = useCallback(
    (
      label: Omit<MapLabel, 'id' | 'rotation' | 'fontFamily' | 'fontSize' | 'color'> &
        Partial<MapLabel>
    ) => {
      const newLabel: MapLabel = {
        id: uuidv4(),
        text: label.text,
        x: label.x,
        y: label.y,
        rotation: label.rotation ?? 0,
        fontFamily: label.fontFamily ?? 'MedievalSharp',
        fontSize: label.fontSize ?? 24,
        color: label.color ?? '#000000',
        // Default stroke for visibility on any background
        strokeColor: label.strokeColor ?? '#ffffff',
        strokeWidth: label.strokeWidth ?? 1,
        shadowEnabled: label.shadowEnabled ?? false,
        shadowColor: label.shadowColor ?? '#000000',
        shadowBlur: label.shadowBlur ?? 4,
        shadowOffsetX: label.shadowOffsetX ?? 2,
        shadowOffsetY: label.shadowOffsetY ?? 2,
      };

      setLabelsState((prev) => [...prev, newLabel]);
      setSelectedLabelId(newLabel.id);  // Auto-select newly placed label
      setIsDirty(true);
      console.log('🏷️ [MapCanvas] Label added:', newLabel.id);
    },
    []
  );

  const updateLabel = useCallback((id: string, updates: Partial<MapLabel>) => {
    setLabelsState((prev) =>
      prev.map((label) => (label.id === id ? { ...label, ...updates } : label))
    );
    setIsDirty(true);
    console.log('✏️ [MapCanvas] Label updated:', id);
  }, []);

  const removeLabel = useCallback((id: string) => {
    setLabelsState((prev) => prev.filter((label) => label.id !== id));
    setSelectedLabelId((prev) => (prev === id ? null : prev));
    setIsDirty(true);
    console.log('🗑️ [MapCanvas] Label removed:', id);
  }, []);

  const setLabels = useCallback((newLabels: MapLabel[]) => {
    setLabelsState(newLabels);
    setIsDirty(true);
    console.log('📝 [MapCanvas] Labels set:', newLabels.length);
  }, []);

  const selectLabel = useCallback((id: string | null) => {
    setSelectedLabelId(id);
    console.log('🎯 [MapCanvas] Label selected:', id);
  }, []);

  // View actions
  const setView = useCallback((updates: Partial<MapViewState>) => {
    setViewState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetView = useCallback(() => {
    setViewState(DEFAULT_VIEW);
    console.log('🔄 [MapCanvas] View reset');
  }, []);

  /**
   * Fit image to viewport, centering and scaling to fit without upscaling.
   * Never scales above 1.0 (100%) to avoid pixelation.
   */
  const fitToViewport = useCallback(
    (imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number) => {
      // Calculate scale to fit image in viewport (never upscale)
      const scaleX = viewportWidth / imageWidth;
      const scaleY = viewportHeight / imageHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Never upscale above 100%

      // Center the image
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;
      const panX = (viewportWidth - scaledWidth) / 2;
      const panY = (viewportHeight - scaledHeight) / 2;

      setViewState({
        zoom: scale,
        panX,
        panY,
      });

      console.log('📐 [MapCanvas] Fit to viewport:', {
        imageSize: `${imageWidth}x${imageHeight}`,
        viewportSize: `${viewportWidth}x${viewportHeight}`,
        scale: scale.toFixed(2),
        pan: `(${panX.toFixed(0)}, ${panY.toFixed(0)})`,
      });
    },
    []
  );

  // Mode actions
  const setMode = useCallback((newMode: MapEditMode) => {
    setModeState(newMode);
    console.log('🎨 [MapCanvas] Mode changed:', newMode);
  }, []);

  // State management
  const clearDirty = useCallback(() => {
    setIsDirty(false);
    console.log('✅ [MapCanvas] Dirty state cleared');
  }, []);

  return {
    // State
    gridConfig,
    labels,
    view,
    mode,
    isDirty,
    selectedLabelId,

    // Grid actions
    setGridConfig,

    // Label actions
    addLabel,
    updateLabel,
    removeLabel,
    setLabels,
    selectLabel,

    // View actions
    setView,
    resetView,
    fitToViewport,

    // Mode actions
    setMode,

    // State management
    clearDirty,
  };
}
