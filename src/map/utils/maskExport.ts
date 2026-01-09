/**
 * Mask Export Utility
 *
 * Exports mask strokes to base64 PNG for backend inpainting.
 * Implements TDD tests from T162-T164.
 *
 * Alpha channel semantics:
 * - 0 (transparent): AI may generate/replace
 * - 1 (opaque): AI must not alter
 */

import type { MaskExportOptions, MaskExportResult, MaskStroke } from '../types/mask.types';

/**
 * Export mask strokes to a base64-encoded PNG.
 */
export async function exportMaskToBase64(options: MaskExportOptions): Promise<MaskExportResult> {
  const { width, height, strokes } = options;

  // Handle null/undefined strokes gracefully
  const safeStrokes = strokes || [];

  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Start with transparent background (alpha = 0 = generate)
  ctx.clearRect(0, 0, width, height);

  // Draw each stroke
  for (const stroke of safeStrokes) {
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (stroke.tool === 'rect' && stroke.bounds) {
      ctx.fillStyle = 'white';
      ctx.fillRect(stroke.bounds.x, stroke.bounds.y, stroke.bounds.width, stroke.bounds.height);
    } else if (stroke.tool === 'circle' && stroke.bounds) {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      const cx = stroke.bounds.x + stroke.bounds.width / 2;
      const cy = stroke.bounds.y + stroke.bounds.height / 2;
      const rx = stroke.bounds.width / 2;
      const ry = stroke.bounds.height / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stroke.points.length >= 2) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = stroke.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0], stroke.points[1]);
      for (let i = 2; i < stroke.points.length; i += 2) {
        ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
      }
      ctx.stroke();
    }
  }

  // Export as PNG
  const base64 = canvas.toDataURL('image/png');

  return {
    base64,
    width,
    height,
  };
}
