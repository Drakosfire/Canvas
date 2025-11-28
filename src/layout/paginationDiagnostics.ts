/**
 * Pagination Diagnostics
 * 
 * Scripts to observe and document pagination issues.
 * Run these in browser console to diagnose overflow problems.
 * 
 * Phase 4: Pagination Polish - Issue tracking
 */

export interface ColumnOverflowReport {
    columnIndex: number;
    pageIndex: number;
    scrollHeight: number;
    clientHeight: number;
    overflow: number;
    entries: Array<{
        id: string;
        measuredHeight: number;
        actualHeight: number;
        heightDiff: number;
        spanTop: number;
        spanBottom: number;
    }>;
    totalMeasuredHeight: number;
    totalActualHeight: number;
}

export interface PaginationDiagnosticReport {
    timestamp: string;
    pageCount: number;
    totalComponents: number;
    columnsWithOverflow: number;
    overflowDetails: ColumnOverflowReport[];
    recommendations: string[];
}

/**
 * Diagnose all columns for overflow issues.
 * Run in browser console: window.__CANVAS_PAGINATION__.diagnose()
 */
export const diagnosePagination = (): PaginationDiagnosticReport => {
    const columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    const overflowDetails: ColumnOverflowReport[] = [];
    const recommendations: string[] = [];
    
    columns.forEach((col, idx) => {
        const htmlCol = col as HTMLElement;
        const scrollHeight = htmlCol.scrollHeight;
        const clientHeight = htmlCol.clientHeight;
        const overflow = scrollHeight - clientHeight;
        
        if (overflow > 1) {
            // Get entries in this column
            const entries = col.querySelectorAll('.canvas-entry');
            const entryDetails: ColumnOverflowReport['entries'] = [];
            let totalMeasured = 0;
            let totalActual = 0;
            
            entries.forEach((entry) => {
                const htmlEntry = entry as HTMLElement;
                const id = htmlEntry.dataset.entryId || 'unknown';
                const spanTop = parseFloat(htmlEntry.dataset.spanTop || '0');
                const spanBottom = parseFloat(htmlEntry.dataset.spanBottom || '0');
                const measuredHeight = spanBottom - spanTop;
                const actualHeight = htmlEntry.getBoundingClientRect().height;
                
                entryDetails.push({
                    id,
                    measuredHeight: Math.round(measuredHeight * 100) / 100,
                    actualHeight: Math.round(actualHeight * 100) / 100,
                    heightDiff: Math.round((actualHeight - measuredHeight) * 100) / 100,
                    spanTop: Math.round(spanTop * 100) / 100,
                    spanBottom: Math.round(spanBottom * 100) / 100,
                });
                
                totalMeasured += measuredHeight;
                totalActual += actualHeight;
            });
            
            // Determine page index from the column's parent
            const page = col.closest('.page');
            const pageIndex = page ? 
                Array.from(document.querySelectorAll('.dm-canvas-responsive .page')).indexOf(page) : -1;
            
            overflowDetails.push({
                columnIndex: idx,
                pageIndex,
                scrollHeight,
                clientHeight,
                overflow,
                entries: entryDetails,
                totalMeasuredHeight: Math.round(totalMeasured * 100) / 100,
                totalActualHeight: Math.round(totalActual * 100) / 100,
            });
            
            // Find the culprit component
            const culprit = entryDetails.find(e => e.heightDiff > 5);
            if (culprit) {
                recommendations.push(`Column ${idx}: Component ${culprit.id} grew by ${culprit.heightDiff}px after measurement`);
            }
        }
    });
    
    // Generate recommendations
    if (overflowDetails.length > 0) {
        recommendations.push(`Total overflow columns: ${overflowDetails.length}`);
        
        const avgOverflow = overflowDetails.reduce((sum, d) => sum + d.overflow, 0) / overflowDetails.length;
        if (avgOverflow < 20) {
            recommendations.push('Small overflows (<20px) - likely CSS margin/padding inconsistency');
        } else if (avgOverflow < 100) {
            recommendations.push('Medium overflows (20-100px) - likely measurement timing or font loading issue');
        } else {
            recommendations.push('Large overflows (>100px) - likely component height estimation problem');
        }
    }
    
    return {
        timestamp: new Date().toISOString(),
        pageCount: document.querySelectorAll('.dm-canvas-responsive .page').length,
        totalComponents: document.querySelectorAll('.dm-canvas-responsive .canvas-entry').length,
        columnsWithOverflow: overflowDetails.length,
        overflowDetails,
        recommendations,
    };
};

/**
 * Quick check - just log overflow status to console.
 * Run: window.__CANVAS_PAGINATION__.quickCheck()
 */
