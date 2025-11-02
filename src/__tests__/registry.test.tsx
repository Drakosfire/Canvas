/**
 * Component Registry Tests
 * Tests for the generic component registry factory
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import {
    createComponentRegistry,
    getComponentEntry,
    getAllComponentTypes,
    isValidComponentType,
} from '../registry';
import type { ComponentRegistryEntry } from '../types/canvas.types';

// Mock component for testing
const MockComponent: React.FC = () => <div>Test</div>;

describe('Component Registry', () => {
    const mockEntry: ComponentRegistryEntry = {
        type: 'test-component',
        displayName: 'Test Component',
        description: 'A test component',
        component: MockComponent,
        defaults: {
            dataRef: { type: 'custom', key: 'test' },
            layout: { isVisible: true },
        },
    };

    it('creates a registry from entries', () => {
        const registry = createComponentRegistry({
            'test-component': mockEntry,
        });

        expect(registry).toBeDefined();
        expect(registry['test-component']).toEqual(mockEntry);
    });

    it('retrieves component entry by type', () => {
        const registry = createComponentRegistry({
            'test-component': mockEntry,
        });

        const entry = getComponentEntry(registry, 'test-component');
        expect(entry).toEqual(mockEntry);
    });

    it('returns undefined for non-existent component', () => {
        const registry = createComponentRegistry({
            'test-component': mockEntry,
        });

        const entry = getComponentEntry(registry, 'non-existent');
        expect(entry).toBeUndefined();
    });

    it('gets all component types', () => {
        const registry = createComponentRegistry({
            'test-component': mockEntry,
            'another-component': {
                ...mockEntry,
                type: 'another-component',
            },
        });

        const types = getAllComponentTypes(registry);
        expect(types).toContain('test-component');
        expect(types).toContain('another-component');
        expect(types.length).toBe(2);
    });

    it('validates component types', () => {
        const registry = createComponentRegistry({
            'test-component': mockEntry,
        });

        expect(isValidComponentType(registry, 'test-component')).toBe(true);
        expect(isValidComponentType(registry, 'non-existent')).toBe(false);
    });
});

