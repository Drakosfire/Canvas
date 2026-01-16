var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { isDebugEnabled } from '../layout/debugFlags';
import { createColumnStructuralStyles } from '../layout/structuralStyles';
var CanvasPage = function (_a) {
    var layoutPlan = _a.layoutPlan, renderEntry = _a.renderEntry, columnWidthPx = _a.columnWidthPx;
    // Debug: Log plan details when rendering (gated behind plan-commit flag)
    useEffect(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        if (layoutPlan && layoutPlan.pages.length > 0 && isDebugEnabled('plan-commit')) {
            // Check both ID formats: 'component-05' and 'component-5'
            var findComponent05 = function (entries) {
                return entries.find(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; });
            };
            var component05Entry = findComponent05((_c = (_b = (_a = layoutPlan.pages[0]) === null || _a === void 0 ? void 0 : _a.columns[0]) === null || _b === void 0 ? void 0 : _b.entries) !== null && _c !== void 0 ? _c : []);
            var component05EntryCol2 = findComponent05((_f = (_e = (_d = layoutPlan.pages[0]) === null || _d === void 0 ? void 0 : _d.columns[1]) === null || _e === void 0 ? void 0 : _e.entries) !== null && _f !== void 0 ? _f : []);
            // eslint-disable-next-line no-console
            console.log('🎨 [CanvasPage] Rendering plan:', {
                runId: (_g = layoutPlan.runId) !== null && _g !== void 0 ? _g : 'unknown',
                pageCount: layoutPlan.pages.length,
                component05InCol1: component05Entry ? {
                    id: component05Entry.instance.id,
                    spanTop: (_h = component05Entry.span) === null || _h === void 0 ? void 0 : _h.top,
                    spanBottom: (_j = component05Entry.span) === null || _j === void 0 ? void 0 : _j.bottom,
                    spanHeight: (_k = component05Entry.span) === null || _k === void 0 ? void 0 : _k.height,
                    region: component05Entry.region,
                    columnEntries: (_o = (_m = (_l = layoutPlan.pages[0]) === null || _l === void 0 ? void 0 : _l.columns[0]) === null || _m === void 0 ? void 0 : _m.entries.length) !== null && _o !== void 0 ? _o : 0,
                } : null,
                component05InCol2: component05EntryCol2 ? {
                    id: component05EntryCol2.instance.id,
                    spanTop: (_p = component05EntryCol2.span) === null || _p === void 0 ? void 0 : _p.top,
                    spanBottom: (_q = component05EntryCol2.span) === null || _q === void 0 ? void 0 : _q.bottom,
                    spanHeight: (_r = component05EntryCol2.span) === null || _r === void 0 ? void 0 : _r.height,
                    region: component05EntryCol2.region,
                    columnEntries: (_u = (_t = (_s = layoutPlan.pages[0]) === null || _s === void 0 ? void 0 : _s.columns[1]) === null || _t === void 0 ? void 0 : _t.entries.length) !== null && _u !== void 0 ? _u : 0,
                } : null,
                allComponent05Entries: layoutPlan.pages.flatMap(function (page) {
                    return page.columns.flatMap(function (col) {
                        return col.entries.filter(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; }).map(function (e) {
                            var _a, _b;
                            return ({
                                id: e.instance.id,
                                page: page.pageNumber,
                                column: col.columnNumber,
                                spanTop: (_a = e.span) === null || _a === void 0 ? void 0 : _a.top,
                                spanBottom: (_b = e.span) === null || _b === void 0 ? void 0 : _b.bottom,
                                region: e.region,
                            });
                        });
                    });
                }),
            });
        }
    }, [layoutPlan]);
    if (!layoutPlan || layoutPlan.pages.length === 0) {
        // Render skeleton while waiting for measurements and layout plan
        return (_jsx("div", __assign({ className: "dm-canvas-skeleton", style: {
                width: '100%',
                height: '1056px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '14px',
            } }, { children: _jsx("div", { children: "Measuring components..." }) })));
    }
    var showPaginationMarker = layoutPlan.pages.length > 1;
    return (_jsx(_Fragment, { children: layoutPlan.pages.map(function (page) { return (_jsxs("div", __assign({ className: "page phb", "data-page-number": page.pageNumber }, { children: [showPaginationMarker && (_jsxs("div", __assign({ className: "dm-pagination-marker", "data-testid": "pagination-marker-".concat(page.pageNumber) }, { children: ["Page ", page.pageNumber] }))), _jsx("div", __assign({ className: "columnWrapper" }, { children: _jsx("div", __assign({ className: "monster frame wide", "data-page-columns": page.columns.length }, { children: page.columns.map(function (column) { return (_jsx("div", __assign({ className: "canvas-column", "data-column-key": column.key, "data-column-number": column.columnNumber, style: columnWidthPx != null ? createColumnStructuralStyles(columnWidthPx) : undefined }, { children: column.entries.map(function (entry, index) {
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
                                return (_jsx("div", __assign({ className: "canvas-entry", "data-entry-id": entry.instance.id, "data-measurement-key": entry.measurementKey, "data-start-index": (_b = (_a = entry.regionContent) === null || _a === void 0 ? void 0 : _a.startIndex) !== null && _b !== void 0 ? _b : 0, "data-is-continuation": (_d = (_c = entry.regionContent) === null || _c === void 0 ? void 0 : _c.isContinuation) !== null && _d !== void 0 ? _d : false, "data-span-top": (_f = (_e = entry.span) === null || _e === void 0 ? void 0 : _e.top) !== null && _f !== void 0 ? _f : 'undefined', "data-span-bottom": (_h = (_g = entry.span) === null || _g === void 0 ? void 0 : _g.bottom) !== null && _h !== void 0 ? _h : 'undefined', "data-region-key": "".concat((_k = (_j = entry.region) === null || _j === void 0 ? void 0 : _j.page) !== null && _k !== void 0 ? _k : '?', ":").concat((_m = (_l = entry.region) === null || _l === void 0 ? void 0 : _l.column) !== null && _m !== void 0 ? _m : '?') }, { children: renderEntry(entry) }), "".concat(entry.instance.id, ":").concat((_p = (_o = entry.region) === null || _o === void 0 ? void 0 : _o.page) !== null && _p !== void 0 ? _p : page.pageNumber, ":").concat((_r = (_q = entry.region) === null || _q === void 0 ? void 0 : _q.index) !== null && _r !== void 0 ? _r : index)));
                            }) }), column.key)); }) })) }))] }), "page-".concat(page.pageNumber))); }) }));
};
export { CanvasPage };
