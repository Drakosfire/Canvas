/**
 * useMaskDrawing Hook
 *
 * Manages mask drawing state for region-specific generation.
 * Implements TDD tests from T151-T155.
 */
import type { MaskDrawingState, MaskDrawingActions } from '../types/mask.types';
export interface UseMaskDrawingResult {
    state: MaskDrawingState;
    actions: MaskDrawingActions;
}
export declare function useMaskDrawing(): UseMaskDrawingResult;
//# sourceMappingURL=useMaskDrawing.d.ts.map