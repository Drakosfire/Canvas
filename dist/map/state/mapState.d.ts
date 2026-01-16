/**
 * Map Canvas State Management
 *
 * Reducer-based state management for MapCanvasState.
 * Handles project loading, updates, view state, and UI state.
 */
import { MapCanvasState, MapProject, MapViewState, MapEditMode } from '../types/map.types';
/**
 * Actions for map state reducer
 */
export type MapStateAction = {
    type: 'LOAD_PROJECT';
    payload: MapProject;
} | {
    type: 'UPDATE_PROJECT';
    payload: Partial<MapProject>;
} | {
    type: 'UPDATE_VIEW';
    payload: Partial<MapViewState>;
} | {
    type: 'SET_MODE';
    payload: MapEditMode;
} | {
    type: 'SELECT_LABEL';
    payload: string | null;
} | {
    type: 'SET_LOADING';
    payload: boolean;
} | {
    type: 'SET_ERROR';
    payload: string | null;
} | {
    type: 'MARK_SAVED';
};
/**
 * Create initial map canvas state
 */
export declare function createInitialState(): MapCanvasState;
/**
 * Reducer for map canvas state
 */
export declare function mapStateReducer(state: MapCanvasState, action: MapStateAction): MapCanvasState;
//# sourceMappingURL=mapState.d.ts.map