export const quickCheck = (): void => {
    const columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    let hasOverflow = false;
    
    console.log('=== PAGINATION QUICK CHECK ===');
    columns.forEach((col, idx) => {
        const htmlCol = col as HTMLElement;
        const overflow = htmlCol.scrollHeight - htmlCol.clientHeight;
        const status = overflow > 1 ? '❌' : '✅';
        if (overflow > 1) {
            hasOverflow = true;
            console.log(`Column ${idx}: ${status} overflow=${overflow}px`);
            
            // Log the entries in this column
            const entries = col.querySelectorAll('.canvas-entry');
            entries.forEach((entry) => {
                const htmlEntry = entry as HTMLElement;
                const id = htmlEntry.dataset.entryId || 'unknown';
                console.log(`  - ${id}`);
            });
        }
    });
    
    if (!hasOverflow) {
        console.log('✅ All columns fit!');
    }
};

/**
 * Watch for overflow changes over time.
 * Useful for catching timing-related issues.
 * Run: window.__CANVAS_PAGINATION__.watch(5000) // Watch for 5 seconds
 */
export const watchOverflow = (durationMs: number = 5000): void => {
    const startTime = Date.now();
    const snapshots: Array<{ time: number; overflows: number[] }> = [];
    
    console.log(`=== WATCHING OVERFLOW for ${durationMs}ms ===`);
    
    const interval = setInterval(() => {
        const columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
        const overflows: number[] = [];
        
        columns.forEach((col) => {
            const htmlCol = col as HTMLElement;
            overflows.push(htmlCol.scrollHeight - htmlCol.clientHeight);
        });
        
        snapshots.push({ time: Date.now() - startTime, overflows });
        
        if (Date.now() - startTime >= durationMs) {
            clearInterval(interval);
            
            console.log('=== OVERFLOW WATCH RESULTS ===');
            console.log(`Snapshots taken: ${snapshots.length}`);
            
            // Find columns that changed
            const colCount = snapshots[0]?.overflows.length || 0;
            for (let i = 0; i < colCount; i++) {
                const values = snapshots.map(s => s.overflows[i]);
                const min = Math.min(...values);
                const max = Math.max(...values);
                if (max > 1) {
                    console.log(`Column ${i}: overflow ${min}→${max}px (${max - min}px change)`);
                }
            }
        }
    }, 100);
};

/**
 * Get detailed info about a specific component.
 * Run: window.__CANVAS_PAGINATION__.inspectComponent('component-11')
 */
export const inspectComponent = (componentId: string): void => {
    const entry = document.querySelector(`[data-entry-id="${componentId}"]`) as HTMLElement;
    
    if (!entry) {
        console.log(`Component ${componentId} not found in DOM`);
        return;
    }
    
    const rect = entry.getBoundingClientRect();
    const computed = window.getComputedStyle(entry);
    const spanTop = parseFloat(entry.dataset.spanTop || '0');
    const spanBottom = parseFloat(entry.dataset.spanBottom || '0');
    const measuredHeight = spanBottom - spanTop;
    
    console.log(`=== COMPONENT: ${componentId} ===`);
    console.log('Dataset:', {
        entryId: entry.dataset.entryId,
        measurementKey: entry.dataset.measurementKey,
        startIndex: entry.dataset.startIndex,
        isContinuation: entry.dataset.isContinuation,
        spanTop: entry.dataset.spanTop,
        spanBottom: entry.dataset.spanBottom,
        regionKey: entry.dataset.regionKey,
    });
    console.log('Measurements:', {
        measuredHeight: Math.round(measuredHeight * 100) / 100,
        actualHeight: Math.round(rect.height * 100) / 100,
        difference: Math.round((rect.height - measuredHeight) * 100) / 100,
    });
    console.log('Computed Style:', {
        marginTop: computed.marginTop,
        marginBottom: computed.marginBottom,
        paddingTop: computed.paddingTop,
        paddingBottom: computed.paddingBottom,
        boxSizing: computed.boxSizing,
    });
    console.log('Children:', entry.children.length);
    
    // Check for images that might not have loaded
    const images = entry.querySelectorAll('img');
    if (images.length > 0) {
        console.log('Images:', Array.from(images).map(img => ({
            src: img.src,
            complete: img.complete,
            naturalHeight: img.naturalHeight,
            displayHeight: img.height,
        })));
    }
};

/**
 * Expose diagnostics API on window.
 */
export const exposePaginationDiagnostics = (): void => {
    if (typeof window !== 'undefined') {
        (window as unknown as { __CANVAS_PAGINATION__: PaginationDiagnosticsAPI }).__CANVAS_PAGINATION__ = {
            diagnose: diagnosePagination,
            quickCheck,
            watch: watchOverflow,
            inspectComponent,
        };
        console.log('📊 Pagination diagnostics available: window.__CANVAS_PAGINATION__');
        console.log('   .quickCheck() - Quick overflow status');
        console.log('   .diagnose() - Full diagnostic report');
        console.log('   .watch(5000) - Watch for changes over time');
        console.log('   .inspectComponent("component-11") - Inspect specific component');
    }
};

export interface PaginationDiagnosticsAPI {
    diagnose: typeof diagnosePagination;
    quickCheck: typeof quickCheck;
    watch: typeof watchOverflow;
    inspectComponent: typeof inspectComponent;
}

// Type declaration for window augmentation
declare global {
    interface Window {
        __CANVAS_PAGINATION__?: PaginationDiagnosticsAPI;
    }
}

