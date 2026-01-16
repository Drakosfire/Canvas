/**
 * MapViewport Component
 *
 * Main Konva Stage component for map rendering.
 * Renders 3 layers in fixed z-order:
 * 1. Base Image Layer (non-interactive)
 * 2. Grid Overlay Layer (non-interactive)
 * 3. Labels Layer (interactive, draggable)
 */
import { GridConfig, MapLabel, MapEditMode } from '../types/map.types';
import type { MaskStroke, MaskTool } from '../types/mask.types';
import { LabelEditInfo } from './LabelLayer';
export interface MapViewportProps {
    /** Viewport width in pixels */
    width: number;
    /** Viewport height in pixels */
    height: number;
    /** URL to base map image */
    baseImageUrl: string;
    /** Grid overlay configuration */
    gridConfig: GridConfig;
    /** Array of text labels */
    labels: MapLabel[];
    /** Currently selected label ID */
    selectedLabelId?: string | null;
    /** Callback when a label is selected */
    onLabelSelect?: (id: string | null) => void;
    /** Callback when a label is updated (dragged, edited) */
    onLabelUpdate: (id: string, updates: Partial<MapLabel>) => void;
    /** Callback when a label is deleted */
    onLabelDelete?: (id: string) => void;
    /** Callback when a new label should be placed (click-to-place in label mode) */
    onLabelPlace?: (x: number, y: number) => void;
    /** Current zoom level (1 = 100%) */
    zoom?: number;
    /** Pan offset X */
    panX?: number;
    /** Pan offset Y */
    panY?: number;
    /** Callback when view changes (pan/zoom) */
    onViewChange?: (view: {
        zoom: number;
        panX: number;
        panY: number;
    }) => void;
    /** Current editing mode (for grid adjustment) */
    mode?: MapEditMode;
    /** Callback when grid offset changes (in grid-adjust mode) */
    onGridOffsetChange?: (offset: {
        offsetX: number;
        offsetY: number;
    }) => void;
    /** Callback when inline label editing starts */
    onStartEditing?: (editInfo: LabelEditInfo) => void;
    /** Label currently being edited (hides Konva text during edit) */
    editingLabelId?: string | null;
    /** Whether mask mode is enabled */
    maskEnabled?: boolean;
    /** Mask strokes to render */
    maskStrokes?: MaskStroke[];
    /** Current mask stroke being drawn */
    maskCurrentStroke?: MaskStroke | null;
    /** Active mask tool */
    maskActiveTool?: MaskTool;
    /** Mask brush size */
    maskBrushSize?: number;
    /** Whether currently drawing mask */
    maskIsDrawing?: boolean;
    /** Callback when mask stroke starts */
    onMaskStrokeStart?: (x: number, y: number) => void;
    /** Callback when mask stroke continues */
    onMaskStrokeContinue?: (x: number, y: number) => void;
    /** Callback when mask stroke ends */
    onMaskStrokeEnd?: () => void;
    /** Callback when mask shape is added */
    onMaskShapeAdd?: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) => void;
}
/**
 * MapViewport renders a pannable, zoomable map canvas with:
 * - Base image layer
 * - Configurable grid overlay (square or hex)
 * - Draggable text labels
 */
export declare function MapViewport({ width, height, baseImageUrl, gridConfig, labels, selectedLabelId, onLabelSelect, onLabelUpdate, onLabelDelete, onLabelPlace, zoom, panX, panY, onViewChange, mode, onGridOffsetChange, onStartEditing, editingLabelId, maskEnabled, maskStrokes, maskCurrentStroke, maskActiveTool, maskBrushSize, maskIsDrawing, onMaskStrokeStart, onMaskStrokeContinue, onMaskStrokeEnd, onMaskShapeAdd, }: MapViewportProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=MapViewport.d.ts.map