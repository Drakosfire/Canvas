import { describe, it, expect } from '@jest/globals';
import { computeHomeRegions } from '../utils';
import type { ComponentInstance, TemplateConfig } from '../../types/canvas.types';

describe('computeHomeRegions', () => {
    it('should compute home regions for single-column layout', () => {
        const template: TemplateConfig = {
            slots: [
                { id: 'slot-1', position: { x: 0, y: 0, width: 300, height: 200 } },
            ],
        } as TemplateConfig;

        const instances: ComponentInstance[] = [
            {
                id: 'comp-1',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'name' },
                layout: { slotId: 'slot-1', isVisible: true },
            } as ComponentInstance,
        ];

        const homeRegions = computeHomeRegions({
            instances,
            template,
            columnCount: 1,
            pageWidthPx: 600,
        });

        expect(homeRegions.get('comp-1')).toEqual({
            homeRegion: { page: 1, column: 1 },
            slotIndex: 0,
            orderIndex: 0,
        });
    });

    it('should preserve home regions across multiple components', () => {
        const template: TemplateConfig = {
            slots: [
                { id: 'slot-1', position: { x: 0, y: 0, width: 300, height: 200 } },
                { id: 'slot-2', position: { x: 0, y: 210, width: 300, height: 150 } },
            ],
        } as TemplateConfig;

        const instances: ComponentInstance[] = [
            {
                id: 'comp-1',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'name' },
                layout: { slotId: 'slot-1', isVisible: true },
            } as ComponentInstance,
            {
                id: 'comp-2',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'description' },
                layout: { slotId: 'slot-2', isVisible: true },
            } as ComponentInstance,
        ];

        const homeRegions = computeHomeRegions({
            instances,
            template,
            columnCount: 1,
            pageWidthPx: 600,
        });

        expect(homeRegions.size).toBe(2);
        expect(homeRegions.get('comp-1')?.slotIndex).toBe(0);
        expect(homeRegions.get('comp-2')?.slotIndex).toBe(1);
    });

    it('should handle two-column layouts', () => {
        const template: TemplateConfig = {
            slots: [
                { id: 'slot-left', position: { x: 0, y: 0, width: 290, height: 200 } },
                { id: 'slot-right', position: { x: 310, y: 0, width: 290, height: 200 } },
            ],
        } as TemplateConfig;

        const instances: ComponentInstance[] = [
            {
                id: 'comp-left',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'name' },
                layout: { slotId: 'slot-left', isVisible: true },
            } as ComponentInstance,
            {
                id: 'comp-right',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'description' },
                layout: { slotId: 'slot-right', isVisible: true },
            } as ComponentInstance,
        ];

        const homeRegions = computeHomeRegions({
            instances,
            template,
            columnCount: 2,
            pageWidthPx: 600,
        });

        expect(homeRegions.get('comp-left')?.homeRegion.column).toBe(1);
        expect(homeRegions.get('comp-right')?.homeRegion.column).toBe(2);
    });

    it('should handle components with explicit location', () => {
        const template: TemplateConfig = {
            slots: [
                { id: 'slot-1', position: { x: 0, y: 0, width: 300, height: 200 } },
            ],
        } as TemplateConfig;

        const instances: ComponentInstance[] = [
            {
                id: 'comp-1',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'name' },
                layout: {
                    slotId: 'slot-1',
                    isVisible: true,
                    location: { page: 2, column: 1 }
                },
            } as ComponentInstance,
        ];

        const homeRegions = computeHomeRegions({
            instances,
            template,
            columnCount: 1,
            pageWidthPx: 600,
        });

        expect(homeRegions.get('comp-1')?.homeRegion).toEqual({ page: 2, column: 1 });
    });

    it('should maintain stable orderIndex', () => {
        const template: TemplateConfig = {
            slots: [
                { id: 'slot-1', position: { x: 0, y: 0, width: 300, height: 200 } },
            ],
        } as TemplateConfig;

        const instances: ComponentInstance[] = [
            {
                id: 'first',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'name' },
                layout: { slotId: 'slot-1', isVisible: true },
            } as ComponentInstance,
            {
                id: 'second',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'description' },
                layout: { slotId: 'slot-1', isVisible: true },
            } as ComponentInstance,
            {
                id: 'third',
                type: 'text-block',
                dataRef: { type: 'statblock', path: 'type' },
                layout: { slotId: 'slot-1', isVisible: true },
            } as ComponentInstance,
        ];

        const homeRegions = computeHomeRegions({
            instances,
            template,
            columnCount: 1,
            pageWidthPx: 600,
        });

        expect(homeRegions.get('first')?.orderIndex).toBe(0);
        expect(homeRegions.get('second')?.orderIndex).toBe(1);
        expect(homeRegions.get('third')?.orderIndex).toBe(2);
    });
});
