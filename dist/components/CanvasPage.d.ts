import React from 'react';
import type { CanvasLayoutEntry, LayoutPlan } from '../layout/types';
export interface CanvasPageProps {
    layoutPlan: LayoutPlan | null | undefined;
    renderEntry: (entry: CanvasLayoutEntry) => React.ReactNode;
    /**
     * Column width in pixels for structural styles.
     * When provided, columns use inline structural styles to guarantee
     * measurement layer width === visible layer width.
     * Phase 1: Measurement Perfection
     */
    columnWidthPx?: number;
}
declare const CanvasPage: React.FC<CanvasPageProps>;
export { CanvasPage };
//# sourceMappingURL=CanvasPage.d.ts.map