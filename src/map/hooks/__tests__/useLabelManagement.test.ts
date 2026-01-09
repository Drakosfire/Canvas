/**
 * useLabelManagement Hook Tests (TDD - T059)
 * 
 * Tests for the hook that manages label CRUD operations.
 */

import { renderHook, act } from '@testing-library/react';
import { useLabelManagement } from '../useLabelManagement';
import { MapLabel, FONT_OPTIONS, ROTATION_OPTIONS } from '../../types/map.types';

describe('useLabelManagement', () => {
  const initialLabels: MapLabel[] = [
    {
      id: 'label-1',
      text: 'Initial Label 1',
      x: 100,
      y: 200,
      rotation: 0,
      fontFamily: 'MedievalSharp',
      fontSize: 24,
      color: '#000000',
    },
    {
      id: 'label-2',
      text: 'Initial Label 2',
      x: 300,
      y: 400,
      rotation: 45,
      fontFamily: 'Pirata One',
      fontSize: 32,
      color: '#FF0000',
    },
  ];

  describe('initialization', () => {
    it('should initialize with empty labels array', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      expect(result.current.labels).toEqual([]);
      expect(result.current.selectedLabelId).toBeNull();
    });

    it('should initialize with provided labels', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      expect(result.current.labels).toEqual(initialLabels);
      expect(result.current.labels.length).toBe(2);
    });
  });

  describe('addLabel', () => {
    it('should add a new label with default values', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      act(() => {
        result.current.addLabel({
          text: 'New Label',
          x: 500,
          y: 600,
        });
      });
      
      expect(result.current.labels.length).toBe(1);
      const newLabel = result.current.labels[0];
      expect(newLabel.text).toBe('New Label');
      expect(newLabel.x).toBe(500);
      expect(newLabel.y).toBe(600);
      expect(newLabel.rotation).toBe(0);
      expect(newLabel.fontFamily).toBe('MedievalSharp');
      expect(newLabel.fontSize).toBe(24);
      expect(newLabel.color).toBe('#000000');
      expect(newLabel.id).toBeDefined();
    });

    it('should add a label with custom properties', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      act(() => {
        result.current.addLabel({
          text: 'Custom Label',
          x: 100,
          y: 200,
          rotation: 90,
          fontFamily: 'Cinzel',
          fontSize: 48,
          color: '#00FF00',
        });
      });
      
      const newLabel = result.current.labels[0];
      expect(newLabel.text).toBe('Custom Label');
      expect(newLabel.rotation).toBe(90);
      expect(newLabel.fontFamily).toBe('Cinzel');
      expect(newLabel.fontSize).toBe(48);
      expect(newLabel.color).toBe('#00FF00');
    });

    it('should generate unique IDs for each label', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      act(() => {
        result.current.addLabel({ text: 'Label 1', x: 100, y: 100 });
        result.current.addLabel({ text: 'Label 2', x: 200, y: 200 });
        result.current.addLabel({ text: 'Label 3', x: 300, y: 300 });
      });
      
      const ids = result.current.labels.map((l) => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('updateLabel', () => {
    it('should update an existing label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.updateLabel('label-1', {
          text: 'Updated Text',
          fontSize: 36,
        });
      });
      
      const updatedLabel = result.current.labels.find((l) => l.id === 'label-1');
      expect(updatedLabel?.text).toBe('Updated Text');
      expect(updatedLabel?.fontSize).toBe(36);
      expect(updatedLabel?.x).toBe(100); // Unchanged
      expect(updatedLabel?.y).toBe(200); // Unchanged
    });

    it('should update label position', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.updateLabel('label-1', {
          x: 500,
          y: 600,
        });
      });
      
      const updatedLabel = result.current.labels.find((l) => l.id === 'label-1');
      expect(updatedLabel?.x).toBe(500);
      expect(updatedLabel?.y).toBe(600);
    });

    it('should update label rotation', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.updateLabel('label-1', {
          rotation: 180,
        });
      });
      
      const updatedLabel = result.current.labels.find((l) => l.id === 'label-1');
      expect(updatedLabel?.rotation).toBe(180);
    });

    it('should not update non-existent label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      const initialCount = result.current.labels.length;
      
      act(() => {
        result.current.updateLabel('non-existent', {
          text: 'Should not exist',
        });
      });
      
      expect(result.current.labels.length).toBe(initialCount);
    });
  });

  describe('removeLabel', () => {
    it('should remove an existing label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      expect(result.current.labels.length).toBe(2);
      
      act(() => {
        result.current.removeLabel('label-1');
      });
      
      expect(result.current.labels.length).toBe(1);
      expect(result.current.labels.find((l) => l.id === 'label-1')).toBeUndefined();
      expect(result.current.labels.find((l) => l.id === 'label-2')).toBeDefined();
    });

    it('should clear selection when removing selected label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.selectLabel('label-1');
      });
      
      expect(result.current.selectedLabelId).toBe('label-1');
      
      act(() => {
        result.current.removeLabel('label-1');
      });
      
      expect(result.current.selectedLabelId).toBeNull();
    });

    it('should not remove non-existent label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      const initialCount = result.current.labels.length;
      
      act(() => {
        result.current.removeLabel('non-existent');
      });
      
      expect(result.current.labels.length).toBe(initialCount);
    });
  });

  describe('setLabels', () => {
    it('should replace all labels', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      const newLabels: MapLabel[] = [
        {
          id: 'new-1',
          text: 'New Label 1',
          x: 10,
          y: 20,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];
      
      act(() => {
        result.current.setLabels(newLabels);
      });
      
      expect(result.current.labels).toEqual(newLabels);
      expect(result.current.labels.length).toBe(1);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.setLabels([]);
      });
      
      expect(result.current.labels).toEqual([]);
    });
  });

  describe('selectLabel', () => {
    it('should select a label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.selectLabel('label-1');
      });
      
      expect(result.current.selectedLabelId).toBe('label-1');
    });

    it('should change selection to different label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.selectLabel('label-1');
      });
      
      expect(result.current.selectedLabelId).toBe('label-1');
      
      act(() => {
        result.current.selectLabel('label-2');
      });
      
      expect(result.current.selectedLabelId).toBe('label-2');
    });

    it('should clear selection when passing null', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      act(() => {
        result.current.selectLabel('label-1');
      });
      
      expect(result.current.selectedLabelId).toBe('label-1');
      
      act(() => {
        result.current.selectLabel(null);
      });
      
      expect(result.current.selectedLabelId).toBeNull();
    });
  });

  describe('getLabel', () => {
    it('should return label by ID', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      const label = result.current.getLabel('label-1');
      
      expect(label).toBeDefined();
      expect(label?.id).toBe('label-1');
      expect(label?.text).toBe('Initial Label 1');
    });

    it('should return null for non-existent label', () => {
      const { result } = renderHook(() => useLabelManagement({ initialLabels }));
      
      const label = result.current.getLabel('non-existent');
      
      expect(label).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle maximum labels (100)', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      act(() => {
        // Add 100 labels
        for (let i = 0; i < 100; i++) {
          result.current.addLabel({
            text: `Label ${i}`,
            x: i * 10,
            y: i * 10,
          });
        }
      });
      
      expect(result.current.labels.length).toBe(100);
    });

    it('should handle labels with all rotation angles', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      act(() => {
        ROTATION_OPTIONS.forEach((angle, index) => {
          result.current.addLabel({
            text: `Label ${angle}°`,
            x: index * 50,
            y: 100,
            rotation: angle,
          });
        });
      });
      
      expect(result.current.labels.length).toBe(ROTATION_OPTIONS.length);
      result.current.labels.forEach((label, index) => {
        expect(label.rotation).toBe(ROTATION_OPTIONS[index]);
      });
    });

    it('should handle labels with all font families', () => {
      const { result } = renderHook(() => useLabelManagement());
      
      act(() => {
        FONT_OPTIONS.forEach((font, index) => {
          result.current.addLabel({
            text: `Label ${font}`,
            x: index * 50,
            y: 100,
            fontFamily: font,
          });
        });
      });
      
      expect(result.current.labels.length).toBe(FONT_OPTIONS.length);
      result.current.labels.forEach((label, index) => {
        expect(label.fontFamily).toBe(FONT_OPTIONS[index]);
      });
    });
  });
});
