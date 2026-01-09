/**
 * Tests for mapState reducer
 * 
 * Tests state management for MapCanvasState including:
 * - Project loading/saving
 * - View state (pan/zoom)
 * - Label selection
 * - Mode switching
 * - Dirty flag management
 */

import { describe, it, expect } from '@jest/globals';
import {
  MapCanvasState,
  MapProject,
  MapViewState,
  DEFAULT_GRID_CONFIG,
  DEFAULT_SCALE_METADATA,
} from '../../types/map.types';
import {
  mapStateReducer,
  MapStateAction,
  createInitialState,
} from '../mapState';

describe('mapStateReducer', () => {
  const mockProject: MapProject = {
    id: 'test-project-1',
    name: 'Test Map',
    baseImageUrl: 'https://example.com/map.png',
    gridConfig: DEFAULT_GRID_CONFIG,
    labels: [],
    scaleMetadata: DEFAULT_SCALE_METADATA,
    userId: 'user-123',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  describe('LOAD_PROJECT', () => {
    it('should load a project and reset dirty flag', () => {
      const initialState = createInitialState();
      const action: MapStateAction = {
        type: 'LOAD_PROJECT',
        payload: mockProject,
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.project).toEqual(mockProject);
      expect(newState.isDirty).toBe(false);
      expect(newState.error).toBeNull();
    });

    it('should clear selected label when loading new project', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        selectedLabelId: 'label-1',
      };

      const action: MapStateAction = {
        type: 'LOAD_PROJECT',
        payload: mockProject,
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.selectedLabelId).toBeNull();
    });
  });

  describe('UPDATE_PROJECT', () => {
    it('should update project fields and set dirty flag', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        project: mockProject,
      };

      const action: MapStateAction = {
        type: 'UPDATE_PROJECT',
        payload: {
          name: 'Updated Map Name',
        },
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.project?.name).toBe('Updated Map Name');
      expect(newState.isDirty).toBe(true);
    });

    it('should merge partial updates', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        project: mockProject,
      };

      const action: MapStateAction = {
        type: 'UPDATE_PROJECT',
        payload: {
          gridConfig: {
            ...DEFAULT_GRID_CONFIG,
            visible: true,
          },
        },
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.project?.gridConfig.visible).toBe(true);
      expect(newState.project?.name).toBe(mockProject.name); // Preserved
      expect(newState.isDirty).toBe(true);
    });

    it('should handle null scaleMetadata update', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        project: {
          ...mockProject,
          scaleMetadata: DEFAULT_SCALE_METADATA,
        },
      };

      const action: MapStateAction = {
        type: 'UPDATE_PROJECT',
        payload: {
          scaleMetadata: null,
        },
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.project?.scaleMetadata).toBeNull();
      expect(newState.isDirty).toBe(true);
    });
  });

  describe('UPDATE_VIEW', () => {
    it('should update view state (pan/zoom)', () => {
      const initialState = createInitialState();
      const newView: MapViewState = {
        zoom: 1.5,
        panX: 100,
        panY: 200,
      };

      const action: MapStateAction = {
        type: 'UPDATE_VIEW',
        payload: newView,
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.view).toEqual(newView);
      expect(newState.isDirty).toBe(false); // View changes don't mark dirty
    });

    it('should merge partial view updates', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        view: {
          zoom: 1.0,
          panX: 0,
          panY: 0,
        },
      };

      const action: MapStateAction = {
        type: 'UPDATE_VIEW',
        payload: {
          zoom: 2.0,
        },
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.view.zoom).toBe(2.0);
      expect(newState.view.panX).toBe(0); // Preserved
      expect(newState.view.panY).toBe(0); // Preserved
    });
  });

  describe('SET_MODE', () => {
    it('should change editing mode', () => {
      const initialState = createInitialState();
      const action: MapStateAction = {
        type: 'SET_MODE',
        payload: 'label',
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.mode).toBe('label');
    });

    it('should clear selected label when exiting label mode', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        mode: 'label',
        selectedLabelId: 'label-1',
      };

      const action: MapStateAction = {
        type: 'SET_MODE',
        payload: 'view',
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.mode).toBe('view');
      expect(newState.selectedLabelId).toBeNull();
    });
  });

  describe('SELECT_LABEL', () => {
    it('should set selected label ID', () => {
      const initialState = createInitialState();
      const action: MapStateAction = {
        type: 'SELECT_LABEL',
        payload: 'label-123',
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.selectedLabelId).toBe('label-123');
    });

    it('should clear selection when payload is null', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        selectedLabelId: 'label-123',
      };

      const action: MapStateAction = {
        type: 'SELECT_LABEL',
        payload: null,
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.selectedLabelId).toBeNull();
    });
  });

  describe('SET_LOADING', () => {
    it('should set loading state', () => {
      const initialState = createInitialState();
      const action: MapStateAction = {
        type: 'SET_LOADING',
        payload: true,
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.isLoading).toBe(true);
    });
  });

  describe('SET_ERROR', () => {
    it('should set error message', () => {
      const initialState = createInitialState();
      const action: MapStateAction = {
        type: 'SET_ERROR',
        payload: 'Something went wrong',
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.error).toBe('Something went wrong');
    });

    it('should clear error when payload is null', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        error: 'Previous error',
      };

      const action: MapStateAction = {
        type: 'SET_ERROR',
        payload: null,
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.error).toBeNull();
    });
  });

  describe('MARK_SAVED', () => {
    it('should clear dirty flag', () => {
      const initialState: MapCanvasState = {
        ...createInitialState(),
        isDirty: true,
      };

      const action: MapStateAction = {
        type: 'MARK_SAVED',
      };

      const newState = mapStateReducer(initialState, action);

      expect(newState.isDirty).toBe(false);
    });
  });

  describe('createInitialState', () => {
    it('should create initial state with defaults', () => {
      const state = createInitialState();

      expect(state.project).toBeNull();
      expect(state.view).toEqual({
        zoom: 1.0,
        panX: 0,
        panY: 0,
      });
      expect(state.selectedLabelId).toBeNull();
      expect(state.mode).toBe('view');
      expect(state.isDirty).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
