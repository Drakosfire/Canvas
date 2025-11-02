import React from 'react';
import { act, render } from '@testing-library/react';

import type { MeasurementEntry } from '../types';
import { MeasurementLayer } from '../measurement';
import { MEASUREMENT_THROTTLE_MS } from '../utils';

const createEntries = (): MeasurementEntry[] => [
    {
        instance: {
            id: 'comp-1',
            type: 'trait-list',
            dataRef: { type: 'statblock', path: 'specialAbilities' },
            layout: { isVisible: true },
        } as MeasurementEntry['instance'],
        slotIndex: 0,
        orderIndex: 0,
        sourceRegionKey: '1:1',
        region: { page: 1, column: 1 },
        estimatedHeight: 100,
        measurementKey: 'comp-1:block',
        needsMeasurement: true,
    },
];

describe('MeasurementLayer', () => {
    let rectSpy: jest.SpyInstance<DOMRect, []>;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(Date, 'now').mockReturnValue(1_759_099_090_000);
        rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const flush = async () => {
        await act(async () => {
            jest.advanceTimersByTime(MEASUREMENT_THROTTLE_MS + 10);
            jest.runOnlyPendingTimers();
        });
    };

    it('dispatches measured height when nodes report size', async () => {
        rectSpy.mockReturnValue({
            width: 120,
            height: 200,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        const onMeasurements = jest.fn();
        const entries = createEntries();

        const { container } = render(
            <MeasurementLayer entries={entries} renderComponent={() => <div>Measured</div>} onMeasurements={onMeasurements} />
        );

        const measurementNode = container.querySelector('[data-measurement-key="comp-1:block"]');
        expect(measurementNode).not.toBeNull();

        await flush();

        expect(onMeasurements).toHaveBeenCalledTimes(1);
        const [records] = onMeasurements.mock.calls[0];
        expect(records).toEqual([
            expect.objectContaining({ key: 'comp-1:block', height: 200, measuredAt: 1_759_099_090_000 }),
        ]);
    });

    it('emits zero height when entry unmounts before measurement', async () => {
        rectSpy.mockReturnValue({
            width: 100,
            height: 0,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        const onMeasurements = jest.fn();
        const entries = createEntries();

        const { unmount } = render(
            <MeasurementLayer entries={entries} renderComponent={() => <div>Measured</div>} onMeasurements={onMeasurements} />
        );

        unmount();
        await flush();

        expect(onMeasurements).toHaveBeenCalled();
        const [records] = onMeasurements.mock.calls[0];
        expect(records[0]).toMatchObject({ key: 'comp-1:block', height: 0 });
    });
});


