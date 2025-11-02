/**
 * Canvas Core Types
 * 
 * Generic type definitions for the Canvas rendering system.
 * Domain-specific types (like StatBlockDetails) should be provided
 * by consuming applications.
 */

import type React from 'react';

// ============================================================================
// Page Configuration
// ============================================================================

export type PageMode = 'locked' | 'freeform';

export interface PageDimensions {
    width: number;
    height: number;
    unit: 'px' | 'mm' | 'in';
    bleed?: number;
}

export interface PageBackgroundConfig {
    type: 'parchment' | 'solid' | 'image';
    color?: string;
    textureUrl?: string;
    overlayOpacity?: number;
}

export interface ColumnConfig {
    enabled: boolean;
    columnCount: number;
    gutter: number;
    unit: 'px' | 'mm' | 'in';
}

export interface SnapConfig {
    enabled: boolean;
    gridSize: number;
    gridUnit: 'px' | 'mm' | 'in';
    snapToSlots: boolean;
    snapToEdges: boolean;
}

export interface PaginationConfig {
    pageCount: number;
    columnCount: 1 | 2;
}

export interface PageVariables {
    mode: PageMode;
    dimensions: PageDimensions;
    background: PageBackgroundConfig;
    columns: ColumnConfig;
    pagination: PaginationConfig;
    snap: SnapConfig;
    templateId?: string;
}

// ============================================================================
// Component Types
// ============================================================================

/**
 * Component type identifier.
 * Applications should extend this type with their domain-specific component types.
 * 
 * Example:
 * ```typescript
 * type MyCanvasComponentType = CanvasComponentType | 'my-custom-component';
 * ```
 */
export type CanvasComponentType = string;

export interface ComponentDimensions {
    width: number;
    height: number;
}

export interface LayoutPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    zIndex?: number;
}

export interface ComponentLayoutConfig {
    slotId?: string;
    position?: LayoutPosition;
    minSize?: ComponentDimensions;
    maxSize?: ComponentDimensions;
    isVisible: boolean;
    isLocked?: boolean;
    location?: {
        page: number;
        column: 1 | 2;
    };
}

/**
 * Generic data reference for components.
 * Applications should extend this to include domain-specific data source types.
 * 
 * Example:
 * ```typescript
 * type MyComponentDataReference = 
 *   | ComponentDataReference
 *   | { type: 'my-source'; path: string; sourceId?: string };
 * ```
 */
export type ComponentDataReference =
    | { type: 'statblock'; path: string; sourceId?: string }
    | { type: 'custom'; key: string; sourceId?: string };

/**
 * Generic data source.
 * Applications should extend this to include domain-specific payload types.
 * 
 * Example:
 * ```typescript
 * type MyComponentDataSource<T = unknown> = 
 *   | ComponentDataSource<T>
 *   | { id: string; type: 'my-source'; payload: MyDataType; updatedAt: string };
 * ```
 */
export interface ComponentDataSource<T = unknown> {
    id: string;
    type: string;
    payload: T | Record<string, unknown>;
    updatedAt: string;
}

export interface ComponentInstance {
    id: string;
    type: CanvasComponentType;
    dataRef: ComponentDataReference;
    layout: ComponentLayoutConfig;
    modeOverrides?: Partial<ComponentLayoutConfig>;
    variables?: Record<string, unknown>;
}

// ============================================================================
// Region List Content (for list components)
// ============================================================================

/**
 * Generic region list content for list-style components.
 * Applications should extend this to include domain-specific item types.
 * 
 * Example:
 * ```typescript
 * interface MyRegionListContent extends RegionListContent {
 *   kind: 'my-list-type';
 *   items: MyItemType[];
 * }
 * ```
 */
export interface RegionListContent {
    kind: string;
    items: unknown[];
    startIndex: number;
    totalCount: number;
    isContinuation: boolean;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Template Configuration
// ============================================================================

export interface TemplateSlot {
    id: string;
    name: string;
    position: LayoutPosition;
    allowedComponents: CanvasComponentType[];
    isRequired?: boolean;
}

export interface TemplateComponentPlacement {
    slotId: string;
    componentType: CanvasComponentType;
    defaultDataRef: ComponentDataReference;
    defaultVariables?: Record<string, unknown>;
}

export interface TemplateConfig {
    id: string;
    name: string;
    description?: string;
    defaultMode: PageMode;
    defaultPageVariables: Omit<PageVariables, 'mode' | 'templateId'>;
    slots: TemplateSlot[];
    defaultComponents: TemplateComponentPlacement[];
    allowedComponents: CanvasComponentType[];
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Page Document
// ============================================================================

export interface PageHistoryEntry {
    id: string;
    createdAt: string;
    userId: string;
    summary: string;
}

export interface StatblockPageDocument {
    id: string;
    projectId: string;
    ownerId: string;
    templateId: string;
    pageVariables: PageVariables;
    componentInstances: ComponentInstance[];
    dataSources: ComponentDataSource[];
    createdAt: string;
    updatedAt: string;
    history?: PageHistoryEntry[];
    metadata?: Record<string, unknown>;
}

export interface PageDocumentUpdate {
    pageVariables?: Partial<PageVariables>;
    componentInstances?: ComponentInstance[];
    dataSources?: ComponentDataSource[];
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Component Registry
// ============================================================================

export interface ComponentRegistryEntry {
    type: CanvasComponentType;
    displayName: string;
    icon?: string;
    description?: string;
    defaults: {
        dataRef: ComponentDataReference;
        layout: ComponentLayoutConfig;
        variables?: Record<string, unknown>;
    };
    component: React.ComponentType<CanvasComponentProps> | React.LazyExoticComponent<React.ComponentType<CanvasComponentProps>>;
}

export interface CanvasComponentProps {
    id: string;
    dataRef: ComponentDataReference;
    variables?: Record<string, unknown>;
    layout: ComponentLayoutConfig;
    mode: PageMode;
    pageVariables: PageVariables;
    dataSources: ComponentDataSource[];
    isEditMode?: boolean;
    onUpdateData?: (updates: unknown) => void;
    region?: {
        page: number;
        column: 1 | 2;
        index: number;
    };
    regionContent?: RegionListContent;
    regionOverflow?: boolean;
}

export interface PageLoadResponse {
    page: StatblockPageDocument;
    template: TemplateConfig;
}

