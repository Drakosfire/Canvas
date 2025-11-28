import React, { useEffect } from 'react';

import type { CanvasLayoutEntry, LayoutPlan } from '../layout/types';
import { isDebugEnabled } from '../layout/debugFlags';
import { createColumnStructuralStyles } from '../layout/structuralStyles';

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

const CanvasPage: React.FC<CanvasPageProps> = ({ layoutPlan, renderEntry, columnWidthPx }) => {
    // Debug: Log plan details when rendering (gated behind plan-commit flag)
    useEffect(() => {
        if (layoutPlan && layoutPlan.pages.length > 0 && isDebugEnabled('plan-commit')) {
            // Check both ID formats: 'component-05' and 'component-5'
            const findComponent05 = (entries: CanvasLayoutEntry[]) =>
                entries.find((e) => e.instance.id === 'component-05' || e.instance.id === 'component-5');

            const component05Entry = findComponent05(layoutPlan.pages[0]?.columns[0]?.entries ?? []);
            const component05EntryCol2 = findComponent05(layoutPlan.pages[0]?.columns[1]?.entries ?? []);

            // eslint-disable-next-line no-console
            console.log('🎨 [CanvasPage] Rendering plan:', {
                runId: (layoutPlan as any).runId ?? 'unknown',
                pageCount: layoutPlan.pages.length,
                component05InCol1: component05Entry ? {
                    id: component05Entry.instance.id,
                    spanTop: component05Entry.span?.top,
                    spanBottom: component05Entry.span?.bottom,
                    spanHeight: component05Entry.span?.height,
                    region: component05Entry.region,
                    columnEntries: layoutPlan.pages[0]?.columns[0]?.entries.length ?? 0,
                } : null,
                component05InCol2: component05EntryCol2 ? {
                    id: component05EntryCol2.instance.id,
                    spanTop: component05EntryCol2.span?.top,
                    spanBottom: component05EntryCol2.span?.bottom,
                    spanHeight: component05EntryCol2.span?.height,
                    region: component05EntryCol2.region,
                    columnEntries: layoutPlan.pages[0]?.columns[1]?.entries.length ?? 0,
                } : null,
                allComponent05Entries: layoutPlan.pages.flatMap((page) =>
                    page.columns.flatMap((col) =>
                        col.entries.filter((e) => e.instance.id === 'component-05' || e.instance.id === 'component-5').map((e) => ({
                            id: e.instance.id,
                            page: page.pageNumber,
                            column: col.columnNumber,
                            spanTop: e.span?.top,
                            spanBottom: e.span?.bottom,
                            region: e.region,
                        }))
                    )
                ),
            });
        }
    }, [layoutPlan]);

    if (!layoutPlan || layoutPlan.pages.length === 0) {
        // Render skeleton while waiting for measurements and layout plan
        return (
            <div className="dm-canvas-skeleton" style={{
                width: '100%',
                height: '1056px', // Standard page height
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '14px',
            }}>
                <div>Measuring components...</div>
            </div>
        );
    }

    const showPaginationMarker = layoutPlan.pages.length > 1;

    return (
        <>
            {layoutPlan.pages.map((page) => (
                <div key={`page-${page.pageNumber}`} className="page phb" data-page-number={page.pageNumber}>
                    {showPaginationMarker && (
                        <div className="dm-pagination-marker" data-testid={`pagination-marker-${page.pageNumber}`}>
                            Page {page.pageNumber}
                        </div>
                    )}
                    <div className="columnWrapper">
                        <div className="monster frame wide" data-page-columns={page.columns.length}>
                            {page.columns.map((column) => (
                                <div 
                                    key={column.key} 
                                    className="canvas-column" 
                                    data-column-key={column.key} 
                                    data-column-number={column.columnNumber}
                                    style={columnWidthPx != null ? createColumnStructuralStyles(columnWidthPx) : undefined}
                                >
                                    {column.entries.map((entry, index) => (
                                        <div
                                            key={`${entry.instance.id}:${entry.region?.page ?? page.pageNumber}:${entry.region?.index ?? index}`}
                                            className="canvas-entry"
                                            data-entry-id={entry.instance.id}
                                            data-measurement-key={entry.measurementKey}
                                            data-start-index={entry.regionContent?.startIndex ?? 0}
                                            data-is-continuation={entry.regionContent?.isContinuation ?? false}
                                            data-span-top={entry.span?.top ?? 'undefined'}
                                            data-span-bottom={entry.span?.bottom ?? 'undefined'}
                                            data-region-key={`${entry.region?.page ?? '?'}:${entry.region?.column ?? '?'}`}
                                        >
                                            {renderEntry(entry)}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
};

export { CanvasPage };


