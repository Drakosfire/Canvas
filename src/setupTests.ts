/**
 * Jest setup file for Canvas tests
 */

// Add custom jest matchers from jest-dom
import '@testing-library/jest-dom';

export { }; // Make this a module

// Mock ResizeObserver for tests — invoke callback on observe so measurements fire
global.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.callback([{ target: element } as ResizeObserverEntry], this);
  }

  unobserve() { }
  disconnect() { }
};

// Mock requestIdleCallback for tests
if (typeof window !== 'undefined') {
  window.requestIdleCallback = window.requestIdleCallback || ((callback: IdleRequestCallback) => {
    return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 5 }), 1);
  });

  window.cancelIdleCallback = window.cancelIdleCallback || ((id: number) => {
    clearTimeout(id);
  });

  window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(performance.now()), 0) as unknown as number;
  });

  window.cancelAnimationFrame = window.cancelAnimationFrame || ((id: number) => {
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
  toJSON: () => { },
}));

// Mock HTMLCanvasElement for maskExport tests
// JSDOM doesn't implement getContext('2d') by default
HTMLCanvasElement.prototype.getContext = jest.fn(function (contextType: string) {
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
    } as any;
  }
  return null;
});

// Mock toDataURL for canvas
HTMLCanvasElement.prototype.toDataURL = jest.fn(function (type?: string) {
  // Return a minimal base64 data URL
  return `data:${type || 'image/png'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
});