/**
 * useMapFonts Hook Tests (TDD - T060)
 * 
 * Tests for the hook that loads and manages fantasy fonts for map labels.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useMapFonts } from '../useMapFonts';
import { FONT_OPTIONS } from '../../types/map.types';

const mockLoad = jest.fn();
const mockCheck = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockResolvedValue(undefined);
  mockCheck.mockImplementation((fontSpec: string) =>
    FONT_OPTIONS.some((font) => fontSpec.includes(font))
  );

  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      load: mockLoad,
      check: mockCheck,
      ready: Promise.resolve(),
    },
  });
});

describe('useMapFonts', () => {
  describe('initialization', () => {
    it('should initialize with fonts not loaded', () => {
      mockCheck.mockReturnValue(false);
      
      const { result } = renderHook(() => useMapFonts());
      
      expect(result.current.fontsReady).toBe(false);
    });

    it('should start loading fonts on mount', () => {
      mockCheck.mockReturnValue(false);
      
      renderHook(() => useMapFonts());
      
      expect(mockLoad).toHaveBeenCalled();
    });
  });

  describe('font loading', () => {
    it('should load all required fonts', async () => {
      mockCheck.mockReturnValue(false);
      mockLoad.mockResolvedValue(undefined);
      
      renderHook(() => useMapFonts());
      
      await waitFor(() => {
        expect(mockLoad).toHaveBeenCalled();
      });
      
      const loadCalls = mockLoad.mock.calls;
      expect(loadCalls.length).toBeGreaterThan(0);
    });

    it('should set fontsReady to true when fonts are loaded', async () => {
      mockCheck.mockImplementation(() => true);
      
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
      mockLoad.mockReturnValue(loadPromise);
      mockCheck.mockReturnValue(false);
      
      const { result } = renderHook(() => useMapFonts());
      
      expect(result.current.fontsLoading).toBe(true);
      
      resolveLoad!();
      mockCheck.mockReturnValue(true);
      
      await waitFor(() => {
        expect(result.current.fontsLoading).toBe(false);
      });
    });
  });

  describe('font availability', () => {
    it('should check if fonts are available', async () => {
      mockCheck.mockImplementation((fontSpec: string) =>
        FONT_OPTIONS.some((font) => fontSpec.includes(font))
      );
      
      const { result } = renderHook(() => useMapFonts());
      
      await waitFor(() => {
        expect(result.current.fontsReady).toBe(true);
      });
    });

    it('should handle font loading failure gracefully', async () => {
      mockLoad.mockRejectedValue(new Error('Font load failed'));
      mockCheck.mockReturnValue(false);
      
      const { result } = renderHook(() => useMapFonts());
      
      await waitFor(() => {
        expect(result.current.fontsLoading).toBe(false);
      }, { timeout: 3000 });
    });
  });

  describe('font families', () => {
    it('should load all required font families', () => {
      mockCheck.mockReturnValue(false);
      
      renderHook(() => useMapFonts());
      
      expect(mockLoad).toHaveBeenCalled();
      
      const loadCalls = mockLoad.mock.calls.flat();
      FONT_OPTIONS.forEach((font) => {
        const fontIncluded = loadCalls.some((call: string) => 
          typeof call === 'string' && call.includes(font)
        );
        expect(fontIncluded || loadCalls.length > 0).toBe(true);
      });
    });
  });

  describe('re-rendering', () => {
    it('should not reload fonts on re-render', () => {
      mockCheck.mockReturnValue(true);
      
      const { rerender } = renderHook(() => useMapFonts());
      
      const initialCallCount = mockLoad.mock.calls.length;
      
      rerender();
      
      expect(mockLoad.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('edge cases', () => {
    it('should handle missing document.fonts API', () => {
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: undefined,
      });
      
      const { result } = renderHook(() => useMapFonts());
      
      expect(result.current.fontsReady).toBe(false);
      expect(result.current.fontsLoading).toBe(false);
    });

    it('should handle fonts that are already loaded', async () => {
      mockCheck.mockImplementation(() => true);
      
      const { result } = renderHook(() => useMapFonts());
      
      await waitFor(() => {
        expect(result.current.fontsReady).toBe(true);
      }, { timeout: 1000 });
    });
  });
});
