/**
 * Type export tests
 * Verifies that expected types are exported from package entrypoints
 */

import * as Canvas from '../index';
import * as Layout from '../layout/index';
import * as Map from '../map/index';
import * as Dev from '../dev/index';

describe('Package Type Exports', () => {
    it('exports registry functions from root barrel', () => {
        expect(typeof Canvas.createComponentRegistry).toBe('function');
        expect(typeof Canvas.getComponentEntry).toBe('function');
        expect(typeof Canvas.getAllComponentTypes).toBe('function');
        expect(typeof Canvas.isValidComponentType).toBe('function');
    });

    it('exports layout functions from layout subpath without map-only APIs', () => {
        expect(typeof Layout.buildPageDocument).toBe('function');
        expect(typeof Layout.useCanvasLayout).toBe('function');
        expect(Layout.CanvasPage).toBeDefined();
        expect((Layout as Record<string, unknown>).MapViewport).toBeUndefined();
    });

    it('exports map functions from map subpath', () => {
        expect(typeof Map.useMapCanvas).toBe('function');
        expect(Map.MapViewport).toBeDefined();
        expect(typeof Map.exportMaskToBase64).toBe('function');
    });

    it('exports dev diagnostics from dev subpath only', () => {
        expect(typeof Dev.exposeStateDebugger).toBe('function');
        expect(typeof Dev.diagnosePagination).toBe('function');
        expect((Canvas as Record<string, unknown>).exposeStateDebugger).toBeUndefined();
    });

    it('exports data builder functions', () => {
        expect(typeof Canvas.buildPageDocument).toBe('function');
        expect(typeof Canvas.updatePageDataSources).toBe('function');
    });

    it('exports export functions', () => {
        expect(typeof Canvas.exportToHTML).toBe('function');
        expect(typeof Canvas.downloadHTML).toBe('function');
        expect(typeof Canvas.exportPageToHTMLFile).toBe('function');
    });

    it('exports layout components and hooks', () => {
        expect(Canvas.CanvasPage).toBeDefined();
        expect(typeof Canvas.useCanvasLayout).toBe('function');
        expect(Canvas.CanvasLayoutProvider).toBeDefined();
        expect(Canvas.MeasurementLayer).toBeDefined();
        expect(Canvas.MeasurementCoordinator).toBeDefined();
    });

    it('exports all expected types', () => {
        type TestTypes = {
            ComponentInstance: Canvas.ComponentInstance;
            ComponentDataSource: Canvas.ComponentDataSource;
            ComponentDataReference: Canvas.ComponentDataReference;
            TemplateConfig: Canvas.TemplateConfig;
            PageVariables: Canvas.PageVariables;
            CanvasLayoutEntry: Canvas.CanvasLayoutEntry;
            LayoutPlan: Canvas.LayoutPlan;
            PageDocument: Canvas.PageDocument;
        };

        expect(true).toBe(true);
    });
});

