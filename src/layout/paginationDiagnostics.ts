/**
 * Pagination Diagnostics
 * 
 * Scripts to observe and document pagination issues.
 * Run these in browser console to diagnose overflow and utilization problems.
 * 
 * Phase 4: Pagination Polish - Issue tracking & utilization metrics
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

/**
 * Column utilization report - Phase 4 A4
 */
export interface ColumnUtilizationReport {
    columnIndex: number;
    pageIndex: number;
    capacity: number;
    used: number;
    utilization: number;  // 0-1
    componentCount: number;
    continuationCount: number;
    isBelowThreshold: boolean;
}

/**
 * Overall utilization summary - Phase 4 A4
 */
export interface UtilizationSummary {
    timestamp: string;
    pageCount: number;
    columnCount: number;
    averageUtilization: number;
    minUtilization: number;
    maxUtilization: number;
    variance: number;
    lowUtilizationColumns: number;  // <50% utilization
    columns: ColumnUtilizationReport[];
    warnings: string[];
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
 * Get column utilization report - Phase 4 A4
 * Run: window.__CANVAS_PAGINATION__.utilization()
 */
export const getUtilizationReport = (): UtilizationSummary => {
    const columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    const columnReports: ColumnUtilizationReport[] = [];
    const warnings: string[] = [];
    const LOW_UTILIZATION_THRESHOLD = 0.5; // 50%
    
    columns.forEach((col, idx) => {
        const htmlCol = col as HTMLElement;
        const capacity = htmlCol.clientHeight;
        
        // Get entries and calculate used height
        const entries = col.querySelectorAll('.canvas-entry');
        let used = 0;
        let continuationCount = 0;
        
        entries.forEach((entry) => {
            const htmlEntry = entry as HTMLElement;
            const rect = htmlEntry.getBoundingClientRect();
            used += rect.height;
            
            if (htmlEntry.dataset.isContinuation === 'true') {
                continuationCount++;
            }
        });
        
        // Determine page index
        const page = col.closest('.page');
        const pageIndex = page ? 
            Array.from(document.querySelectorAll('.dm-canvas-responsive .page')).indexOf(page) : -1;
        
        const utilization = capacity > 0 ? used / capacity : 0;
        const isBelowThreshold = utilization < LOW_UTILIZATION_THRESHOLD;
        
        columnReports.push({
            columnIndex: idx,
            pageIndex,
            capacity: Math.round(capacity),
            used: Math.round(used),
            utilization: Math.round(utilization * 100) / 100,
            componentCount: entries.length,
            continuationCount,
            isBelowThreshold,
        });
        
        // Generate warnings for low utilization (but not last column)
        if (isBelowThreshold && idx < columns.length - 1 && entries.length > 0) {
            warnings.push(`Column ${idx} (Page ${pageIndex + 1}): Only ${Math.round(utilization * 100)}% utilized with ${entries.length} component(s)`);
        }
    });
    
    // Calculate summary stats
    const utilizations = columnReports.map(c => c.utilization);
    const nonEmptyUtilizations = utilizations.filter(u => u > 0);
    const avgUtilization = nonEmptyUtilizations.length > 0 
        ? nonEmptyUtilizations.reduce((a, b) => a + b, 0) / nonEmptyUtilizations.length 
        : 0;
    const minUtilization = nonEmptyUtilizations.length > 0 ? Math.min(...nonEmptyUtilizations) : 0;
    const maxUtilization = nonEmptyUtilizations.length > 0 ? Math.max(...nonEmptyUtilizations) : 0;
    const variance = maxUtilization - minUtilization;
    const lowUtilizationColumns = columnReports.filter(c => c.isBelowThreshold && c.componentCount > 0).length;
    
    // Add summary warnings
    if (avgUtilization < 0.6 && columnReports.filter(c => c.componentCount > 0).length > 1) {
        warnings.push(`Low average utilization: ${Math.round(avgUtilization * 100)}% (target: 70%+)`);
    }
    if (variance > 0.5 && columnReports.filter(c => c.componentCount > 0).length > 1) {
        warnings.push(`High variance: ${Math.round(variance * 100)}% (columns not balanced)`);
    }
    
    return {
        timestamp: new Date().toISOString(),
        pageCount: document.querySelectorAll('.dm-canvas-responsive .page').length,
        columnCount: columns.length,
        averageUtilization: Math.round(avgUtilization * 100) / 100,
        minUtilization: Math.round(minUtilization * 100) / 100,
        maxUtilization: Math.round(maxUtilization * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        lowUtilizationColumns,
        columns: columnReports,
        warnings,
    };
};

/**
 * Print utilization summary to console - Phase 4 A4
 * Run: window.__CANVAS_PAGINATION__.printUtilization()
 */
export const printUtilizationReport = (): void => {
    const report = getUtilizationReport();
    
    console.log('=== COLUMN UTILIZATION REPORT ===');
    console.log(`Pages: ${report.pageCount}, Columns: ${report.columnCount}`);
    console.log(`Average: ${Math.round(report.averageUtilization * 100)}% | Min: ${Math.round(report.minUtilization * 100)}% | Max: ${Math.round(report.maxUtilization * 100)}%`);
    console.log('');
    
    // Group by page
    const pageMap = new Map<number, ColumnUtilizationReport[]>();
    report.columns.forEach(col => {
        const existing = pageMap.get(col.pageIndex) || [];
        existing.push(col);
        pageMap.set(col.pageIndex, existing);
    });
    
    pageMap.forEach((cols, pageIdx) => {
        console.log(`Page ${pageIdx + 1}:`);
        cols.forEach(col => {
            // Clamp utilization for the bar display (0-10 range)
            const clampedUtil = Math.max(0, Math.min(1, col.utilization));
            const filledBars = Math.round(clampedUtil * 10);
            const emptyBars = Math.max(0, 10 - filledBars);
            const bar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
            const overflowIndicator = col.utilization > 1 ? ' 🔴' : '';
            const warning = col.isBelowThreshold && col.componentCount > 0 ? ' ⚠️' : '';
            console.log(`  Col ${col.columnIndex % 2 + 1}: ${bar} ${Math.round(col.utilization * 100)}% (${col.componentCount} components)${overflowIndicator}${warning}`);
        });
    });
    
    if (report.warnings.length > 0) {
        console.log('');
        console.log('⚠️ WARNINGS:');
        report.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    // Recommendations
    console.log('');
    if (report.variance > 0.3) {
        console.log('💡 Recommendation: Column balancing would improve layout');
    }
    if (report.lowUtilizationColumns > 0) {
        console.log('💡 Recommendation: Smarter split decisions could reduce wasted space');
    }
};

/**
 * Component snapshot for before/after comparison
 */
export interface ComponentSnapshot {
    id: string;
    measurementKey: string;
    pageIndex: number;
    columnIndex: number;
    regionKey: string;
    startIndex: number;
    isContinuation: boolean;
    spanTop: number;
    spanBottom: number;
    measuredHeight: number;
    actualHeight: number;
    heightDiff: number;
}

/**
 * Full layout snapshot for comparison
 */
export interface LayoutSnapshot {
    timestamp: string;
    label: string;
    pageCount: number;
    totalComponents: number;
    components: ComponentSnapshot[];
    columnUtilizations: Array<{
        pageIndex: number;
        columnIndex: number;
        utilization: number;
        componentCount: number;
    }>;
    hasOverflow: boolean;
    overflowColumns: number[];
}

// Store for snapshots
const snapshotStore: Map<string, LayoutSnapshot> = new Map();

/**
 * Take a complete layout snapshot.
 * Run: window.__CANVAS_PAGINATION__.snapshot('before') or snapshot('after')
 */
export const takeSnapshot = (label: string = 'snapshot'): LayoutSnapshot => {
    const pages = document.querySelectorAll('.dm-canvas-responsive .page');
    const entries = document.querySelectorAll('.dm-canvas-responsive .canvas-entry');
    const columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    
    const components: ComponentSnapshot[] = [];
    const overflowColumns: number[] = [];
    const columnUtilizations: LayoutSnapshot['columnUtilizations'] = [];
    
    // Collect all component data
    entries.forEach((entry) => {
        const htmlEntry = entry as HTMLElement;
        const rect = htmlEntry.getBoundingClientRect();
        
        // Find the column and page this entry is in
        const column = entry.closest('.canvas-column');
        const page = entry.closest('.page');
        const columnIndex = column ? 
            Array.from(columns).indexOf(column) : -1;
        const pageIndex = page ? 
            Array.from(pages).indexOf(page) : -1;
        
        const spanTop = parseFloat(htmlEntry.dataset.spanTop || '0');
        const spanBottom = parseFloat(htmlEntry.dataset.spanBottom || '0');
        const measuredHeight = spanBottom - spanTop;
        
        components.push({
            id: htmlEntry.dataset.entryId || 'unknown',
            measurementKey: htmlEntry.dataset.measurementKey || 'unknown',
            pageIndex,
            columnIndex,
            regionKey: htmlEntry.dataset.regionKey || 'unknown',
            startIndex: parseInt(htmlEntry.dataset.startIndex || '0', 10),
            isContinuation: htmlEntry.dataset.isContinuation === 'true',
            spanTop: Math.round(spanTop * 100) / 100,
            spanBottom: Math.round(spanBottom * 100) / 100,
            measuredHeight: Math.round(measuredHeight * 100) / 100,
            actualHeight: Math.round(rect.height * 100) / 100,
            heightDiff: Math.round((rect.height - measuredHeight) * 100) / 100,
        });
    });
    
    // Collect column utilization and overflow data
    columns.forEach((col, idx) => {
        const htmlCol = col as HTMLElement;
        const capacity = htmlCol.clientHeight;
        const overflow = htmlCol.scrollHeight - capacity;
        
        if (overflow > 1) {
            overflowColumns.push(idx);
        }
        
        const colEntries = col.querySelectorAll('.canvas-entry');
        let used = 0;
        colEntries.forEach((entry) => {
            const rect = (entry as HTMLElement).getBoundingClientRect();
            used += rect.height;
        });
        
        const page = col.closest('.page');
        const pageIndex = page ? Array.from(pages).indexOf(page) : -1;
        
        columnUtilizations.push({
            pageIndex,
            columnIndex: idx,
            utilization: capacity > 0 ? Math.round((used / capacity) * 100) / 100 : 0,
            componentCount: colEntries.length,
        });
    });
    
    const snapshot: LayoutSnapshot = {
        timestamp: new Date().toISOString(),
        label,
        pageCount: pages.length,
        totalComponents: entries.length,
        components,
        columnUtilizations,
        hasOverflow: overflowColumns.length > 0,
        overflowColumns,
    };
    
    // Store the snapshot
    snapshotStore.set(label, snapshot);
    
    console.log(`📸 Snapshot "${label}" captured:`);
    console.log(`   Pages: ${snapshot.pageCount}, Components: ${snapshot.totalComponents}`);
    console.log(`   Overflow: ${snapshot.hasOverflow ? '❌ Yes (' + overflowColumns.join(', ') + ')' : '✅ No'}`);
    console.log(`   Use: __CANVAS_PAGINATION__.getSnapshot("${label}") to retrieve`);
    console.log(`   Use: __CANVAS_PAGINATION__.compare("before", "after") to diff`);
    
    return snapshot;
};

/**
 * Get a stored snapshot.
 * Run: window.__CANVAS_PAGINATION__.getSnapshot('before')
 */
export const getSnapshot = (label: string): LayoutSnapshot | undefined => {
    return snapshotStore.get(label);
};

/**
 * List all stored snapshots.
 */
export const listSnapshots = (): string[] => {
    return Array.from(snapshotStore.keys());
};

/**
 * Clear all stored snapshots.
 */
export const clearSnapshots = (): void => {
    snapshotStore.clear();
    console.log('🗑️ All snapshots cleared');
};

/**
 * Compare two snapshots and show differences.
 * Run: window.__CANVAS_PAGINATION__.compare('before', 'after')
 */
export const compareSnapshots = (label1: string, label2: string): void => {
    const snap1 = snapshotStore.get(label1);
    const snap2 = snapshotStore.get(label2);
    
    if (!snap1) {
        console.error(`Snapshot "${label1}" not found. Available: ${listSnapshots().join(', ')}`);
        return;
    }
    if (!snap2) {
        console.error(`Snapshot "${label2}" not found. Available: ${listSnapshots().join(', ')}`);
        return;
    }
    
    console.log(`\n=== COMPARING: "${label1}" vs "${label2}" ===\n`);
    
    // Summary differences
    console.log('📊 SUMMARY:');
    console.log(`   Pages: ${snap1.pageCount} → ${snap2.pageCount} ${snap1.pageCount !== snap2.pageCount ? '⚠️ CHANGED' : '✅'}`);
    console.log(`   Components: ${snap1.totalComponents} → ${snap2.totalComponents} ${snap1.totalComponents !== snap2.totalComponents ? '⚠️ CHANGED' : '✅'}`);
    console.log(`   Overflow: ${snap1.hasOverflow ? 'Yes' : 'No'} → ${snap2.hasOverflow ? 'Yes' : 'No'} ${snap1.hasOverflow !== snap2.hasOverflow ? '⚠️ CHANGED' : '✅'}`);
    console.log('');
    
    // Build lookup maps
    const snap1Map = new Map(snap1.components.map(c => [c.id, c]));
    const snap2Map = new Map(snap2.components.map(c => [c.id, c]));
    
    // Find placement changes
    const placementChanges: Array<{
        id: string;
        before: { page: number; col: number; spanTop: number };
        after: { page: number; col: number; spanTop: number };
    }> = [];
    
    const heightChanges: Array<{
        id: string;
        beforeMeasured: number;
        afterMeasured: number;
        beforeActual: number;
        afterActual: number;
    }> = [];
    
    const newComponents: string[] = [];
    const removedComponents: string[] = [];
    
    // Check for changes
    snap2.components.forEach(comp2 => {
        const comp1 = snap1Map.get(comp2.id);
        
        if (!comp1) {
            newComponents.push(comp2.id);
            return;
        }
        
        // Check placement change
        if (comp1.pageIndex !== comp2.pageIndex || 
            comp1.columnIndex !== comp2.columnIndex ||
            Math.abs(comp1.spanTop - comp2.spanTop) > 1) {
            placementChanges.push({
                id: comp2.id,
                before: { page: comp1.pageIndex, col: comp1.columnIndex, spanTop: comp1.spanTop },
                after: { page: comp2.pageIndex, col: comp2.columnIndex, spanTop: comp2.spanTop },
            });
        }
        
        // Check height change
        if (Math.abs(comp1.measuredHeight - comp2.measuredHeight) > 1 ||
            Math.abs(comp1.actualHeight - comp2.actualHeight) > 1) {
            heightChanges.push({
                id: comp2.id,
                beforeMeasured: comp1.measuredHeight,
                afterMeasured: comp2.measuredHeight,
                beforeActual: comp1.actualHeight,
                afterActual: comp2.actualHeight,
            });
        }
    });
    
    snap1.components.forEach(comp1 => {
        if (!snap2Map.has(comp1.id)) {
            removedComponents.push(comp1.id);
        }
    });
    
    // Report placement changes
    if (placementChanges.length > 0) {
        console.log('🔀 PLACEMENT CHANGES:');
        placementChanges.forEach(change => {
            console.log(`   ${change.id}:`);
            console.log(`      Page: ${change.before.page + 1} → ${change.after.page + 1}`);
            console.log(`      Column: ${change.before.col + 1} → ${change.after.col + 1}`);
            console.log(`      Top: ${change.before.spanTop}px → ${change.after.spanTop}px`);
        });
        console.log('');
    } else {
        console.log('✅ No placement changes\n');
    }
    
    // Report height changes
    if (heightChanges.length > 0) {
        console.log('📏 HEIGHT CHANGES:');
        heightChanges.forEach(change => {
            console.log(`   ${change.id}:`);
            console.log(`      Measured: ${change.beforeMeasured}px → ${change.afterMeasured}px (Δ${change.afterMeasured - change.beforeMeasured})`);
            console.log(`      Actual: ${change.beforeActual}px → ${change.afterActual}px (Δ${change.afterActual - change.beforeActual})`);
        });
        console.log('');
    } else {
        console.log('✅ No height changes\n');
    }
    
    // Report new/removed components
    if (newComponents.length > 0) {
        console.log('➕ NEW COMPONENTS:', newComponents.join(', '));
    }
    if (removedComponents.length > 0) {
        console.log('➖ REMOVED COMPONENTS:', removedComponents.join(', '));
    }
    
    // Column utilization comparison
    console.log('\n📊 UTILIZATION COMPARISON:');
    const maxPages = Math.max(snap1.pageCount, snap2.pageCount);
    for (let p = 0; p < maxPages; p++) {
        console.log(`   Page ${p + 1}:`);
        const snap1Cols = snap1.columnUtilizations.filter(c => c.pageIndex === p);
        const snap2Cols = snap2.columnUtilizations.filter(c => c.pageIndex === p);
        
        const maxCols = Math.max(snap1Cols.length, snap2Cols.length);
        for (let c = 0; c < maxCols; c++) {
            const col1 = snap1Cols.find(x => x.columnIndex % 2 === c);
            const col2 = snap2Cols.find(x => x.columnIndex % 2 === c);
            
            const u1 = col1 ? Math.round(col1.utilization * 100) : 0;
            const u2 = col2 ? Math.round(col2.utilization * 100) : 0;
            const diff = u2 - u1;
            const diffStr = diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff}%)` : '';
            
            console.log(`      Col ${c + 1}: ${u1}% → ${u2}%${diffStr}`);
        }
    }
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
            utilization: getUtilizationReport,
            printUtilization: printUtilizationReport,
            // Snapshot API for before/after comparison
            snapshot: takeSnapshot,
            getSnapshot,
            listSnapshots,
            clearSnapshots,
            compare: compareSnapshots,
        };
        console.log('📊 Pagination diagnostics available: window.__CANVAS_PAGINATION__');
        console.log('   .quickCheck() - Quick overflow status');
        console.log('   .diagnose() - Full diagnostic report');
        console.log('   .watch(5000) - Watch for changes over time');
        console.log('   .inspectComponent("id") - Inspect specific component');
        console.log('   .utilization() - Get utilization report (Phase 4)');
        console.log('   .printUtilization() - Print utilization summary');
        console.log('   .snapshot("label") - Take layout snapshot');
        console.log('   .compare("before", "after") - Compare two snapshots');
    }
};

export interface PaginationDiagnosticsAPI {
    diagnose: typeof diagnosePagination;
    quickCheck: typeof quickCheck;
    watch: typeof watchOverflow;
    inspectComponent: typeof inspectComponent;
    utilization: typeof getUtilizationReport;
    printUtilization: typeof printUtilizationReport;
    snapshot: typeof takeSnapshot;
    getSnapshot: typeof getSnapshot;
    listSnapshots: typeof listSnapshots;
    clearSnapshots: typeof clearSnapshots;
    compare: typeof compareSnapshots;
}

// Type declaration for window augmentation
declare global {
    interface Window {
        __CANVAS_PAGINATION__?: PaginationDiagnosticsAPI;
    }
}

