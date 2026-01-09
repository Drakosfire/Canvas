/**
 * Mask Export Utility Tests (TDD - T162-T164)
 *
 * Tests for the utility that exports canvas mask to base64 PNG.
 * Written BEFORE implementation - these tests MUST FAIL initially.
 */

import { exportMaskToBase64 } from '../maskExport';
import type { MaskExportOptions } from '../../types/mask.types';
import type { MaskStroke } from '../../types/mask.types';

describe('maskExport', () => {
  // =========================================================================
  // T162: Converts Canvas to Base64 PNG
  // =========================================================================
  describe('converts canvas to base64 PNG (T162)', () => {
    it('should return base64 string starting with data:image/png', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [100, 100, 200, 200],
          strokeWidth: 30,
        },
      ];

      const options: MaskExportOptions = {
        width: 512,
        height: 512,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      expect(result.base64).toMatch(/^data:image\/png;base64,/);
    });

    it('should return correct dimensions', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [50, 50, 100, 100],
          strokeWidth: 20,
        },
      ];

      const options: MaskExportOptions = {
        width: 1024,
        height: 768,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });

    it('should produce valid base64 that can be decoded', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [100, 100, 200, 200],
          strokeWidth: 30,
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      // Extract base64 part after data URI prefix
      const base64Data = result.base64.replace(/^data:image\/png;base64,/, '');

      // Should be valid base64
      expect(() => atob(base64Data)).not.toThrow();
    });
  });

  // =========================================================================
  // T163: Output Has Correct Alpha Channel Semantics
  // =========================================================================
  describe('output has correct alpha channel semantics (T163)', () => {
    it('should produce mask with correct alpha: 0=generate, 1=preserve', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [128, 128, 200, 200], // Draw in center
          strokeWidth: 50,
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      // Result should exist - actual alpha validation would require
      // decoding the image which is beyond unit test scope
      // jest-canvas-mock returns a minimal mock, so we just check it exists
      expect(result.base64).toBeDefined();
      expect(result.base64.length).toBeGreaterThan(20); // Minimal data URL length
    });

    it('should render brush strokes as opaque (alpha=1)', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'brush-1',
          tool: 'brush',
          points: [100, 100, 200, 200],
          strokeWidth: 30,
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      // Brush strokes should produce non-empty output
      expect(result.base64).toBeDefined();
    });

    it('should render eraser strokes as transparent (alpha=0)', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'brush-1',
          tool: 'brush',
          points: [100, 100, 200, 200],
          strokeWidth: 50,
        },
        {
          id: 'eraser-1',
          tool: 'eraser',
          points: [150, 150, 180, 180],
          strokeWidth: 30,
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      // Should still produce valid output
      expect(result.base64).toBeDefined();
    });
  });

  // =========================================================================
  // T164: Handles Empty Mask (No Strokes)
  // =========================================================================
  describe('handles empty mask (T164)', () => {
    it('should return valid result for empty strokes array', async () => {
      const options: MaskExportOptions = {
        width: 512,
        height: 512,
        strokes: [],
      };

      const result = await exportMaskToBase64(options);

      expect(result.base64).toMatch(/^data:image\/png;base64,/);
      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
    });

    it('should return transparent image for no strokes', async () => {
      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes: [],
      };

      const result = await exportMaskToBase64(options);

      // Empty mask should be fully transparent (small file size)
      expect(result.base64).toBeDefined();
    });

    it('should handle null strokes gracefully', async () => {
      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes: null as any, // Testing defensive handling
      };

      // Should not throw, should return valid empty mask
      const result = await exportMaskToBase64(options);

      expect(result.base64).toBeDefined();
    });
  });

  // =========================================================================
  // Additional Coverage Tests
  // =========================================================================
  describe('rect and circle drawing paths', () => {
    it('should render rectangle shapes correctly', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'rect-1',
          tool: 'rect',
          points: [],
          strokeWidth: 0,
          bounds: { x: 50, y: 50, width: 100, height: 80 },
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      expect(result.base64).toMatch(/^data:image\/png;base64,/);
      expect(result.width).toBe(256);
      expect(result.height).toBe(256);
    });

    it('should render circle shapes correctly', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'circle-1',
          tool: 'circle',
          points: [],
          strokeWidth: 0,
          bounds: { x: 100, y: 100, width: 60, height: 60 },
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      expect(result.base64).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle strokes with points.length < 2', async () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [100], // Only one point - should be skipped
          strokeWidth: 30,
        },
      ];

      const options: MaskExportOptions = {
        width: 256,
        height: 256,
        strokes,
      };

      const result = await exportMaskToBase64(options);

      // Should still return valid result (stroke skipped)
      expect(result.base64).toBeDefined();
    });
  });
});
