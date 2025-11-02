import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, waitFor } from '@testing-library/react';
import { MeasurementLayer, createMeasurementEntry } from '../measurement';

describe('MeasurementLayer cleanup', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('should dispatch deletion when entry unmounts', async () => {
        const onMeasurements = jest.fn();
        const entry = createMeasurementEntry({ measurementKey: 'test-key' });

        const { rerender } = render(
            <MeasurementLayer
                entries={[entry]}
                renderComponent={() => <div>Test</div>}
                onMeasurements={onMeasurements}
            />
        );

        // Unmount the entry
        rerender(
            <MeasurementLayer
                entries={[]}
                renderComponent={() => <div>Test</div>}
                onMeasurements={onMeasurements}
            />
        );

        // Advance timers to trigger flush
        jest.runAllTimers();

        await waitFor(() => {
            expect(onMeasurements).toHaveBeenCalled();
            const calls = onMeasurements.mock.calls;
            const lastCall = calls[calls.length - 1][0];
            const deletions = lastCall.filter((m: { height: number }) => m.height === 0);
            expect(deletions.length).toBeGreaterThan(0);
            expect(deletions.some((m: { key: string }) => m.key === 'test-key')).toBe(true);
        });
    });

    it('should not dispatch deletion for entries that never mounted', () => {
        const onMeasurements = jest.fn();

        render(
            <MeasurementLayer
                entries={[]}
                renderComponent={() => <div>Test</div>}
                onMeasurements={onMeasurements}
            />
        );

        jest.runAllTimers();

        expect(onMeasurements).not.toHaveBeenCalled();
    });

    it('should handle multiple deletions in a single flush', async () => {
        const onMeasurements = jest.fn();
        const entry1 = createMeasurementEntry({ measurementKey: 'test-key-1' });
        const entry2 = createMeasurementEntry({ measurementKey: 'test-key-2' });

        const { rerender } = render(
            <MeasurementLayer
                entries={[entry1, entry2]}
                renderComponent={() => <div>Test</div>}
                onMeasurements={onMeasurements}
            />
        );

        // Unmount both entries
        rerender(
            <MeasurementLayer
                entries={[]}
                renderComponent={() => <div>Test</div>}
                onMeasurements={onMeasurements}
            />
        );

        jest.runAllTimers();

        await waitFor(() => {
            expect(onMeasurements).toHaveBeenCalled();
            const calls = onMeasurements.mock.calls;
            const lastCall = calls[calls.length - 1][0];
            const deletions = lastCall.filter((m: { height: number }) => m.height === 0);
            expect(deletions.length).toBeGreaterThanOrEqual(2);
        });
    });
});


