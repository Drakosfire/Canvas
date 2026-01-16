/**
 * useMapFonts Hook (T061)
 *
 * Loads and manages fantasy fonts for map labels using the FontFace API.
 * Ensures fonts are loaded before rendering labels to prevent layout shifts.
 */
export interface UseMapFontsResult {
    /** Whether all fonts are loaded and ready */
    fontsReady: boolean;
    /** Whether fonts are currently loading */
    fontsLoading: boolean;
}
/**
 * Hook that loads all required fantasy fonts for map labels.
 * Uses document.fonts.load() to ensure fonts are available before rendering.
 *
 * @returns Font loading state
 */
export declare function useMapFonts(): UseMapFontsResult;
//# sourceMappingURL=useMapFonts.d.ts.map