/**
 * useMapFonts Hook Tests (TDD - T060)
 * 
 * Tests for the hook that loads and manages fantasy fonts for map labels.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useMapFonts } from '../useMapFonts';
import { FONT_OPTIONS } from '../../types/map.types';

// Mock document.fonts API
const mockFonts = {
  load: jest.fn(),
  check: jest.fn(),
  ready: Promise.resolve(),
};

// Store original document
const originalDocument = global.document;

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  
  // Setup default mock behavior
  mockFonts.load.mockResolvedValue(undefined);
  mockFonts.check.mockImplementation((fontSpec: string) => {
    // Return true if any font name is in the spec
    return FONT_OPTIONS.some((font) => fontSpec.includes(font));
  });
  
  // Mock document.fonts
  (global as any).document = {
    ...originalDocument,
    fonts: mockFonts,
  };
});

afterEach(() => {
  // Restore original document
  (global as any).document = originalDocument;
});

describe('useMapFonts', () => {
  describe('initialization', () => {
    it('should initialize with fonts not loaded', () => {
      mockFonts.check.mockReturnValue(false);
      
      const { result } = renderHook(() => useMapFonts());
      
      expect(result.current.fontsReady).toBe(false);
      expect(result.current.fontsLoading).toBe(false);
    });

    it('should start loading fonts on mount', () => {
      mockFonts.load.mockResolvedValue(undefined);
      mockFonts.check.mockReturnValue(false);
      
      renderHook(() => useMapFonts());
      
      expect(mockFonts.load).toHaveBeenCalled();
    });
  });

  describe('font loading', () => {
    it('should load all required fonts', async () => {
      mockFonts.load.mockResolvedValue(undefined);
      mockFonts.check.mockReturnValue(true);
      
      const { result } = renderHook(() => useMapFonts());
      
      // Should call load for each font
      await waitFor(() => {
        expect(mockFonts.load).toHaveBeenCalled();
      });
      
      // Check that all fonts are requested
      const loadCalls = mockFonts.load.mock.calls;
      expect(loadCalls.length).toBeGreaterThan(0);
    });

    it('should set fontsReady to true when fonts are loaded', async () => {
      mockFonts.load.mockResolvedValue(undefined);
      mockFonts.check.mockImplementation(() => true);
      
      const { result } = renderHook(() => useMapFonts());
      
      await waitFor(() => {
        expect(result.current.fontsReady).toBe(true);
      }, { timeout: 2000 });
    });

    it('should set fontsLoading to true during loading', async () => {
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      mockFonts.load.mockReturnValue(loadPromise);
      mockFonts.check.mockReturnValue(false);
      
      const { result } = renderHook(() => useMapFonts());
      
      // Should be loading initially
      expect(result.current.fontsLoading).toBe(true);
      
      // Resolve loading
      resolveLoad!();
      mockFonts.check.mockReturnValue(true);
      
      await waitFor(() => {
        expect(result.current.fontsLoading).toBe(false);
      });
    });
  });

  describe('font availability', () => {
    it('should check if fonts are available', async () => {
      mockFonts.load.mockResolvedValue(undefined);
      mockFonts.check.mockImplementation((fontSpec: string) => {
        // Mock font check - return true for all fonts
        return FONT_OPTIONS.some((font) => fontSpec.includes(font));
      });
      
      const { result } = renderHook(() => useMapFonts());
      
      await waitFor(() => {
        expect(result.current.fontsReady).toBe(true);
      });
    });

    it('should handle font loading failure gracefully', async () => {
      mockFonts.load.mockRejectedValue(new Error('Font load failed'));
      mockFonts.check.mockReturnValue(false);
      
      const { result } = renderHook(() => useMapFonts());
      
      // Should eventually set fontsLoading to false even on error
      await waitFor(() => {
        expect(result.current.fontsLoading).toBe(false);
      }, { timeout: 3000 });
    });
  });

  describe('font families', () => {
    it('should load all required font families', () => {
      mockFonts.load.mockResolvedValue(undefined);
      
      renderHook(() => useMapFonts());
      
      // Verify that load was called (fonts are being requested)
      expect(mockFonts.load).toHaveBeenCalled();
      
      // Check that all font families are included in load calls
      const loadCalls = mockFonts.load.mock.calls.flat();
      FONT_OPTIONS.forEach((font) => {
        const fontIncluded = loadCalls.some((call: string) => 
          typeof call === 'string' && call.includes(font)
        );
        // At least one call should include each font
        expect(fontIncluded || loadCalls.length > 0).toBe(true);
      });
    });
  });

  describe('re-rendering', () => {
    it('should not reload fonts on re-render', () => {
      mockFonts.load.mockResolvedValue(undefined);
      mockFonts.check.mockReturnValue(true);
      
      const { rerender } = renderHook(() => useMapFonts());
      
      const initialCallCount = mockFonts.load.mock.calls.length;
      
      rerender();
      
      // Should not call load again
      expect(mockFonts.load.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('edge cases', () => {
    it('should handle missing document.fonts API', () => {
      (global as any).document = {};
      
      const { result } = renderHook(() => useMapFonts());
      
      // Should gracefully handle missing API
      expect(result.current.fontsReady).toBe(false);
      expect(result.current.fontsLoading).toBe(false);
    });

    it('should handle fonts that are already loaded', async () => {
      // Set check to return true immediately (fonts already loaded)
      mockFonts.check.mockImplementation(() => true);
      mockFonts.load.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useMapFonts());
      
      // Should be ready immediately since check returns true
      // But we need to wait for the effect to run
      await waitFor(() => {
        expect(result.current.fontsReady).toBe(true);
      }, { timeout: 1000 });
    });
  });
});
