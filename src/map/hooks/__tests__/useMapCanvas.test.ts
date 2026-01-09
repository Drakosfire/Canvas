/**
 * useMapCanvas Hook Tests (TDD)
 * 
 * Tests for the main orchestration hook that manages map canvas state.
 */

import { renderHook, act } from '@testing-library/react';
import { useMapCanvas } from '../useMapCanvas';
import { DEFAULT_GRID_CONFIG, MapLabel } from '../../types/map.types';

describe('useMapCanvas', () => {
  const defaultConfig = {
    initialGridConfig: DEFAULT_GRID_CONFIG,
    initialLabels: [],
  };

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      expect(result.current.gridConfig).toEqual(DEFAULT_GRID_CONFIG);
      expect(result.current.labels).toEqual([]);
      expect(result.current.view.zoom).toBe(1);
      expect(result.current.view.panX).toBe(0);
      expect(result.current.view.panY).toBe(0);
      expect(result.current.isDirty).toBe(false);
    });

    it('should accept initial labels', () => {
      const initialLabels: MapLabel[] = [
        {
          id: 'label-1',
          text: 'Test Label',
          x: 100,
          y: 100,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];

      const { result } = renderHook(() =>
        useMapCanvas({ ...defaultConfig, initialLabels })
      );

      expect(result.current.labels).toEqual(initialLabels);
    });
  });

  describe('grid config updates', () => {
    it('should update grid visibility', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setGridConfig({ visible: true });
      });

      expect(result.current.gridConfig.visible).toBe(true);
      expect(result.current.isDirty).toBe(true);
    });

    it('should update grid type', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setGridConfig({ type: 'hex' });
      });

      expect(result.current.gridConfig.type).toBe('hex');
    });

    it('should update cell size', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setGridConfig({ cellSizePx: 100 });
      });

      expect(result.current.gridConfig.cellSizePx).toBe(100);
    });

    it('should update grid color and opacity', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setGridConfig({ color: '#FF0000', opacity: 0.8 });
      });

      expect(result.current.gridConfig.color).toBe('#FF0000');
      expect(result.current.gridConfig.opacity).toBe(0.8);
    });
  });

  describe('label management', () => {
    it('should add a new label', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.addLabel({
          text: 'New Label',
          x: 150,
          y: 150,
        });
      });

      expect(result.current.labels.length).toBe(1);
      expect(result.current.labels[0].text).toBe('New Label');
      expect(result.current.labels[0].id).toBeDefined();
      expect(result.current.isDirty).toBe(true);
    });

    it('should update an existing label', () => {
      const initialLabels: MapLabel[] = [
        {
          id: 'label-1',
          text: 'Original',
          x: 100,
          y: 100,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];

      const { result } = renderHook(() =>
        useMapCanvas({ ...defaultConfig, initialLabels })
      );

      act(() => {
        result.current.updateLabel('label-1', { text: 'Updated' });
      });

      expect(result.current.labels[0].text).toBe('Updated');
    });

    it('should remove a label', () => {
      const initialLabels: MapLabel[] = [
        {
          id: 'label-1',
          text: 'To Remove',
          x: 100,
          y: 100,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];

      const { result } = renderHook(() =>
        useMapCanvas({ ...defaultConfig, initialLabels })
      );

      act(() => {
        result.current.removeLabel('label-1');
      });

      expect(result.current.labels.length).toBe(0);
    });

    it('should set all labels at once', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      const newLabels: MapLabel[] = [
        {
          id: 'label-1',
          text: 'Label 1',
          x: 100,
          y: 100,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
        {
          id: 'label-2',
          text: 'Label 2',
          x: 200,
          y: 200,
          rotation: 45,
          fontFamily: 'Cinzel',
          fontSize: 18,
          color: '#FF0000',
        },
      ];

      act(() => {
        result.current.setLabels(newLabels);
      });

      expect(result.current.labels).toEqual(newLabels);
    });
  });

  describe('view state', () => {
    it('should update view state', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setView({ zoom: 1.5, panX: 100, panY: 50 });
      });

      expect(result.current.view.zoom).toBe(1.5);
      expect(result.current.view.panX).toBe(100);
      expect(result.current.view.panY).toBe(50);
    });

    it('should reset view to default', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setView({ zoom: 2, panX: 200, panY: 100 });
      });

      act(() => {
        result.current.resetView();
      });

      expect(result.current.view.zoom).toBe(1);
      expect(result.current.view.panX).toBe(0);
      expect(result.current.view.panY).toBe(0);
    });
  });

  describe('dirty state', () => {
    it('should mark as dirty on changes', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setGridConfig({ visible: true });
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should clear dirty state', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setGridConfig({ visible: true });
      });

      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.clearDirty();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('mode management', () => {
    it('should start in view mode', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      expect(result.current.mode).toBe('view');
    });

    it('should switch to label mode', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setMode('label');
      });

      expect(result.current.mode).toBe('label');
    });

    it('should switch to grid-adjust mode', () => {
      const { result } = renderHook(() => useMapCanvas(defaultConfig));

      act(() => {
        result.current.setMode('grid-adjust');
      });

      expect(result.current.mode).toBe('grid-adjust');
    });
  });
});
