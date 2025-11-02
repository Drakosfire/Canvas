/**
 * Smoke Tests
 * Basic functionality tests that verify the system works end-to-end
 * without requiring statblock-specific dependencies
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { createComponentRegistry } from '../registry';
import { createTestPageVariables, createTestTemplate, createTestInstance } from './test-utils';
import type { ComponentRegistryEntry } from '../types/canvas.types';

// Mock component
const MockComponent: React.FC = () => <div>Mock</div>;

describe('Canvas Smoke Tests', () => {
    it('can create a component registry', () => {
        const registry = createComponentRegistry({
            'test-component': {
                type: 'test-component',
                displayName: 'Test',
                component: MockComponent,
                defaults: {
                    dataRef: { type: 'custom', key: 'test' },
                    layout: { isVisible: true },
                },
            },
        });

        expect(registry).toBeDefined();
        expect(Object.keys(registry)).toHaveLength(1);
    });

    it('can create page variables', () => {
        const pageVars = createTestPageVariables();
        
        expect(pageVars.mode).toBe('locked');
        expect(pageVars.dimensions.width).toBeGreaterThan(0);
        expect(pageVars.columns.columnCount).toBeGreaterThan(0);
    });

    it('can create template config', () => {
        const template = createTestTemplate();
        
        expect(template.id).toBe('test-template');
        expect(template.slots).toBeDefined();
        expect(template.defaultComponents).toBeDefined();
    });

    it('can create component instances', () => {
        const instance = createTestInstance('test-1');
        
        expect(instance.id).toBe('test-1');
        expect(instance.type).toBe('test-component');
        expect(instance.dataRef).toBeDefined();
        expect(instance.layout.isVisible).toBe(true);
    });

    it('can create multiple component instances', () => {
        const instances = [
            createTestInstance('comp-1'),
            createTestInstance('comp-2', { type: 'other-component' }),
        ];

        expect(instances).toHaveLength(2);
        expect(instances[0].id).toBe('comp-1');
        expect(instances[1].type).toBe('other-component');
    });
});

