/**
 * Test utilities for Canvas tests
 * Provides generic helpers that don't depend on statblock-specific types
 */
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
/**
 * Create a generic component instance for testing
 */
export function createTestInstance(id, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: id, type: 'test-component', dataRef: { type: 'custom', key: 'testData' }, layout: { isVisible: true } }, overrides);
}
/**
 * Create a test layout entry
 */
export function createTestEntry(id, estimatedHeight, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ instance: createTestInstance(id), slotIndex: 0, orderIndex: 0, sourceRegionKey: '1:1', region: { page: 1, column: 1 }, homeRegion: { page: 1, column: 1 }, homeRegionKey: '1:1', estimatedHeight: estimatedHeight, measurementKey: "".concat(id, ":block"), needsMeasurement: false }, overrides);
}
/**
 * Create a test list entry with generic items
 */
export function createTestListEntry(id, items, estimatedHeight, overrides) {
    if (overrides === void 0) { overrides = {}; }
    var regionContent = {
        kind: 'test-list',
        items: items,
        startIndex: 0,
        totalCount: items.length,
        isContinuation: false,
    };
    return createTestEntry(id, estimatedHeight, __assign({ regionContent: regionContent, measurementKey: "".concat(id, ":test-list:0:").concat(items.length, ":").concat(items.length) }, overrides));
}
export function createMockItem(id, name, description) {
    return { id: id, name: name, description: description };
}
export function createTestPageVariables(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ mode: 'locked', dimensions: {
            width: 816,
            height: 1056,
            unit: 'px',
        }, background: {
            type: 'solid',
            color: '#ffffff',
        }, columns: {
            enabled: true,
            columnCount: 1,
            gutter: 12,
            unit: 'px',
        }, pagination: {
            pageCount: 1,
            columnCount: 1,
        }, snap: {
            enabled: false,
            gridSize: 10,
            gridUnit: 'px',
            snapToSlots: false,
            snapToEdges: false,
        } }, overrides);
}
export function createTestTemplate(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'test-template', name: 'Test Template', description: 'Test template for unit tests', defaultMode: 'locked', defaultPageVariables: createTestPageVariables(), slots: [], defaultComponents: [], allowedComponents: ['test-component'] }, overrides);
}
