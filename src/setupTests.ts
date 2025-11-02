/**
 * Jest setup file for Canvas tests
 */

export {}; // Make this a module

// Add custom jest matchers from jest-dom
// Note: We don't import @testing-library/jest-dom here since it's optional
// Tests can import it if needed

// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock requestIdleCallback for tests
if (typeof window !== 'undefined') {
  window.requestIdleCallback = window.requestIdleCallback || ((callback: IdleRequestCallback) => {
    return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 5 }), 1);
  });
  
  window.cancelIdleCallback = window.cancelIdleCallback || ((id: number) => {
    clearTimeout(id);
  });
}

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

