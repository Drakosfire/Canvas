/**
 * Layout Utils Tests
 * Tests for utility functions that don't require statblock dependencies
 */

import {
    regionKey,
    computeBasePageDimensions,
    toColumnType,
    clamp,
    convertToPixels,
    PX_PER_INCH,
    MM_PER_INCH,
} from '../layout/utils';
import { createTestPageVariables } from './test-utils';

describe('Layout Utils', () => {
    describe('regionKey', () => {
        it('creates correct region keys', () => {
            expect(regionKey(1, 1)).toBe('1:1');
            expect(regionKey(2, 1)).toBe('2:1');
            expect(regionKey(1, 2)).toBe('1:2');
        });
    });

    describe('toColumnType', () => {
        it('converts column numbers to type', () => {
            expect(toColumnType(1)).toBe(1);
            expect(toColumnType(2)).toBe(2);
            expect(toColumnType(0)).toBe(1); // Clamped to 1
            expect(toColumnType(3)).toBe(2); // Clamped to 2
        });
    });

    describe('clamp', () => {
        it('clamps values to range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(-1, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
        });
    });

    describe('convertToPixels', () => {
        it('converts inches to pixels', () => {
            expect(convertToPixels(1, 'in')).toBe(PX_PER_INCH);
            expect(convertToPixels(2, 'in')).toBe(PX_PER_INCH * 2);
        });

        it('converts millimeters to pixels', () => {
            expect(convertToPixels(MM_PER_INCH, 'mm')).toBeCloseTo(PX_PER_INCH, 0);
            expect(convertToPixels(25.4, 'mm')).toBeCloseTo(96, 0);
        });

        it('returns pixels as-is', () => {
            expect(convertToPixels(100, 'px')).toBe(100);
        });
    });

    describe('computeBasePageDimensions', () => {
        it('computes page dimensions correctly', () => {
            const pageVars = createTestPageVariables({
                dimensions: {
                    width: 816,
                    height: 1056,
                    unit: 'px',
                },
            });

            const dims = computeBasePageDimensions(pageVars);

            expect(dims.widthPx).toBe(816);
            expect(dims.heightPx).toBe(1056);
            expect(dims.contentHeightPx).toBeLessThan(dims.heightPx);
            expect(dims.topMarginPx).toBeGreaterThan(0);
            expect(dims.bottomMarginPx).toBeGreaterThan(0);
        });

        it('converts non-pixel units', () => {
            const pageVars = createTestPageVariables({
                dimensions: {
                    width: 8.5,
                    height: 11,
                    unit: 'in',
                },
            });

            const dims = computeBasePageDimensions(pageVars);

            expect(dims.widthPx).toBeCloseTo(8.5 * PX_PER_INCH, 0);
            expect(dims.heightPx).toBeCloseTo(11 * PX_PER_INCH, 0);
        });
    });
});

