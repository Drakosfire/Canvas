/**
 * Map Canvas State Management
 * 
 * Reducer-based state management for MapCanvasState.
 * Handles project loading, updates, view state, and UI state.
 */

import {
  MapCanvasState,
  MapProject,
  MapViewState,
  MapEditMode,
} from '../types/map.types';

/**
 * Actions for map state reducer
 */
export type MapStateAction =
  | { type: 'LOAD_PROJECT'; payload: MapProject }
  | { type: 'UPDATE_PROJECT'; payload: Partial<MapProject> }
  | { type: 'UPDATE_VIEW'; payload: Partial<MapViewState> }
  | { type: 'SET_MODE'; payload: MapEditMode }
  | { type: 'SELECT_LABEL'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'MARK_SAVED' };

/**
 * Create initial map canvas state
 */
export function createInitialState(): MapCanvasState {
  return {
    project: null,
    view: {
      zoom: 1.0,
      panX: 0,
      panY: 0,
    },
    selectedLabelId: null,
    mode: 'view',
    isDirty: false,
    isLoading: false,
    error: null,
  };
}

/**
 * Reducer for map canvas state
 */
export function mapStateReducer(
  state: MapCanvasState,
  action: MapStateAction
): MapCanvasState {
  switch (action.type) {
    case 'LOAD_PROJECT':
      return {
        ...state,
        project: action.payload,
        isDirty: false,
        selectedLabelId: null, // Clear selection when loading new project
        error: null,
      };

    case 'UPDATE_PROJECT':
      if (!state.project) {
        // Can't update if no project loaded
        return state;
      }
      return {
        ...state,
        project: {
          ...state.project,
          ...action.payload,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };

    case 'UPDATE_VIEW':
      return {
        ...state,
        view: {
          ...state.view,
          ...action.payload,
        },
        // View changes don't mark project as dirty
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        // Clear label selection when exiting label mode
        selectedLabelId:
          action.payload !== 'label' ? null : state.selectedLabelId,
      };

    case 'SELECT_LABEL':
      return {
        ...state,
        selectedLabelId: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'MARK_SAVED':
      return {
        ...state,
        isDirty: false,
      };

    default:
      return state;
  }
}
