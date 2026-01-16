/**
 * Pagination Diagnostics
 *
 * Scripts to observe and document pagination issues.
 * Run these in browser console to diagnose overflow and utilization problems.
 *
 * Phase 4: Pagination Polish - Issue tracking & utilization metrics
 */
/**
 * Diagnose all columns for overflow issues.
 * Run in browser console: window.__CANVAS_PAGINATION__.diagnose()
 */
export var diagnosePagination = function () {
    var columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    var overflowDetails = [];
    var recommendations = [];
    columns.forEach(function (col, idx) {
        var htmlCol = col;
        var scrollHeight = htmlCol.scrollHeight;
        var clientHeight = htmlCol.clientHeight;
        var overflow = scrollHeight - clientHeight;
        if (overflow > 1) {
            // Get entries in this column
            var entries = col.querySelectorAll('.canvas-entry');
            var entryDetails_1 = [];
            var totalMeasured_1 = 0;
            var totalActual_1 = 0;
            entries.forEach(function (entry) {
                var htmlEntry = entry;
                var id = htmlEntry.dataset.entryId || 'unknown';
                var spanTop = parseFloat(htmlEntry.dataset.spanTop || '0');
                var spanBottom = parseFloat(htmlEntry.dataset.spanBottom || '0');
                var measuredHeight = spanBottom - spanTop;
                var actualHeight = htmlEntry.getBoundingClientRect().height;
                entryDetails_1.push({
                    id: id,
                    measuredHeight: Math.round(measuredHeight * 100) / 100,
                    actualHeight: Math.round(actualHeight * 100) / 100,
                    heightDiff: Math.round((actualHeight - measuredHeight) * 100) / 100,
                    spanTop: Math.round(spanTop * 100) / 100,
                    spanBottom: Math.round(spanBottom * 100) / 100,
                });
                totalMeasured_1 += measuredHeight;
                totalActual_1 += actualHeight;
            });
            // Determine page index from the column's parent
            var page = col.closest('.page');
            var pageIndex = page ?
                Array.from(document.querySelectorAll('.dm-canvas-responsive .page')).indexOf(page) : -1;
            overflowDetails.push({
                columnIndex: idx,
                pageIndex: pageIndex,
                scrollHeight: scrollHeight,
                clientHeight: clientHeight,
                overflow: overflow,
                entries: entryDetails_1,
                totalMeasuredHeight: Math.round(totalMeasured_1 * 100) / 100,
                totalActualHeight: Math.round(totalActual_1 * 100) / 100,
            });
            // Find the culprit component
            var culprit = entryDetails_1.find(function (e) { return e.heightDiff > 5; });
            if (culprit) {
                recommendations.push("Column ".concat(idx, ": Component ").concat(culprit.id, " grew by ").concat(culprit.heightDiff, "px after measurement"));
            }
        }
    });
    // Generate recommendations
    if (overflowDetails.length > 0) {
        recommendations.push("Total overflow columns: ".concat(overflowDetails.length));
        var avgOverflow = overflowDetails.reduce(function (sum, d) { return sum + d.overflow; }, 0) / overflowDetails.length;
        if (avgOverflow < 20) {
            recommendations.push('Small overflows (<20px) - likely CSS margin/padding inconsistency');
        }
        else if (avgOverflow < 100) {
            recommendations.push('Medium overflows (20-100px) - likely measurement timing or font loading issue');
        }
        else {
            recommendations.push('Large overflows (>100px) - likely component height estimation problem');
        }
    }
    return {
        timestamp: new Date().toISOString(),
        pageCount: document.querySelectorAll('.dm-canvas-responsive .page').length,
        totalComponents: document.querySelectorAll('.dm-canvas-responsive .canvas-entry').length,
        columnsWithOverflow: overflowDetails.length,
        overflowDetails: overflowDetails,
        recommendations: recommendations,
    };
};
/**
 * Quick check - just log overflow status to console.
 * Run: window.__CANVAS_PAGINATION__.quickCheck()
 */
