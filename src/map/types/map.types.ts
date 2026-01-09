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
// CORE ENTITIES
// =============================================================================

/**
 * Grid pattern types supported by the map canvas
 */
export type GridType = 'square' | 'hex';

/**
 * Allowed rotation angles for labels (fixed increments)
 */
export type RotationAngle = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;

/**
 * Available fantasy fonts for map labels
 */
export type FontFamily = 
  | 'MedievalSharp' 
  | 'Pirata One' 
  | 'Uncial Antiqua' 
  | 'Cinzel' 
  | 'IM Fell English';

/**
 * Scale measurement units
 */
export type ScaleUnit = 'ft' | 'm' | 'squares';

/**
 * Grid overlay configuration
 */
export interface GridConfig {
  /** Grid pattern type */
  type: GridType;
  
  /** Cell size in pixels (10-200) */
  cellSizePx: number;
  
  /** Horizontal offset from origin in pixels */
  offsetX: number;
  
  /** Vertical offset from origin in pixels */
  offsetY: number;
  
  /** Line color as hex string (e.g., "#000000") */
  color: string;
  
  /** Line opacity (0-1) */
  opacity: number;
  
  /** Whether grid is visible */
  visible: boolean;
}

/**
 * A text annotation placed on the map
 */
export interface MapLabel {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Label text content (1-200 chars) */
  text: string;
  
  /** X position in pixels from left edge */
  x: number;
  
  /** Y position in pixels from top edge */
  y: number;
  
  /** Rotation angle in degrees */
  rotation: RotationAngle;
  
  /** Font family name */
  fontFamily: FontFamily;
  
  /** Font size in pixels (8-72) */
  fontSize: number;
  
  /** Text color as hex string */
  color: string;
  
  /** Stroke/outline color (optional) */
  strokeColor?: string;
  
  /** Stroke/outline width in pixels 0-5 (optional, default 0 = no stroke) */
  strokeWidth?: number;
  
  /** Whether drop shadow is enabled */
  shadowEnabled?: boolean;
  
  /** Shadow color as hex string (default #000000) */
  shadowColor?: string;
  
  /** Shadow blur radius 0-20 (default 4) */
  shadowBlur?: number;
  
  /** Shadow horizontal offset in pixels (default 2) */
  shadowOffsetX?: number;
  
  /** Shadow vertical offset in pixels (default 2) */
  shadowOffsetY?: number;
}

/**
 * Optional scale information for the map
 */
export interface ScaleMetadata {
  /** Size of one cell in game units */
  cellSize: number;
  
  /** Unit of measurement */
  unit: ScaleUnit;
}

/**
 * The root entity representing a saved map project
 */
export interface MapProject {
  /** Unique identifier (Firestore document ID) */
  id: string;
  
  /** User-provided project name (1-100 chars) */
  name: string;
  
  /** URL to base map image in Cloudflare R2 */
  baseImageUrl: string;
  
  /** Grid overlay configuration */
  gridConfig: GridConfig;
  
  /** Text labels placed on the map (max 100) */
  labels: MapLabel[];
  
  /** Optional scale information */
  scaleMetadata: ScaleMetadata | null;
  
  /** Owner user ID */
  userId: string;
  
  /** ISO 8601 creation timestamp */
  createdAt: string;
  
  /** ISO 8601 last update timestamp */
  updatedAt: string;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_GRID_CONFIG: GridConfig = {
  type: 'square',
  cellSizePx: 50,
  offsetX: 0,
  offsetY: 0,
  color: '#000000',
  opacity: 0.5,
  visible: false,
};

export const DEFAULT_SCALE_METADATA: ScaleMetadata = {
  cellSize: 5,
  unit: 'ft',
};

export const FONT_OPTIONS: FontFamily[] = [
  'MedievalSharp',
  'Pirata One',
  'Uncial Antiqua',
  'Cinzel',
  'IM Fell English',
];

export const ROTATION_OPTIONS: RotationAngle[] = [0, 45, 90, 135, 180, 225, 270, 315];

// =============================================================================
// API REQUEST TYPES
// =============================================================================

/**
 * Request to create a new map project
 */
export interface CreateMapProjectRequest {
  /** Project name */
  name: string;
  
  /** URL to base map image */
  baseImageUrl: string;
  
  /** Initial grid configuration (uses defaults if not provided) */
  gridConfig?: Partial<GridConfig>;
  
  /** Initial scale metadata */
  scaleMetadata?: ScaleMetadata;
}

/**
 * Request to update an existing map project
 */
export interface UpdateMapProjectRequest {
  /** Updated project name */
  name?: string;
  
  /** Updated grid configuration */
  gridConfig?: GridConfig;
  
  /** Updated labels array */
  labels?: MapLabel[];
  
  /** Updated scale metadata (null to remove) */
  scaleMetadata?: ScaleMetadata | null;
}

/**
 * Request to export a map as a flattened image
 */
export interface ExportMapRequest {
  /** Project ID to export (for authenticated users) */
  projectId?: string;
  
  /** Inline project data (for guest export) */
  project?: {
    baseImageUrl: string;
    gridConfig: GridConfig;
    labels: MapLabel[];
  };
  
  /** Export format */
  format: 'png' | 'jpeg';
  
  /** JPEG quality (1-100, ignored for PNG) */
  quality?: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response from project list endpoint
 */
export interface ListMapProjectsResponse {
  projects: MapProjectSummary[];
  total: number;
}

/**
 * Summary of a map project (for listing)
 */
export interface MapProjectSummary {
  id: string;
  name: string;
  baseImageUrl: string;
  updatedAt: string;
}

/**
 * Response from export endpoint
 */
export interface ExportMapResponse {
  /** URL to exported image (temporary, expires in 1 hour) */
  imageUrl: string;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Image width in pixels */
  width: number;
  
  /** Image height in pixels */
  height: number;
}

/**
 * Standard error response
 */
export interface MapApiError {
  /** Error code for programmatic handling */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Additional error details */
  details?: Record<string, unknown>;
}

// =============================================================================
// STATE TYPES (Frontend Only)
// =============================================================================

/**
 * Editing modes for the map canvas
 */
export type MapEditMode = 'view' | 'label' | 'grid-adjust' | 'mask';

/**
 * View state for pan/zoom
 */
export interface MapViewState {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  
  /** Pan offset X in pixels */
  panX: number;
  
  /** Pan offset Y in pixels */
  panY: number;
}

/**
 * Internal state for map canvas component
 */
export interface MapCanvasState {
  /** Current project data */
  project: MapProject | null;
  
  /** Current view state */
  view: MapViewState;
  
  /** Currently selected label ID */
  selectedLabelId: string | null;
  
  /** Current editing mode */
  mode: MapEditMode;
  
  /** Whether project has unsaved changes */
  isDirty: boolean;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error message if any */
  error: string | null;
}
