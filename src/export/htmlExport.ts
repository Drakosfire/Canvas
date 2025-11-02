/**
 * HTML Export Utilities
 * 
 * Export statblock canvas to standalone HTML file.
 */

import type { StatblockPageDocument, TemplateConfig } from '../types/canvas.types';
import type { CanvasAdapters } from '../types/adapters.types';
import type { BasePageDimensions } from '../layout/utils';
import { computeBasePageDimensions } from '../layout/utils';

interface ExportOptions {
    includeStyles?: boolean;
    includeMetadata?: boolean;
    title?: string;
}

/**
 * Get absolute CSS URL for exported HTML files
 * Always uses production URL so exported files work when opened locally
 */
function getExportCssBaseUrl(): string {
    // Check for explicit env var first
    const envUrl = process.env.REACT_APP_DND_CSS_BASE_URL?.replace(/\/$/, '');
    if (envUrl && envUrl.startsWith('http')) {
        return envUrl;
    }

    // Always use production URL for exports so files work standalone
    return 'https://www.dungeonmind.net/dnd-static';
}

/**
 * Capture rendered statblock DOM from the page
 */
function captureStatblockDOM(): string {
    // Find the main pages-content container (the canvas rendering area)
    const pagesContent = document.querySelector('.pages-content');

    if (!pagesContent) {
        console.error('[Export] Could not find .pages-content element');
        return '<p>Error: Could not capture statblock content</p>';
    }

    // Clone the DOM to avoid modifying the live page
    const contentClone = pagesContent.cloneNode(true) as HTMLElement;

    // Remove all edit mode controls and interactive elements
    const editControls = contentClone.querySelectorAll('[data-edit-control], [contenteditable="true"]');
    editControls.forEach(control => {
        if (control instanceof HTMLElement) {
            // Remove contenteditable attribute
            control.removeAttribute('contenteditable');
            control.removeAttribute('data-edit-control');
        }
    });

    // Remove any buttons or action icons
    const buttons = contentClone.querySelectorAll('button, [role="button"]');
    buttons.forEach(button => button.remove());

    // Return the cleaned HTML
    return contentClone.outerHTML;
}

/**
 * Generate standalone HTML from page document
 */
