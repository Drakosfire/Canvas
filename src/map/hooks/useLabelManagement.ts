/**
 * useLabelManagement Hook (T062)
 * 
 * Manages label CRUD operations for map labels.
 * Provides functions to add, update, remove, and select labels.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  MapLabel,
  DEFAULT_GRID_CONFIG,
  FONT_OPTIONS,
  ROTATION_OPTIONS,
} from '../types/map.types';

export interface UseLabelManagementConfig {
  /** Initial labels array */
  initialLabels?: MapLabel[];
}

export interface UseLabelManagementResult {
  // State
  labels: MapLabel[];
  selectedLabelId: string | null;

  // Actions
  addLabel: (
    label: Omit<MapLabel, 'id' | 'rotation' | 'fontFamily' | 'fontSize' | 'color'> &
      Partial<Pick<MapLabel, 'rotation' | 'fontFamily' | 'fontSize' | 'color'>>
  ) => void;
  updateLabel: (id: string, updates: Partial<MapLabel>) => void;
  removeLabel: (id: string) => void;
  setLabels: (labels: MapLabel[]) => void;
  selectLabel: (id: string | null) => void;
  getLabel: (id: string) => MapLabel | null;
}

/**
 * Hook for managing map label CRUD operations.
 * 
 * @param config - Configuration options
 * @returns Label management functions and state
 */
export function useLabelManagement(
  config: UseLabelManagementConfig = {}
): UseLabelManagementResult {
  const { initialLabels = [] } = config;

  const [labels, setLabelsState] = useState<MapLabel[]>(initialLabels);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

  // Add a new label with defaults
  const addLabel = useCallback(
    (
      label: Omit<MapLabel, 'id' | 'rotation' | 'fontFamily' | 'fontSize' | 'color'> &
        Partial<Pick<MapLabel, 'rotation' | 'fontFamily' | 'fontSize' | 'color'>>
    ) => {
      // Enforce maximum label limit (100)
      if (labels.length >= 100) {
        console.warn('⚠️ [LabelManagement] Maximum label limit (100) reached');
        return;
      }

      const newLabel: MapLabel = {
        id: uuidv4(),
        text: label.text,
        x: label.x,
        y: label.y,
        rotation: label.rotation ?? 0,
        fontFamily: label.fontFamily ?? 'MedievalSharp',
        fontSize: label.fontSize ?? 24,
        color: label.color ?? '#000000',
      };

      setLabelsState((prev) => [...prev, newLabel]);
      setSelectedLabelId(newLabel.id);
      console.log('🏷️ [LabelManagement] Label added:', newLabel.id);
    },
    [labels.length]
  );

  // Update an existing label
  const updateLabel = useCallback((id: string, updates: Partial<MapLabel>) => {
    setLabelsState((prev) =>
      prev.map((label) => (label.id === id ? { ...label, ...updates } : label))
    );
    console.log('✏️ [LabelManagement] Label updated:', id);
  }, []);

  // Remove a label
  const removeLabel = useCallback((id: string) => {
    setLabelsState((prev) => prev.filter((label) => label.id !== id));
    setSelectedLabelId((prev) => (prev === id ? null : prev));
    console.log('🗑️ [LabelManagement] Label removed:', id);
  }, []);

  // Replace all labels
  const setLabels = useCallback((newLabels: MapLabel[]) => {
    setLabelsState(newLabels);
    console.log('📝 [LabelManagement] Labels set:', newLabels.length);
  }, []);

  // Select a label
  const selectLabel = useCallback((id: string | null) => {
    setSelectedLabelId(id);
    console.log('🎯 [LabelManagement] Label selected:', id);
  }, []);

  // Get a label by ID
  const getLabel = useCallback(
    (id: string): MapLabel | null => {
      return labels.find((label) => label.id === id) ?? null;
    },
    [labels]
  );

  return {
    labels,
    selectedLabelId,
    addLabel,
    updateLabel,
    removeLabel,
    setLabels,
    selectLabel,
    getLabel,
  };
}
