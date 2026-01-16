/**
 * Map Canvas State Management
 *
 * Reducer-based state management for MapCanvasState.
 * Handles project loading, updates, view state, and UI state.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/**
 * Create initial map canvas state
 */
export function createInitialState() {
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
export function mapStateReducer(state, action) {
    switch (action.type) {
        case 'LOAD_PROJECT':
            return __assign(__assign({}, state), { project: action.payload, isDirty: false, selectedLabelId: null, error: null });
        case 'UPDATE_PROJECT':
            if (!state.project) {
                // Can't update if no project loaded
                return state;
            }
            return __assign(__assign({}, state), { project: __assign(__assign(__assign({}, state.project), action.payload), { updatedAt: new Date().toISOString() }), isDirty: true });
        case 'UPDATE_VIEW':
            return __assign(__assign({}, state), { view: __assign(__assign({}, state.view), action.payload) });
        case 'SET_MODE':
            return __assign(__assign({}, state), { mode: action.payload, 
                // Clear label selection when exiting label mode
                selectedLabelId: action.payload !== 'label' ? null : state.selectedLabelId });
        case 'SELECT_LABEL':
            return __assign(__assign({}, state), { selectedLabelId: action.payload });
        case 'SET_LOADING':
            return __assign(__assign({}, state), { isLoading: action.payload });
        case 'SET_ERROR':
            return __assign(__assign({}, state), { error: action.payload });
        case 'MARK_SAVED':
            return __assign(__assign({}, state), { isDirty: false });
        default:
            return state;
    }
}
