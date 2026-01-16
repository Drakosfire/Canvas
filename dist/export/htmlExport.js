/**
 * HTML Export Utilities
 *
 * Export statblock canvas to standalone HTML file.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { computeBasePageDimensions } from '../layout/utils';
/**
 * Get absolute CSS URL for exported HTML files
 * Always uses production URL so exported files work when opened locally
 */
function getExportCssBaseUrl() {
    var _a;
    // Check for explicit env var first
    var envUrl = (_a = process.env.REACT_APP_DND_CSS_BASE_URL) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, '');
    if (envUrl && envUrl.startsWith('http')) {
        return envUrl;
    }
    // Always use production URL for exports so files work standalone
    return 'https://www.dungeonmind.net/dnd-static';
}
/**
 * Capture rendered statblock DOM from the page
 */
function captureStatblockDOM() {
    // Find the main pages-content container (the canvas rendering area)
    var pagesContent = document.querySelector('.pages-content');
    if (!pagesContent) {
        console.error('[Export] Could not find .pages-content element');
        return '<p>Error: Could not capture statblock content</p>';
    }
    // Clone the DOM to avoid modifying the live page
    var contentClone = pagesContent.cloneNode(true);
    // Remove all edit mode controls and interactive elements
    var editControls = contentClone.querySelectorAll('[data-edit-control], [contenteditable="true"]');
    editControls.forEach(function (control) {
        if (control instanceof HTMLElement) {
            // Remove contenteditable attribute
            control.removeAttribute('contenteditable');
            control.removeAttribute('data-edit-control');
        }
    });
    // Remove any buttons or action icons
    var buttons = contentClone.querySelectorAll('button, [role="button"]');
    buttons.forEach(function (button) { return button.remove(); });
    // Return the cleaned HTML
    return contentClone.outerHTML;
}
/**
 * Generate standalone HTML from page document
 */