export var quickCheck = function () {
    var columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    var hasOverflow = false;
    console.log('=== PAGINATION QUICK CHECK ===');
    columns.forEach(function (col, idx) {
        var htmlCol = col;
        var overflow = htmlCol.scrollHeight - htmlCol.clientHeight;
        var status = overflow > 1 ? '❌' : '✅';
        if (overflow > 1) {
            hasOverflow = true;
            console.log("Column ".concat(idx, ": ").concat(status, " overflow=").concat(overflow, "px"));
            // Log the entries in this column
            var entries = col.querySelectorAll('.canvas-entry');
            entries.forEach(function (entry) {
                var htmlEntry = entry;
                var id = htmlEntry.dataset.entryId || 'unknown';
                console.log("  - ".concat(id));
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
export var watchOverflow = function (durationMs) {
    if (durationMs === void 0) { durationMs = 5000; }
    var startTime = Date.now();
    var snapshots = [];
    console.log("=== WATCHING OVERFLOW for ".concat(durationMs, "ms ==="));
    var interval = setInterval(function () {
        var _a;
        var columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
        var overflows = [];
        columns.forEach(function (col) {
            var htmlCol = col;
            overflows.push(htmlCol.scrollHeight - htmlCol.clientHeight);
        });
        snapshots.push({ time: Date.now() - startTime, overflows: overflows });
        if (Date.now() - startTime >= durationMs) {
            clearInterval(interval);
            console.log('=== OVERFLOW WATCH RESULTS ===');
            console.log("Snapshots taken: ".concat(snapshots.length));
            // Find columns that changed
            var colCount = ((_a = snapshots[0]) === null || _a === void 0 ? void 0 : _a.overflows.length) || 0;
            var _loop_1 = function (i) {
                var values = snapshots.map(function (s) { return s.overflows[i]; });
                var min = Math.min.apply(Math, values);
                var max = Math.max.apply(Math, values);
                if (max > 1) {
                    console.log("Column ".concat(i, ": overflow ").concat(min, "\u2192").concat(max, "px (").concat(max - min, "px change)"));
                }
            };
            for (var i = 0; i < colCount; i++) {
                _loop_1(i);
            }
        }
    }, 100);
};
/**
 * Get column utilization report - Phase 4 A4
 * Run: window.__CANVAS_PAGINATION__.utilization()
 */
export var getUtilizationReport = function () {
    var columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    var columnReports = [];
    var warnings = [];
    var LOW_UTILIZATION_THRESHOLD = 0.5; // 50%
    columns.forEach(function (col, idx) {
        var htmlCol = col;
        var capacity = htmlCol.clientHeight;
        // Get entries and calculate used height
        var entries = col.querySelectorAll('.canvas-entry');
        var used = 0;
        var continuationCount = 0;
        entries.forEach(function (entry) {
            var htmlEntry = entry;
            var rect = htmlEntry.getBoundingClientRect();
            used += rect.height;
            if (htmlEntry.dataset.isContinuation === 'true') {
                continuationCount++;
            }
        });
        // Determine page index
        var page = col.closest('.page');
        var pageIndex = page ?
            Array.from(document.querySelectorAll('.dm-canvas-responsive .page')).indexOf(page) : -1;
        var utilization = capacity > 0 ? used / capacity : 0;
        var isBelowThreshold = utilization < LOW_UTILIZATION_THRESHOLD;
        columnReports.push({
            columnIndex: idx,
            pageIndex: pageIndex,
            capacity: Math.round(capacity),
            used: Math.round(used),
            utilization: Math.round(utilization * 100) / 100,
            componentCount: entries.length,
            continuationCount: continuationCount,
            isBelowThreshold: isBelowThreshold,
        });
        // Generate warnings for low utilization (but not last column)
        if (isBelowThreshold && idx < columns.length - 1 && entries.length > 0) {
            warnings.push("Column ".concat(idx, " (Page ").concat(pageIndex + 1, "): Only ").concat(Math.round(utilization * 100), "% utilized with ").concat(entries.length, " component(s)"));
        }
    });
    // Calculate summary stats
    var utilizations = columnReports.map(function (c) { return c.utilization; });
    var nonEmptyUtilizations = utilizations.filter(function (u) { return u > 0; });
    var avgUtilization = nonEmptyUtilizations.length > 0
        ? nonEmptyUtilizations.reduce(function (a, b) { return a + b; }, 0) / nonEmptyUtilizations.length
        : 0;
    var minUtilization = nonEmptyUtilizations.length > 0 ? Math.min.apply(Math, nonEmptyUtilizations) : 0;
    var maxUtilization = nonEmptyUtilizations.length > 0 ? Math.max.apply(Math, nonEmptyUtilizations) : 0;
    var variance = maxUtilization - minUtilization;
    var lowUtilizationColumns = columnReports.filter(function (c) { return c.isBelowThreshold && c.componentCount > 0; }).length;
    // Add summary warnings
    if (avgUtilization < 0.6 && columnReports.filter(function (c) { return c.componentCount > 0; }).length > 1) {
        warnings.push("Low average utilization: ".concat(Math.round(avgUtilization * 100), "% (target: 70%+)"));
    }
    if (variance > 0.5 && columnReports.filter(function (c) { return c.componentCount > 0; }).length > 1) {
        warnings.push("High variance: ".concat(Math.round(variance * 100), "% (columns not balanced)"));
    }
    return {
        timestamp: new Date().toISOString(),
        pageCount: document.querySelectorAll('.dm-canvas-responsive .page').length,
        columnCount: columns.length,
        averageUtilization: Math.round(avgUtilization * 100) / 100,
        minUtilization: Math.round(minUtilization * 100) / 100,
        maxUtilization: Math.round(maxUtilization * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        lowUtilizationColumns: lowUtilizationColumns,
        columns: columnReports,
        warnings: warnings,
    };
};
/**
 * Print utilization summary to console - Phase 4 A4
 * Run: window.__CANVAS_PAGINATION__.printUtilization()
 */
export var printUtilizationReport = function () {
    var report = getUtilizationReport();
    console.log('=== COLUMN UTILIZATION REPORT ===');
    console.log("Pages: ".concat(report.pageCount, ", Columns: ").concat(report.columnCount));
    console.log("Average: ".concat(Math.round(report.averageUtilization * 100), "% | Min: ").concat(Math.round(report.minUtilization * 100), "% | Max: ").concat(Math.round(report.maxUtilization * 100), "%"));
    console.log('');
    // Group by page
    var pageMap = new Map();
    report.columns.forEach(function (col) {
        var existing = pageMap.get(col.pageIndex) || [];
        existing.push(col);
        pageMap.set(col.pageIndex, existing);
    });
    pageMap.forEach(function (cols, pageIdx) {
        console.log("Page ".concat(pageIdx + 1, ":"));
        cols.forEach(function (col) {
            // Clamp utilization for the bar display (0-10 range)
            var clampedUtil = Math.max(0, Math.min(1, col.utilization));
            var filledBars = Math.round(clampedUtil * 10);
            var emptyBars = Math.max(0, 10 - filledBars);
            var bar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
            var overflowIndicator = col.utilization > 1 ? ' 🔴' : '';
            var warning = col.isBelowThreshold && col.componentCount > 0 ? ' ⚠️' : '';
            console.log("  Col ".concat(col.columnIndex % 2 + 1, ": ").concat(bar, " ").concat(Math.round(col.utilization * 100), "% (").concat(col.componentCount, " components)").concat(overflowIndicator).concat(warning));
        });
    });
    if (report.warnings.length > 0) {
        console.log('');
        console.log('⚠️ WARNINGS:');
        report.warnings.forEach(function (w) { return console.log("  - ".concat(w)); });
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
// Store for snapshots
var snapshotStore = new Map();
/**
 * Take a complete layout snapshot.
 * Run: window.__CANVAS_PAGINATION__.snapshot('before') or snapshot('after')
 */
export var takeSnapshot = function (label) {
    if (label === void 0) { label = 'snapshot'; }
    var pages = document.querySelectorAll('.dm-canvas-responsive .page');
    var entries = document.querySelectorAll('.dm-canvas-responsive .canvas-entry');
    var columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    var components = [];
    var overflowColumns = [];
    var columnUtilizations = [];
    // Collect all component data
    entries.forEach(function (entry) {
        var htmlEntry = entry;
        var rect = htmlEntry.getBoundingClientRect();
        // Find the column and page this entry is in
        var column = entry.closest('.canvas-column');
        var page = entry.closest('.page');
        var columnIndex = column ?
            Array.from(columns).indexOf(column) : -1;
        var pageIndex = page ?
            Array.from(pages).indexOf(page) : -1;
        var spanTop = parseFloat(htmlEntry.dataset.spanTop || '0');
        var spanBottom = parseFloat(htmlEntry.dataset.spanBottom || '0');
        var measuredHeight = spanBottom - spanTop;
        components.push({
            id: htmlEntry.dataset.entryId || 'unknown',
            measurementKey: htmlEntry.dataset.measurementKey || 'unknown',
            pageIndex: pageIndex,
            columnIndex: columnIndex,
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
    columns.forEach(function (col, idx) {
        var htmlCol = col;
        var capacity = htmlCol.clientHeight;
        var overflow = htmlCol.scrollHeight - capacity;
        if (overflow > 1) {
            overflowColumns.push(idx);
        }
        var colEntries = col.querySelectorAll('.canvas-entry');
        var used = 0;
        colEntries.forEach(function (entry) {
            var rect = entry.getBoundingClientRect();
            used += rect.height;
        });
        var page = col.closest('.page');
        var pageIndex = page ? Array.from(pages).indexOf(page) : -1;
        columnUtilizations.push({
            pageIndex: pageIndex,
            columnIndex: idx,
            utilization: capacity > 0 ? Math.round((used / capacity) * 100) / 100 : 0,
            componentCount: colEntries.length,
        });
    });
    var snapshot = {
        timestamp: new Date().toISOString(),
        label: label,
        pageCount: pages.length,
        totalComponents: entries.length,
        components: components,
        columnUtilizations: columnUtilizations,
        hasOverflow: overflowColumns.length > 0,
        overflowColumns: overflowColumns,
    };
    // Store the snapshot
    snapshotStore.set(label, snapshot);
    console.log("\uD83D\uDCF8 Snapshot \"".concat(label, "\" captured:"));
    console.log("   Pages: ".concat(snapshot.pageCount, ", Components: ").concat(snapshot.totalComponents));
    console.log("   Overflow: ".concat(snapshot.hasOverflow ? '❌ Yes (' + overflowColumns.join(', ') + ')' : '✅ No'));
    console.log("   Use: __CANVAS_PAGINATION__.getSnapshot(\"".concat(label, "\") to retrieve"));
    console.log("   Use: __CANVAS_PAGINATION__.compare(\"before\", \"after\") to diff");
    return snapshot;
};
/**
 * Get a stored snapshot.
 * Run: window.__CANVAS_PAGINATION__.getSnapshot('before')
 */
export var getSnapshot = function (label) {
    return snapshotStore.get(label);
};
/**
 * List all stored snapshots.
 */
export var listSnapshots = function () {
    return Array.from(snapshotStore.keys());
};
/**
 * Clear all stored snapshots.
 */
export var clearSnapshots = function () {
    snapshotStore.clear();
    console.log('🗑️ All snapshots cleared');
};
/**
 * Compare two snapshots and show differences.
 * Run: window.__CANVAS_PAGINATION__.compare('before', 'after')
 */
export var compareSnapshots = function (label1, label2) {
    var snap1 = snapshotStore.get(label1);
    var snap2 = snapshotStore.get(label2);
    if (!snap1) {
        console.error("Snapshot \"".concat(label1, "\" not found. Available: ").concat(listSnapshots().join(', ')));
        return;
    }
    if (!snap2) {
        console.error("Snapshot \"".concat(label2, "\" not found. Available: ").concat(listSnapshots().join(', ')));
        return;
    }
    console.log("\n=== COMPARING: \"".concat(label1, "\" vs \"").concat(label2, "\" ===\n"));
    // Summary differences
    console.log('📊 SUMMARY:');
    console.log("   Pages: ".concat(snap1.pageCount, " \u2192 ").concat(snap2.pageCount, " ").concat(snap1.pageCount !== snap2.pageCount ? '⚠️ CHANGED' : '✅'));
    console.log("   Components: ".concat(snap1.totalComponents, " \u2192 ").concat(snap2.totalComponents, " ").concat(snap1.totalComponents !== snap2.totalComponents ? '⚠️ CHANGED' : '✅'));
    console.log("   Overflow: ".concat(snap1.hasOverflow ? 'Yes' : 'No', " \u2192 ").concat(snap2.hasOverflow ? 'Yes' : 'No', " ").concat(snap1.hasOverflow !== snap2.hasOverflow ? '⚠️ CHANGED' : '✅'));
    console.log('');
    // Build lookup maps
    var snap1Map = new Map(snap1.components.map(function (c) { return [c.id, c]; }));
    var snap2Map = new Map(snap2.components.map(function (c) { return [c.id, c]; }));
    // Find placement changes
    var placementChanges = [];
    var heightChanges = [];
    var newComponents = [];
    var removedComponents = [];
    // Check for changes
    snap2.components.forEach(function (comp2) {
        var comp1 = snap1Map.get(comp2.id);
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
    snap1.components.forEach(function (comp1) {
        if (!snap2Map.has(comp1.id)) {
            removedComponents.push(comp1.id);
        }
    });
    // Report placement changes
    if (placementChanges.length > 0) {
        console.log('🔀 PLACEMENT CHANGES:');
        placementChanges.forEach(function (change) {
            console.log("   ".concat(change.id, ":"));
            console.log("      Page: ".concat(change.before.page + 1, " \u2192 ").concat(change.after.page + 1));
            console.log("      Column: ".concat(change.before.col + 1, " \u2192 ").concat(change.after.col + 1));
            console.log("      Top: ".concat(change.before.spanTop, "px \u2192 ").concat(change.after.spanTop, "px"));
        });
        console.log('');
    }
    else {
        console.log('✅ No placement changes\n');
    }
    // Report height changes
    if (heightChanges.length > 0) {
        console.log('📏 HEIGHT CHANGES:');
        heightChanges.forEach(function (change) {
            console.log("   ".concat(change.id, ":"));
            console.log("      Measured: ".concat(change.beforeMeasured, "px \u2192 ").concat(change.afterMeasured, "px (\u0394").concat(change.afterMeasured - change.beforeMeasured, ")"));
            console.log("      Actual: ".concat(change.beforeActual, "px \u2192 ").concat(change.afterActual, "px (\u0394").concat(change.afterActual - change.beforeActual, ")"));
        });
        console.log('');
    }
    else {
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
    var maxPages = Math.max(snap1.pageCount, snap2.pageCount);
    var _loop_2 = function (p) {
        console.log("   Page ".concat(p + 1, ":"));
        var snap1Cols = snap1.columnUtilizations.filter(function (c) { return c.pageIndex === p; });
        var snap2Cols = snap2.columnUtilizations.filter(function (c) { return c.pageIndex === p; });
        var maxCols = Math.max(snap1Cols.length, snap2Cols.length);
        var _loop_3 = function (c) {
            var col1 = snap1Cols.find(function (x) { return x.columnIndex % 2 === c; });
            var col2 = snap2Cols.find(function (x) { return x.columnIndex % 2 === c; });
            var u1 = col1 ? Math.round(col1.utilization * 100) : 0;
            var u2 = col2 ? Math.round(col2.utilization * 100) : 0;
            var diff = u2 - u1;
            var diffStr = diff !== 0 ? " (".concat(diff > 0 ? '+' : '').concat(diff, "%)") : '';
            console.log("      Col ".concat(c + 1, ": ").concat(u1, "% \u2192 ").concat(u2, "%").concat(diffStr));
        };
        for (var c = 0; c < maxCols; c++) {
            _loop_3(c);
        }
    };
    for (var p = 0; p < maxPages; p++) {
        _loop_2(p);
    }
};
/**
 * Get detailed info about a specific component.
 * Run: window.__CANVAS_PAGINATION__.inspectComponent('component-11')
 */
export var inspectComponent = function (componentId) {
    var entry = document.querySelector("[data-entry-id=\"".concat(componentId, "\"]"));
    if (!entry) {
        console.log("Component ".concat(componentId, " not found in DOM"));
        return;
    }
    var rect = entry.getBoundingClientRect();
    var computed = window.getComputedStyle(entry);
    var spanTop = parseFloat(entry.dataset.spanTop || '0');
    var spanBottom = parseFloat(entry.dataset.spanBottom || '0');
    var measuredHeight = spanBottom - spanTop;
    console.log("=== COMPONENT: ".concat(componentId, " ==="));
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
    var images = entry.querySelectorAll('img');
    if (images.length > 0) {
        console.log('Images:', Array.from(images).map(function (img) { return ({
            src: img.src,
            complete: img.complete,
            naturalHeight: img.naturalHeight,
            displayHeight: img.height,
        }); }));
    }
};
/**
 * Expose diagnostics API on window.
 */
export var exposePaginationDiagnostics = function () {
    if (typeof window !== 'undefined') {
        window.__CANVAS_PAGINATION__ = {
            diagnose: diagnosePagination,
            quickCheck: quickCheck,
            watch: watchOverflow,
            inspectComponent: inspectComponent,
            utilization: getUtilizationReport,
            printUtilization: printUtilizationReport,
            // Snapshot API for before/after comparison
            snapshot: takeSnapshot,
            getSnapshot: getSnapshot,
            listSnapshots: listSnapshots,
            clearSnapshots: clearSnapshots,
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
