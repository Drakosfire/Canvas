/**
 * Page Document Builder
 * 
 * Utilities for building PageDocument instances from live data.
 * Handles data hydration and template instantiation.
 */

import type {
    ComponentDataSource,
    PageDocument,
    TemplateConfig,
    ComponentInstance,
} from '../types/canvas.types';

/**
 * TODO: Add a data source type for the character data and statblock
 */

interface BuildPageDocumentOptions<T = unknown, C = unknown> {
    template: TemplateConfig;
    statblockData?: T; // Generic data type - applications provide their own type
    characterData?: C; // Character data for PlayerCharacterGenerator
    customData?: Record<string, unknown>;
    projectId?: string;
    ownerId?: string;
}

/**
 * Build a complete page document from a template and live data
 */
export function buildPageDocument<T = unknown, C = unknown>(options: BuildPageDocumentOptions<T, C>): PageDocument {
    const {
        template,
        statblockData,
        characterData,
        customData = {},
        projectId = 'default-project',
        ownerId = 'default-user',
    } = options;

    const now = new Date().toISOString();

    // Create data sources
    const dataSources: ComponentDataSource[] = [];

    // Add statblock data source if provided
    if (statblockData !== undefined) {
        dataSources.push({
            id: 'statblock-main',
            type: 'statblock',
            payload: statblockData,
            updatedAt: now,
        });
    }

    // Add character data source if provided
    if (characterData !== undefined) {
        dataSources.push({
            id: 'character-main',
            type: 'character',
            payload: characterData,
            updatedAt: now,
        });
    }

    // Always add custom data source
    dataSources.push({
        id: 'custom-main',
        type: 'custom',
        payload: customData,
        updatedAt: now,
    });

    // Build component instances from template
    const componentInstances: ComponentInstance[] = template.defaultComponents.map((placement, index) => {
        const slot = template.slots.find((s) => s.id === placement.slotId);

        return {
            id: `component-${index}`,
            type: placement.componentType,
            dataRef: placement.defaultDataRef,
            layout: {
                slotId: placement.slotId,
                position: slot?.position,
                isVisible: true,
            },
            variables: placement.defaultVariables,
        };
    });

    // Build the page document
    return {
        id: `page-${Date.now()}`,
        projectId,
        ownerId,
        templateId: template.id,
        pageVariables: {
            mode: template.defaultMode,
            ...template.defaultPageVariables,
            templateId: template.id,
        },
        componentInstances,
        dataSources,
        createdAt: now,
        updatedAt: now,
        history: [],
        metadata: {
            generatedBy: 'DungeonMind StatBlock Generator',
            version: '1.0.0',
        },
    };
}

/**
 * Update data sources in an existing page document
 */
export function updatePageDataSources<T = unknown, C = unknown>(
    page: PageDocument,
    statblockData?: T,
    characterData?: C,
    customData?: Record<string, unknown>
): PageDocument {
    const updatedSources = page.dataSources.map((source) => {
        if (source.type === 'statblock' && statblockData) {
            return {
                ...source,
                payload: statblockData,
                updatedAt: new Date().toISOString(),
            };
        }

        if (source.type === 'character' && characterData) {
            return {
                ...source,
                payload: characterData,
                updatedAt: new Date().toISOString(),
            };
        }

        if (source.type === 'custom' && customData) {
            return {
                ...source,
                payload: {
                    ...(source.payload as Record<string, unknown>),
                    ...customData,
                },
                updatedAt: new Date().toISOString(),
            };
        }

        return source;
    });

    return {
        ...page,
        dataSources: updatedSources,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Extract custom data object from selected assets
 */
export function extractCustomData(selectedAssets: {
    creatureImage?: string;
    selectedImageIndex?: number;
    generatedImages?: string[];
    modelFile?: string;
}): Record<string, unknown> {
    return {
        portraitUrl: selectedAssets.creatureImage,
        imageIndex: selectedAssets.selectedImageIndex,
        allImages: selectedAssets.generatedImages ?? [],
        modelUrl: selectedAssets.modelFile,
    };
}



