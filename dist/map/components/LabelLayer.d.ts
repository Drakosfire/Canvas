/**
 * LabelLayer Component (T063-T065)
 *
 * Renders text labels on the map with support for:
 * - Click-to-place labels (in label mode)
 * - Inline text editing (double-click)
 * - Dragging labels to reposition
 * - Selection with visual transformer
 */
import { MapLabel, MapEditMode } from '../types/map.types';
export interface LabelEditInfo {
    /** Label being edited */
    label: MapLabel;
    /** Absolute position on screen for HTML overlay */
    screenX: number;
    screenY: number;
    /** Current scale factor for sizing the input */
    scale: number;
}
export interface LabelLayerProps {
    /** Array of labels to render */
    labels: MapLabel[];
    /** Currently selected label ID */
    selectedLabelId: string | null;
    /** Callback when label is selected */
    onLabelSelect: (id: string | null) => void;
    /** Callback when label is updated (position, text, etc.) */
    onLabelUpdate: (id: string, updates: Partial<MapLabel>) => void;
    /** Callback when label is deleted */
    onLabelDelete?: (id: string) => void;
    /** Current editing mode */
    mode: MapEditMode;
    /** Callback when user clicks to place a new label (in label mode) */
    onLabelPlace?: (x: number, y: number) => void;
    /** Image width (for click-to-place hit area) */
    imageWidth?: number;
    /** Image height (for click-to-place hit area) */
    imageHeight?: number;
    /** Callback when inline editing starts (provides position for HTML overlay) */
    onStartEditing?: (editInfo: LabelEditInfo) => void;
    /** Label currently being edited (hide the Konva text while editing) */
    editingLabelId?: string | null;
}
/**
 * LabelLayer renders text labels on the map canvas.
 * Supports selection, dragging, and inline editing.
 */
export declare function LabelLayer({ labels, selectedLabelId, onLabelSelect, onLabelUpdate, onLabelDelete, mode, onLabelPlace, imageWidth, imageHeight, onStartEditing, editingLabelId, }: LabelLayerProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=LabelLayer.d.ts.map