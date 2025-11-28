/**
 * Tests for structuralStyles module
 * 
 * Verifies that structural style factories produce consistent,
 * correct values for both measurement and visible layers.
 */

import {
    createColumnStructuralStyles,
    createPageStructuralStyles,
    createColumnWrapperStructuralStyles,
    createMeasurementEntryStyles,
    createMeasurementLayerStyles,
    widthsMatch,
    assertWidthsMatch,
} from '../structuralStyles';

describe('structuralStyles', () => {
    describe('createColumnStructuralStyles', () => {
        it('returns exact pixel width', () => {
            const styles = createColumnStructuralStyles(364.2);
            expect(styles.width).toBe('364.2px');
        });

        it('handles integer widths', () => {
            const styles = createColumnStructuralStyles(300);
            expect(styles.width).toBe('300px');
        });

        it('sets flex to none (prevents grow/shrink)', () => {
            const styles = createColumnStructuralStyles(300);
            expect(styles.flex).toBe('none');
            expect(styles.flexGrow).toBe(0);
            expect(styles.flexShrink).toBe(0);
        });

        it('sets box-sizing to border-box', () => {
            const styles = createColumnStructuralStyles(300);
            expect(styles.boxSizing).toBe('border-box');
        });

        it('sets display to flex column', () => {
            const styles = createColumnStructuralStyles(300);
            expect(styles.display).toBe('flex');
            expect(styles.flexDirection).toBe('column');
        });

        it('sets overflow to hidden', () => {
            const styles = createColumnStructuralStyles(300);
            expect(styles.overflow).toBe('hidden');
        });

        it('sets minWidth to 0 for flex children', () => {
            const styles = createColumnStructuralStyles(300);
            expect(styles.minWidth).toBe(0);
        });
    });

    describe('createPageStructuralStyles', () => {
        it('returns exact pixel dimensions', () => {
            const styles = createPageStructuralStyles(816, 1056);
            expect(styles.width).toBe('816px');
            expect(styles.height).toBe('1056px');
        });

        it('sets position to relative', () => {
            const styles = createPageStructuralStyles(800, 1000);
            expect(styles.position).toBe('relative');
        });

        it('sets box-sizing to border-box', () => {
            const styles = createPageStructuralStyles(800, 1000);
            expect(styles.boxSizing).toBe('border-box');
        });
    });

    describe('createColumnWrapperStructuralStyles', () => {
        it('creates flex row container', () => {
            const styles = createColumnWrapperStructuralStyles(12, 950);
            expect(styles.display).toBe('flex');
            expect(styles.flexDirection).toBe('row');
        });

        it('sets gap in pixels', () => {
            const styles = createColumnWrapperStructuralStyles(12, 950);
            expect(styles.gap).toBe('12px');
        });

        it('sets width to 100%', () => {
            const styles = createColumnWrapperStructuralStyles(12, 950);
            expect(styles.width).toBe('100%');
        });

        it('sets height in pixels', () => {
            const styles = createColumnWrapperStructuralStyles(12, 950);
            expect(styles.height).toBe('950px');
        });
    });

    describe('createMeasurementEntryStyles', () => {
        it('matches column width for width and maxWidth', () => {
            const columnWidth = 364.2;
            const styles = createMeasurementEntryStyles(columnWidth);
            expect(styles.width).toBe('364.2px');
            expect(styles.maxWidth).toBe('364.2px');
        });

        it('sets height to auto', () => {
            const styles = createMeasurementEntryStyles(300);
            expect(styles.height).toBe('auto');
        });

        it('prevents flex shrink/grow', () => {
            const styles = createMeasurementEntryStyles(300);
            expect(styles.flexShrink).toBe(0);
            expect(styles.flexGrow).toBe(0);
        });

        it('sets transform to none (important for measurement)', () => {
            const styles = createMeasurementEntryStyles(300);
            expect(styles.transform).toBe('none');
        });

        it('sets overflow to hidden', () => {
            const styles = createMeasurementEntryStyles(300);
            expect(styles.overflow).toBe('hidden');
        });
    });

    describe('createMeasurementLayerStyles', () => {
        describe('embedded mode', () => {
            it('sets position to relative', () => {
                const styles = createMeasurementLayerStyles(364.2, 'embedded');
                expect(styles.position).toBe('relative');
            });

            it('sets visibility to hidden', () => {
                const styles = createMeasurementLayerStyles(364.2, 'embedded');
                expect(styles.visibility).toBe('hidden');
            });

            it('sets width from parameter', () => {
                const styles = createMeasurementLayerStyles(364.2, 'embedded');
                expect(styles.width).toBe('364.2px');
                expect(styles.maxWidth).toBe('364.2px');
            });

            it('handles null width', () => {
                const styles = createMeasurementLayerStyles(null, 'embedded');
                expect(styles.width).toBe('auto');
                expect(styles.maxWidth).toBe('none');
            });
        });

        describe('fixed-offscreen mode', () => {
            it('sets position to fixed off-screen', () => {
                const styles = createMeasurementLayerStyles(364.2, 'fixed-offscreen');
                expect(styles.position).toBe('fixed');
                expect(styles.left).toBe('-100000px');
            });

            it('sets visibility to hidden', () => {
                const styles = createMeasurementLayerStyles(364.2, 'fixed-offscreen');
                expect(styles.visibility).toBe('hidden');
            });

            it('sets width from parameter', () => {
                const styles = createMeasurementLayerStyles(364.2, 'fixed-offscreen');
                expect(styles.width).toBe('364.2px');
                expect(styles.maxWidth).toBe('364.2px');
            });

            it('defaults to fixed-offscreen when stagingMode not specified', () => {
                const styles = createMeasurementLayerStyles(364.2);
                expect(styles.position).toBe('fixed');
                expect(styles.left).toBe('-100000px');
            });
        });
    });

    describe('Layer Synchronization', () => {
        it('measurement entry width matches column width', () => {
            const columnWidth = 364.2;
            const entryStyles = createMeasurementEntryStyles(columnWidth);
            const columnStyles = createColumnStructuralStyles(columnWidth);

            expect(entryStyles.width).toBe(columnStyles.width);
        });

        it('both layers get identical widths from same input', () => {
            const canonicalWidth = 364.2;

            // Simulating what happens in both layers
            const measurementStyles = createMeasurementEntryStyles(canonicalWidth);
            const visibleColumnStyles = createColumnStructuralStyles(canonicalWidth);

            // The key invariant: widths MUST match
            expect(measurementStyles.width).toBe(visibleColumnStyles.width);
        });

        it('box-sizing is consistent across all styles', () => {
            const width = 300;
            
            const columnStyles = createColumnStructuralStyles(width);
            const pageStyles = createPageStructuralStyles(800, 1000);
            const wrapperStyles = createColumnWrapperStructuralStyles(12, 950);
            const entryStyles = createMeasurementEntryStyles(width);

            // All should be border-box for consistent sizing
            expect(columnStyles.boxSizing).toBe('border-box');
            expect(pageStyles.boxSizing).toBe('border-box');
            expect(wrapperStyles.boxSizing).toBe('border-box');
            expect(entryStyles.boxSizing).toBe('border-box');
        });
    });

    describe('widthsMatch', () => {
        it('returns true for identical widths', () => {
            expect(widthsMatch(364.2, 364.2)).toBe(true);
        });

        it('returns true for widths within tolerance', () => {
            expect(widthsMatch(364.2, 364.4, 0.5)).toBe(true);
        });

        it('returns false for widths outside tolerance', () => {
            expect(widthsMatch(364.2, 366.2, 0.5)).toBe(false);
        });

        it('uses default tolerance of 0.5', () => {
            expect(widthsMatch(100, 100.4)).toBe(true);
            expect(widthsMatch(100, 100.6)).toBe(false);
        });
    });

    describe('assertWidthsMatch', () => {
        let consoleSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('does not log for matching widths', () => {
            assertWidthsMatch(364.2, 364.2);
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('logs error for mismatched widths', () => {
            assertWidthsMatch(364.2, 362.2);
            expect(consoleSpy).toHaveBeenCalled();
            expect(consoleSpy.mock.calls[0][0]).toContain('Width mismatch');
        });

        it('includes context in error message', () => {
            assertWidthsMatch(364.2, 362.2, 'test context');
            expect(consoleSpy.mock.calls[0][0]).toContain('test context');
        });
    });
});

