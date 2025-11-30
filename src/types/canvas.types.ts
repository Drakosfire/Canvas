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

export interface PageMargins {
    topMm: number;
    bottomMm: number;
    leftMm?: number;
    rightMm?: number;
}

export interface PageVariables {
    mode: PageMode;
    dimensions: PageDimensions;
    background: PageBackgroundConfig;
    columns: ColumnConfig;
    pagination: PaginationConfig;
    snap: SnapConfig;
    margins?: PageMargins;
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

export interface PageDocument {
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
    page: PageDocument;
    template: TemplateConfig;
}

// ============================================================================
// Canvas Configuration (Phase 5 Architectural Contracts)
// ============================================================================

/**
 * Debug configuration for Canvas operations.
 */
export interface CanvasDebugConfig {
    /** Log measurement events */
    logMeasurements?: boolean;
    /** Log pagination decisions */
    logPagination?: boolean;
    /** Log timing/ready state changes */
    logTiming?: boolean;
    /** Log width verification */
    logWidthVerification?: boolean;
}

/**
 * Theme-specific frame configuration.
 * Tells Canvas how much space theme containers (frames, borders) consume.
 * 
 * This allows Canvas to calculate accurate dimensions without the consumer
 * needing to do complex calculations.
 * 
 * @example PHB Theme
 * ```typescript
 * const PHB_FRAME_CONFIG: FrameConfig = {
 *     verticalBorderPx: 12.5,      // 6.25px top + 6.25px bottom
 *     horizontalBorderPx: 10,      // 5px left + 5px right
 *     columnPaddingPx: 10,         // 5px left + 5px right per column
 *     columnVerticalPaddingPx: 16, // 8px top + 8px bottom
 *     componentGapPx: 12,          // gap between components
 *     pageFontSizePx: 12.8504,     // .page.phb computed font-size
 *     frameFontSizePx: 12.0189,    // .monster.frame computed font-size
 * };
 * ```
 */
export interface FrameConfig {
    /**
     * Vertical border thickness (top + bottom).
     * Example: PHB theme's .monster.frame has 6.25px top + 6.25px bottom = 12.5px
     */
    verticalBorderPx: number;

    /**
     * Horizontal border thickness (left + right).
     * Example: PHB theme's .monster.frame has 5px left + 5px right = 10px
     */
    horizontalBorderPx?: number;

    /**
     * Column padding (left + right per column).
     * Example: PHB theme columns have 5px left + 5px right = 10px per column
     */
    columnPaddingPx?: number;

    /**
     * Column vertical padding (top + bottom).
     * Example: PHB theme columns have 8px top + 8px bottom = 16px
     */
    columnVerticalPaddingPx?: number;

    /**
     * Gap between components in a column.
     * Example: PHB theme uses 12px gap between components
     */
    componentGapPx?: number;

    /**
     * CSS font-size context for the page container.
     * Used when rendering measurement layer to match visible layer font metrics.
     * Example: PHB theme's .page.phb has computed font-size ~12.85px
     */
    pageFontSizePx?: number;

    /**
     * CSS font-size context for the inner frame.
     * Example: PHB theme's .monster.frame has computed font-size ~12.02px
     */
    frameFontSizePx?: number;

    /**
     * CSS class names for the measurement portal structure.
     * Allows themes to specify their own class hierarchy.
     */
    portalClassNames?: {
        /** Class for outer page container (default: 'page phb') */
        page?: string;
        /** Class for frame container (default: 'monster frame wide') */
        frame?: string;
        /** Class for column container (default: 'canvas-column') */
        column?: string;
    };
}

/**
 * Configuration provided by consumer to Canvas.
 * Canvas uses this to calculate all internal dimensions.
 * 
 * This is the primary contract between Canvas and its consumers.
 * Consumer provides configuration, Canvas calculates everything else.
 * 
 * @example
 * ```typescript
 * const config: CanvasConfig = {
 *     pageVariables,
 *     frameConfig: PHB_FRAME_CONFIG,
 *     ready: fontsReady && themeLoaded,
 * };
 * ```
 */
export interface CanvasConfig {
    /**
     * Page dimensions and layout settings.
     */
    pageVariables: PageVariables;

    /**
     * Theme-specific frame/container configuration.
     * Tells Canvas how much space the theme's containers consume.
     * If not provided, Canvas assumes no frame borders/padding.
     */
    frameConfig?: FrameConfig;

    /**
     * Ready signal: Consumer confirms CSS and fonts are loaded.
     * Canvas will NOT measure until ready=true.
     * 
     * Typically: `fontsReady && themeLoaded`
     */
    ready: boolean;

    /**
     * Optional debug settings.
     */
    debug?: CanvasDebugConfig;
}

/**
 * Calculated dimensions returned by Canvas.
 * These are derived from CanvasConfig and should NOT be calculated by consumers.
 */
export interface CanvasDimensions {
    /** Full page width in pixels */
    pageWidthPx: number;
    /** Full page height in pixels */
    pageHeightPx: number;
    /** Content area width (page - margins) */
    contentWidthPx: number;
    /** Content area height (page - top/bottom margins) */
    contentHeightPx: number;
    /** Width of each column */
    columnWidthPx: number;
    /** Gap between columns */
    columnGapPx: number;
    /** Available height for pagination (content - frame borders) */
    regionHeightPx: number;
    /** Width for measurement entries (column - padding) */
    entryWidthPx: number;
    /** Left margin in pixels */
    leftMarginPx: number;
    /** Right margin in pixels */
    rightMarginPx: number;
    /** Top margin in pixels */
    topMarginPx: number;
    /** Bottom margin in pixels */
    bottomMarginPx: number;
}