export function exportToHTML(page, template, baseDimensions, adapters, options) {
    if (options === void 0) { options = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var _a, includeStyles, _b, includeMetadata, _c, title, creatureName, cssBaseUrl, cssLinks, metadata, printStyles, statblockContent;
        return __generator(this, function (_d) {
            _a = options.includeStyles, includeStyles = _a === void 0 ? true : _a, _b = options.includeMetadata, includeMetadata = _b === void 0 ? true : _b, _c = options.title, title = _c === void 0 ? 'D&D 5e Statblock' : _c;
            creatureName = adapters.metadataExtractor.extractDisplayName(page.dataSources) || 'Creature';
            cssBaseUrl = getExportCssBaseUrl();
            cssLinks = includeStyles
                ? "\n    <!-- D&D 5e PHB Styles from CDN -->\n    <link rel=\"stylesheet\" href=\"".concat(cssBaseUrl, "/all.css\">\n    <link rel=\"stylesheet\" href=\"").concat(cssBaseUrl, "/bundle.css\">\n    <link rel=\"stylesheet\" href=\"").concat(cssBaseUrl, "/style.css\">\n    <link rel=\"stylesheet\" href=\"").concat(cssBaseUrl, "/5ePHBstyle.css\">\n    ")
                : '';
            metadata = includeMetadata
                ? "\n    <meta name=\"generator\" content=\"DungeonMind StatBlock Generator\">\n    <meta name=\"template\" content=\"".concat(template.name, "\">\n    <meta name=\"creature\" content=\"").concat(creatureName, "\">\n    <meta name=\"created\" content=\"").concat(new Date().toISOString(), "\">\n    ")
                : '';
            printStyles = "\n    <style>\n        /* General page styles */\n        body {\n            font-family: 'Bookinsanity', 'Book Antiqua', serif;\n            background: #f0f0f0;\n            margin: 0;\n            padding: 20px;\n        }\n        \n        .export-container {\n            max-width: ".concat(baseDimensions.widthPx, "px;\n            margin: 0 auto;\n            background: white;\n            padding: 0;\n            box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n        }\n        \n        .export-header {\n            text-align: center;\n            margin-bottom: 20px;\n            padding: 20px 20px 10px;\n            border-bottom: 2px solid #c0ad6a;\n            background: #f9f7f0;\n        }\n        \n        .export-header h1 {\n            margin: 0 0 5px;\n            color: #58180d;\n            font-size: 1.8em;\n            font-family: 'MrEavesRemake', 'Mr Eaves Small Caps', 'Times New Roman', serif;\n        }\n        \n        .export-header p {\n            margin: 0;\n            color: #766;\n            font-size: 0.9em;\n        }\n        \n        .export-footer {\n            margin-top: 0;\n            padding: 20px;\n            border-top: 2px solid #c0ad6a;\n            background: #f9f7f0;\n            text-align: center;\n            color: #666;\n            font-size: 0.9em;\n        }\n        \n        /* DungeonMind statblock container */\n        .pages-content {\n            background: white;\n        }\n        \n        /* Canvas responsive container */\n        .dm-statblock-responsive {\n            transform: none !important;\n            max-width: ").concat(baseDimensions.widthPx, "px !important;\n            margin: 0 auto;\n            width: 100% !important;\n        }\n        \n        /* Page structure - CRITICAL: Match pagination system heights */\n        .page {\n            width: ").concat(baseDimensions.widthPx, "px !important;\n            height: ").concat(baseDimensions.heightPx, "px !important;\n            margin: 0 auto;\n            padding: ").concat(baseDimensions.topMarginPx, "px 1cm ").concat(baseDimensions.bottomMarginPx, "px 1cm;\n            background: white;\n            position: relative;\n            box-sizing: border-box;\n        }\n        \n        /* Column wrapper - CRITICAL: Use contentHeightPx (same as regionHeightPx in pagination) */\n        .columnWrapper {\n            display: flex;\n            gap: 12px;\n            width: 100%;\n            height: ").concat(baseDimensions.contentHeightPx, "px !important;\n            max-height: ").concat(baseDimensions.contentHeightPx, "px;\n            overflow: hidden;\n        }\n        \n        /* Monster frame - inherit from columnWrapper */\n        .monster.frame.wide {\n            flex: 1 1 auto;\n            display: flex;\n            width: 100%;\n            height: 100%;\n            max-width: 100%;\n            box-sizing: border-box;\n        }\n        \n        /* Canvas column - flex layout */\n        .canvas-column {\n            flex: 1 1 0;\n            display: flex;\n            flex-direction: column;\n            gap: 12px;\n        }\n        \n        /* Remove edit mode styling */\n        [contenteditable=\"true\"] {\n            outline: none !important;\n            cursor: default !important;\n        }\n        \n        /* DungeonMind Component Styles */\n        \n        /* Canvas entry spacing - matches COMPONENT_VERTICAL_SPACING_PX = 12 */\n        .canvas-entry {\n            margin-bottom: 12px;\n        }\n        \n        .canvas-entry:last-child {\n            margin-bottom: 0;\n        }\n        \n        .dm-pagination-marker {\n            font-family: 'BookInsanityRemake', serif;\n            font-size: 0.95rem;\n            text-transform: uppercase;\n            letter-spacing: 0.05em;\n            color: rgba(88, 24, 13, 0.8);\n            text-align: right;\n            margin-bottom: 0.75rem;\n        }\n        \n        .dm-identity-header {\n            text-align: left;\n            color: #58180d;\n            position: relative;\n        }\n        \n        .dm-monster-name {\n            font-family: 'BookInsanityRemake', 'NodestoCapsCondensed', serif;\n            font-size: 2.2rem;\n            letter-spacing: 0.02em;\n            margin: 0;\n            line-height: 1.1;\n        }\n        \n        .dm-monster-meta {\n            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;\n            font-size: 1rem;\n            margin: 0.3rem 0 0;\n            color: #2b1d0f;\n        }\n        \n        .dm-stat-summary {\n            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;\n            font-size: 0.95rem;\n            background: rgba(255, 255, 255, 0.65);\n            padding: 0.75rem 1rem;\n            border-radius: 4px;\n            border-left: 4px solid #a11d18;\n            box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);\n        }\n        \n        .dm-stat-summary dt {\n            font-weight: 700;\n            color: #58180d;\n        }\n        \n        .dm-stat-summary dd {\n            font-weight: 600;\n            margin-bottom: 0.4rem;\n        }\n        \n        .dm-ability-table {\n            width: 100%;\n            border-collapse: collapse;\n            text-align: center;\n            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;\n            font-size: 0.95rem;\n            background: rgba(247, 235, 215, 0.85);\n            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);\n        }\n        \n        .dm-ability-table th {\n            background: linear-gradient(180deg, rgba(143, 36, 28, 0.9) 0%, rgba(90, 22, 18, 0.9) 100%);\n            color: #fdf6ea;\n            padding: 0.4rem 0;\n            font-weight: 700;\n        }\n        \n        .dm-ability-table td {\n            padding: 0.5rem 0;\n            color: #2b1d0f;\n        }\n        \n        .dm-ability-value {\n            display: flex;\n            flex-direction: column;\n            align-items: center;\n            gap: 0.2rem;\n            font-weight: 700;\n        }\n        \n        .dm-ability-value span:last-child {\n            font-size: 0.85rem;\n            font-weight: 600;\n            color: #58180d;\n        }\n        \n        .dm-quickfacts {\n            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;\n            font-size: 0.95rem;\n            background: rgba(255, 249, 237, 0.8);\n            padding: 0.5rem 0.8rem;\n            border-radius: 4px;\n            border-left: 4px solid rgba(161, 29, 24, 0.8);\n            box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);\n        }\n        \n        .dm-quickfacts-row {\n            display: flex;\n            gap: 0.3rem;\n            margin-bottom: 0.25rem;\n        }\n        \n        .dm-quickfacts-row strong {\n            color: #58180d;\n            font-weight: 700;\n        }\n        \n        .dm-quickfacts-row span {\n            font-weight: 600;\n        }\n        \n        .dm-action-section,\n        .dm-trait-section,\n        .dm-bonus-action-section,\n        .dm-reaction-section,\n        .dm-legendary-section,\n        .dm-lair-section,\n        .dm-spellcasting-section {\n            font-family: 'ScalySansRemake', 'Open Sans', sans-serif;\n            background: rgba(255, 255, 255, 0.7);\n            padding: 0.8rem 1rem;\n            border-radius: 4px;\n            box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);\n            margin-bottom: 0.6rem;\n        }\n        \n        .dm-section-heading {\n            font-family: 'BookInsanityRemake', serif;\n            color: #a11d18;\n            text-transform: uppercase;\n            letter-spacing: 0.05em;\n            margin: 0 0 0.6rem;\n        }\n        \n        .dm-action-list {\n            margin: 0;\n            padding: 0;\n        }\n        \n        .dm-action-term {\n            font-family: 'BookInsanityRemake', serif;\n            font-size: 1.05rem;\n            margin: 0;\n            color: #58180d;\n        }\n        \n        .dm-action-term strong {\n            font-weight: 700;\n        }\n        \n        .dm-action-description {\n            margin: 0.25rem 0 0.5rem;\n            color: #2b1d0f;\n            line-height: 1.35;\n        }\n        \n        .dm-action-divider {\n            height: 1px;\n            width: 100%;\n            background: rgba(88, 24, 13, 0.25);\n            margin: 0.4rem 0 0.6rem;\n        }\n        \n        .dm-legendary-summary,\n        .dm-lair-summary,\n        .dm-spellcasting-summary {\n            margin: 0.4rem 0 0.6rem;\n            font-style: italic;\n            color: rgba(43, 29, 15, 0.9);\n        }\n        \n        .monster-portrait {\n            text-align: center;\n            margin: 0.35cm auto;\n            max-width: 100%;\n        }\n        \n        .monster-portrait__image {\n            display: inline-block;\n            max-width: 100%;\n            height: auto;\n            border: 2px solid rgba(34, 20, 12, 0.4);\n            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);\n            mix-blend-mode: multiply;\n        }\n        \n        /* Print media query */\n        @media print {\n            body {\n                margin: 0;\n                padding: 0;\n                background: white;\n            }\n            \n            .no-print {\n                display: none !important;\n            }\n            \n            .export-header,\n            .export-footer {\n                display: none !important;\n            }\n            \n            .export-container {\n                box-shadow: none;\n                margin: 0;\n                padding: 0;\n            }\n            \n            .page {\n                page-break-after: always;\n                break-after: page;\n                margin: 0;\n                box-shadow: none;\n                border: none;\n            }\n            \n            .page:last-child {\n                page-break-after: auto;\n                break-after: auto;\n            }\n        }\n    </style>\n    ");
            statblockContent = captureStatblockDOM();
            return [2 /*return*/, "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>".concat(title, " - ").concat(creatureName, "</title>\n    ").concat(metadata, "\n    ").concat(cssLinks, "\n    ").concat(printStyles, "\n</head>\n<body>\n    <div class=\"export-container\">\n        <div class=\"export-header no-print\">\n            <h1>").concat(creatureName, "</h1>\n            <p>Generated by DungeonMind StatBlock Generator</p>\n        </div>\n        \n        <div class=\"brewRenderer\">\n            ").concat(statblockContent, "\n        </div>\n        \n        <div class=\"export-footer no-print\">\n            <p>Created on ").concat(new Date().toLocaleDateString(), "</p>\n            <p>Template: ").concat(template.name, "</p>\n            <button onclick=\"window.print()\" style=\"padding: 8px 16px; cursor: pointer; background: #58180d; color: white; border: none; border-radius: 4px;\">Print / Save as PDF</button>\n        </div>\n    </div>\n</body>\n</html>")];
        });
    });
}
/**
 * Download HTML as file
 */
export function downloadHTML(html, filename) {
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
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
export function exportPageToHTMLFile(page, template, adapters) {
    return __awaiter(this, void 0, void 0, function () {
        var creatureName, filename, baseDimensions, html;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    creatureName = adapters.metadataExtractor.extractDisplayName(page.dataSources) || 'Creature';
                    filename = "".concat(creatureName.replace(/[^a-z0-9]/gi, '_').toLowerCase(), "_statblock.html");
                    baseDimensions = computeBasePageDimensions(page.pageVariables);
                    return [4 /*yield*/, exportToHTML(page, template, baseDimensions, adapters, {
                            title: creatureName,
                            includeStyles: true,
                            includeMetadata: true,
                        })];
                case 1:
                    html = _a.sent();
                    downloadHTML(html, filename);
                    return [2 /*return*/];
            }
        });
    });
}
