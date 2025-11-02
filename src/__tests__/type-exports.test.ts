/**
 * Type export tests
 * Verifies that all expected types are exported from the main package
 */

import * as Canvas from '../index';

describe('Package Type Exports', () => {
    it('exports registry functions', () => {
        expect(typeof Canvas.createComponentRegistry).toBe('function');
        expect(typeof Canvas.getComponentEntry).toBe('function');
        expect(typeof Canvas.getAllComponentTypes).toBe('function');
        expect(typeof Canvas.isValidComponentType).toBe('function');
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
        // Type-only test - TypeScript will error if types don't exist
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

        // If we get here, types exist
        expect(true).toBe(true);
    });
});

