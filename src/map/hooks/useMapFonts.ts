/**
 * useMapFonts Hook (T061)
 * 
 * Loads and manages fantasy fonts for map labels using the FontFace API.
 * Ensures fonts are loaded before rendering labels to prevent layout shifts.
 */

import { useState, useEffect } from 'react';
import { FONT_OPTIONS } from '../types/map.types';

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
export function useMapFonts(): UseMapFontsResult {
  const [fontsReady, setFontsReady] = useState(false);
  const [fontsLoading, setFontsLoading] = useState(false);

  useEffect(() => {
    // Check if document.fonts API is available
    if (!document.fonts) {
      console.warn('⚠️ [MapFonts] document.fonts API not available');
      return;
    }

    // Check if fonts are already loaded
    const checkFontsReady = () => {
      const allReady = FONT_OPTIONS.every((font) => {
        return document.fonts.check(`16px ${font}`);
      });
      return allReady;
    };

    // If fonts are already ready, set state immediately
    if (checkFontsReady()) {
      setFontsReady(true);
      return;
    }

    // Load all fonts
    const loadFonts = async () => {
      setFontsLoading(true);
      console.log('🔤 [MapFonts] Loading fantasy fonts...');

      try {
        // Load all fonts in parallel
        const loadPromises = FONT_OPTIONS.map((font) => {
          return document.fonts.load(`16px ${font}`);
        });

        await Promise.all(loadPromises);

        // Verify fonts are loaded
        const allReady = checkFontsReady();
        if (allReady) {
          setFontsReady(true);
          console.log('✅ [MapFonts] All fonts loaded successfully');
        } else {
          console.warn('⚠️ [MapFonts] Some fonts may not be loaded');
          // Still set ready to true to avoid blocking UI
          setFontsReady(true);
        }
      } catch (error) {
        console.error('❌ [MapFonts] Error loading fonts:', error);
        // Set ready anyway to avoid blocking UI
        setFontsReady(true);
      } finally {
        setFontsLoading(false);
      }
    };

    loadFonts();
  }, []); // Run once on mount

  return {
    fontsReady,
    fontsLoading,
  };
}