export async function exportToHTML(
    page: StatblockPageDocument,
    template: TemplateConfig,
    baseDimensions: BasePageDimensions,
    adapters: CanvasAdapters,
    options: ExportOptions = {}
): Promise<string> {
    const {
        includeStyles = true,
        includeMetadata = true,
        title = 'D&D 5e Statblock',
    } = options;

    // Extract name from statblock data using adapter
    const creatureName = adapters.metadataExtractor.extractDisplayName(page.dataSources) || 'Creature';

    const cssBaseUrl = getExportCssBaseUrl();
    const cssLinks = includeStyles
        ? `
    <!-- D&D 5e PHB Styles from CDN -->
    <link rel="stylesheet" href="${cssBaseUrl}/all.css">
    <link rel="stylesheet" href="${cssBaseUrl}/bundle.css">
    <link rel="stylesheet" href="${cssBaseUrl}/style.css">
    <link rel="stylesheet" href="${cssBaseUrl}/5ePHBstyle.css">
    `
        : '';

    const metadata = includeMetadata
        ? `
    <meta name="generator" content="DungeonMind StatBlock Generator">
    <meta name="template" content="${template.name}">
    <meta name="creature" content="${creatureName}">
    <meta name="created" content="${new Date().toISOString()}">
    `
        : '';

    const printStyles = `
    <style>
        /* General page styles */
        body {
            font-family: 'Bookinsanity', 'Book Antiqua', serif;
            background: #f0f0f0;
            margin: 0;
            padding: 20px;
        }
        
        .export-container {
            max-width: ${baseDimensions.widthPx}px;
            margin: 0 auto;
            background: white;
            padding: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .export-header {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px 20px 10px;
            border-bottom: 2px solid #c0ad6a;
            background: #f9f7f0;
        }
        
        .export-header h1 {
            margin: 0 0 5px;
            color: #58180d;
            font-size: 1.8em;
            font-family: 'MrEavesRemake', 'Mr Eaves Small Caps', 'Times New Roman', serif;
        }
        
        .export-header p {
            margin: 0;
            color: #766;
            font-size: 0.9em;
        }
        
        .export-footer {
            margin-top: 0;
            padding: 20px;
            border-top: 2px solid #c0ad6a;
            background: #f9f7f0;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        
        /* DungeonMind statblock container */
        .pages-content {
            background: white;
        }
        
        /* Canvas responsive container */
        .dm-statblock-responsive {
            transform: none !important;
            max-width: ${baseDimensions.widthPx}px !important;
            margin: 0 auto;
            width: 100% !important;
        }
        
        /* Page structure - CRITICAL: Match pagination system heights */
        .page {
            width: ${baseDimensions.widthPx}px !important;
            height: ${baseDimensions.heightPx}px !important;
            margin: 0 auto;
            padding: ${baseDimensions.topMarginPx}px 1cm ${baseDimensions.bottomMarginPx}px 1cm;
            background: white;
            position: relative;
            box-sizing: border-box;
        }
        
        /* Column wrapper - CRITICAL: Use contentHeightPx (same as regionHeightPx in pagination) */
        .columnWrapper {
            display: flex;
            gap: 12px;
            width: 100%;
            height: ${baseDimensions.contentHeightPx}px !important;
            max-height: ${baseDimensions.contentHeightPx}px;
            overflow: hidden;
        }
        
        /* Monster frame - inherit from columnWrapper */
        .monster.frame.wide {
            flex: 1 1 auto;
            display: flex;
            width: 100%;
            height: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }
        
        /* Canvas column - flex layout */
        .canvas-column {
            flex: 1 1 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        /* Remove edit mode styling */
        [contenteditable="true"] {
            outline: none !important;
            cursor: default !important;
        }
        
        /* DungeonMind Component Styles */
        
        /* Canvas entry spacing - matches COMPONENT_VERTICAL_SPACING_PX = 12 */
        .canvas-entry {
            margin-bottom: 12px;
        }
        
        .canvas-entry:last-child {
            margin-bottom: 0;
        }
        
        .dm-pagination-marker {
            font-family: 'BookInsanityRemake', serif;
            font-size: 0.95rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: rgba(88, 24, 13, 0.8);
            text-align: right;
            margin-bottom: 0.75rem;
        }
        
        .dm-identity-header {
            text-align: left;
            color: #58180d;
            position: relative;
        }
        
        .dm-monster-name {
            font-family: 'BookInsanityRemake', 'NodestoCapsCondensed', serif;
            font-size: 2.2rem;
            letter-spacing: 0.02em;
            margin: 0;
            line-height: 1.1;
        }
        
        .dm-monster-meta {
            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;
            font-size: 1rem;
            margin: 0.3rem 0 0;
            color: #2b1d0f;
        }
        
        .dm-stat-summary {
            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;
            font-size: 0.95rem;
            background: rgba(255, 255, 255, 0.65);
            padding: 0.75rem 1rem;
            border-radius: 4px;
            border-left: 4px solid #a11d18;
            box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);
        }
        
        .dm-stat-summary dt {
            font-weight: 700;
            color: #58180d;
        }
        
        .dm-stat-summary dd {
            font-weight: 600;
            margin-bottom: 0.4rem;
        }
        
        .dm-ability-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;
            font-size: 0.95rem;
            background: rgba(247, 235, 215, 0.85);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
        }
        
        .dm-ability-table th {
            background: linear-gradient(180deg, rgba(143, 36, 28, 0.9) 0%, rgba(90, 22, 18, 0.9) 100%);
            color: #fdf6ea;
            padding: 0.4rem 0;
            font-weight: 700;
        }
        
        .dm-ability-table td {
            padding: 0.5rem 0;
            color: #2b1d0f;
        }
        
        .dm-ability-value {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.2rem;
            font-weight: 700;
        }
        
        .dm-ability-value span:last-child {
            font-size: 0.85rem;
            font-weight: 600;
            color: #58180d;
        }
        
        .dm-quickfacts {
            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;
            font-size: 0.95rem;
            background: rgba(255, 249, 237, 0.8);
            padding: 0.5rem 0.8rem;
            border-radius: 4px;
            border-left: 4px solid rgba(161, 29, 24, 0.8);
            box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
        }
        
        .dm-quickfacts-row {
            display: flex;
            gap: 0.3rem;
            margin-bottom: 0.25rem;
        }
        
        .dm-quickfacts-row strong {
            color: #58180d;
            font-weight: 700;
        }
        
        .dm-quickfacts-row span {
            font-weight: 600;
        }
        
        .dm-action-section,
        .dm-trait-section,
        .dm-bonus-action-section,
        .dm-reaction-section,
        .dm-legendary-section,
        .dm-lair-section,
        .dm-spellcasting-section {
            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;
            background: rgba(255, 255, 255, 0.7);
            padding: 0.8rem 1rem;
            border-radius: 4px;
            box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 0.6rem;
        }
        
        .dm-section-heading {
            font-family: 'BookInsanityRemake', serif;
            color: #a11d18;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 0.6rem;
        }
        
        .dm-action-list {
            margin: 0;
            padding: 0;
        }
        
        .dm-action-term {
            font-family: 'BookInsanityRemake', serif;
            font-size: 1.05rem;
            margin: 0;
            color: #58180d;
        }
        
        .dm-action-term strong {
            font-weight: 700;
        }
        
        .dm-action-description {
            margin: 0.25rem 0 0.5rem;
            color: #2b1d0f;
            line-height: 1.35;
        }
        
        .dm-action-divider {
            height: 1px;
            width: 100%;
            background: rgba(88, 24, 13, 0.25);
            margin: 0.4rem 0 0.6rem;
        }
        
        .dm-legendary-summary,
        .dm-lair-summary,
        .dm-spellcasting-summary {
            margin: 0.4rem 0 0.6rem;
            font-style: italic;
            color: rgba(43, 29, 15, 0.9);
        }
        
        .monster-portrait {
            text-align: center;
            margin: 0.35cm auto;
            max-width: 100%;
        }
        
        .monster-portrait__image {
            display: inline-block;
            max-width: 100%;
            height: auto;
            border: 2px solid rgba(34, 20, 12, 0.4);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            mix-blend-mode: multiply;
        }
        
        /* Print media query */
        @media print {
            body {
                margin: 0;
                padding: 0;
                background: white;
            }
            
            .no-print {
                display: none !important;
            }
            
            .export-header,
            .export-footer {
                display: none !important;
            }
            
            .export-container {
                box-shadow: none;
                margin: 0;
                padding: 0;
            }
            
            .page {
                page-break-after: always;
                break-after: page;
                margin: 0;
                box-shadow: none;
                border: none;
            }
            
            .page:last-child {
                page-break-after: auto;
                break-after: auto;
            }
        }
    </style>
    `;

    // Capture the actual rendered DOM from the canvas
    const statblockContent = captureStatblockDOM();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${creatureName}</title>
    ${metadata}
    ${cssLinks}
    ${printStyles}
</head>
<body>
    <div class="export-container">
        <div class="export-header no-print">
            <h1>${creatureName}</h1>
            <p>Generated by DungeonMind StatBlock Generator</p>
        </div>
        
        <div class="brewRenderer">
            ${statblockContent}
        </div>
        
        <div class="export-footer no-print">
            <p>Created on ${new Date().toLocaleDateString()}</p>
            <p>Template: ${template.name}</p>
            <button onclick="window.print()" style="padding: 8px 16px; cursor: pointer; background: #58180d; color: white; border: none; border-radius: 4px;">Print / Save as PDF</button>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Download HTML as file
 */
export function downloadHTML(html: string, filename: string): void {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export page document to HTML file
 */
export async function exportPageToHTMLFile(
    page: StatblockPageDocument,
    template: TemplateConfig,
    adapters: CanvasAdapters
): Promise<void> {
    // Extract name from statblock data using adapter
    const creatureName = adapters.metadataExtractor.extractDisplayName(page.dataSources) || 'Creature';
    const filename = `${creatureName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_statblock.html`;

    // Compute base page dimensions (matches what pagination system uses)
    const baseDimensions = computeBasePageDimensions(page.pageVariables);

    const html = await exportToHTML(page, template, baseDimensions, adapters, {
        title: creatureName,
        includeStyles: true,
        includeMetadata: true,
    });

    downloadHTML(html, filename);
}


