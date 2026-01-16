/**
 * Map Project TypeScript Contracts
 *
 * These interfaces define the contract between frontend and backend
 * for the Map Generator feature.
 *
 * @module MapProject
 * @version 1.0.0
 */
// =============================================================================
// DEFAULT VALUES
// =============================================================================
export var DEFAULT_GRID_CONFIG = {
    type: 'square',
    cellSizePx: 50,
    offsetX: 0,
    offsetY: 0,
    color: '#000000',
    opacity: 0.5,
    visible: false,
};
export var DEFAULT_SCALE_METADATA = {
    cellSize: 5,
    unit: 'ft',
};
export var FONT_OPTIONS = [
    'MedievalSharp',
    'Pirata One',
    'Uncial Antiqua',
    'Cinzel',
    'IM Fell English',
];
export var ROTATION_OPTIONS = [0, 45, 90, 135, 180, 225, 270, 315];
