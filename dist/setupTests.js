/**
 * Jest setup file for Canvas tests
 */
// Add custom jest matchers from jest-dom
import '@testing-library/jest-dom';
// Mock ResizeObserver for tests
global.ResizeObserver = /** @class */ (function () {
    function ResizeObserver() {
    }
    ResizeObserver.prototype.observe = function () { };
    ResizeObserver.prototype.unobserve = function () { };
    ResizeObserver.prototype.disconnect = function () { };
    return ResizeObserver;
}());
// Mock requestIdleCallback for tests
if (typeof window !== 'undefined') {
    window.requestIdleCallback = window.requestIdleCallback || (function (callback) {
        return setTimeout(function () { return callback({ didTimeout: false, timeRemaining: function () { return 5; } }); }, 1);
    });
    window.cancelIdleCallback = window.cancelIdleCallback || (function (id) {
        clearTimeout(id);
    });
}
// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn(function () { return ({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
    toJSON: function () { },
}); });
// Mock HTMLCanvasElement for maskExport tests
// JSDOM doesn't implement getContext('2d') by default
HTMLCanvasElement.prototype.getContext = jest.fn(function (contextType) {
    if (contextType === '2d') {
        // Return a minimal 2D context mock
        return {
            clearRect: jest.fn(),
            fillRect: jest.fn(),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            lineCap: '',
            lineJoin: '',
            globalCompositeOperation: '',
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            stroke: jest.fn(),
            fill: jest.fn(),
            ellipse: jest.fn(),
            // Add other methods as needed
        };
    }
    return null;
});
// Mock toDataURL for canvas
HTMLCanvasElement.prototype.toDataURL = jest.fn(function (type) {
    // Return a minimal base64 data URL
    return "data:".concat(type || 'image/png', ";base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
});
