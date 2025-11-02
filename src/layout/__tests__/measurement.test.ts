import React from 'react';
import { act, renderHook } from '@testing-library/react';

import type { MeasurementRecord } from '../types';
import { useIdleMeasurementDispatcher } from '../measurement';
import { MEASUREMENT_THROTTLE_MS } from '../utils';

describe('useIdleMeasurementDispatcher', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('flushes measurements after throttle interval', async () => {
        const onFlush = jest.fn();
        const { result } = renderHook(() => useIdleMeasurementDispatcher(onFlush));

        act(() => {
            result.current('comp:block', 120);
        });

        expect(onFlush).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(MEASUREMENT_THROTTLE_MS + 5);
        });

        expect(onFlush).toHaveBeenCalledTimes(1);
        const [records] = onFlush.mock.calls[0] as [MeasurementRecord[]];
        expect(records).toEqual([
            expect.objectContaining({ key: 'comp:block', height: 120, measuredAt: expect.any(Number) }),
        ]);
    });

    it('keeps the latest height when the same key is measured multiple times', async () => {
        const onFlush = jest.fn();
        const { result } = renderHook(() => useIdleMeasurementDispatcher(onFlush));

        act(() => {
            result.current('comp:block', 120);
            result.current('comp:block', 220);
            result.current('comp:block', 320);
        });

        await act(async () => {
            jest.advanceTimersByTime(MEASUREMENT_THROTTLE_MS + 5);
        });

        const [records] = onFlush.mock.calls[0] as [MeasurementRecord[]];
        expect(records).toEqual([
            expect.objectContaining({ key: 'comp:block', height: 320 }),
        ]);
    });

    it('allows zero-height measurement to clear records', async () => {
        const onFlush = jest.fn();
        const { result } = renderHook(() => useIdleMeasurementDispatcher(onFlush));

        act(() => {
            result.current('comp:block', 0);
        });

        await act(async () => {
            jest.advanceTimersByTime(MEASUREMENT_THROTTLE_MS + 5);
        });

        const [records] = onFlush.mock.calls[0] as [MeasurementRecord[]];
        expect(records).toEqual([
            expect.objectContaining({ key: 'comp:block', height: 0 }),
        ]);
    });
});


