/**
 * MapViewport Component Tests (TDD)
 * 
 * Tests for the main Konva Stage component that renders
 * base image, grid overlay, and labels.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MapViewport } from '../MapViewport';
import { DEFAULT_GRID_CONFIG } from '../../types/map.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Stage: ({ children, width, height, draggable, ...props }: any) => (
    <div 
      data-testid="konva-stage" 
      width={width} 
      height={height}
      draggable={draggable ? 'true' : undefined}
    >
      {children}
    </div>
  ),
  Layer: ({ children, listening, ...props }: any) => (
    <div data-testid="konva-layer">
      {children}
    </div>
  ),
  Image: ({ image, ...props }: any) => <div data-testid="konva-image" />,
  Line: ({ points, stroke, ...props }: any) => <div data-testid="konva-line" />,
  Text: ({ text, ...props }: any) => <div data-testid="konva-text" />,
}));

// Mock use-image hook
jest.mock('use-image', () => ({
  __esModule: true,
  default: (url: string) => {
    if (!url) return [null, 'loading'];
    return [{ width: 1024, height: 1024 }, 'loaded'];
  },
}));

describe('MapViewport', () => {
  const defaultProps = {
    width: 800,
    height: 600,
    baseImageUrl: 'https://example.com/map.png',
    gridConfig: DEFAULT_GRID_CONFIG,
    labels: [],
    onLabelUpdate: jest.fn(),
  };

  describe('base rendering', () => {
    it('should render a Konva Stage', () => {
      render(<MapViewport {...defaultProps} />);
      
      expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
    });

    it('should render with correct dimensions', () => {
      render(<MapViewport {...defaultProps} width={1200} height={900} />);
      
      const stage = screen.getByTestId('konva-stage');
      expect(stage).toHaveAttribute('width', '1200');
      expect(stage).toHaveAttribute('height', '900');
    });

    it('should render at least one Layer', () => {
      render(<MapViewport {...defaultProps} />);
      
      const layers = screen.getAllByTestId('konva-layer');
      expect(layers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('layer structure', () => {
    it('should render 3 layers (base, grid, labels)', () => {
      render(
        <MapViewport
          {...defaultProps}
          gridConfig={{ ...DEFAULT_GRID_CONFIG, visible: true }}
        />
      );
      
      const layers = screen.getAllByTestId('konva-layer');
      expect(layers.length).toBe(3);
    });

    it('should not render grid layer when grid is not visible', () => {
      render(
        <MapViewport
          {...defaultProps}
          gridConfig={{ ...DEFAULT_GRID_CONFIG, visible: false }}
        />
      );
      
      // Should have 2 layers: base image and labels (grid hidden)
      const layers = screen.getAllByTestId('konva-layer');
      expect(layers.length).toBe(2);
    });
  });

  describe('base image layer', () => {
    it('should render base image when URL is provided', () => {
      render(<MapViewport {...defaultProps} />);
      
      expect(screen.getByTestId('konva-image')).toBeInTheDocument();
    });

    it('should not crash when baseImageUrl is empty', () => {
      render(<MapViewport {...defaultProps} baseImageUrl="" />);
      
      expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
    });
  });

  describe('grid layer', () => {
    it('should render grid lines when grid is visible', () => {
      render(
        <MapViewport
          {...defaultProps}
          gridConfig={{ ...DEFAULT_GRID_CONFIG, visible: true }}
        />
      );
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('labels layer', () => {
    it('should render labels when provided', () => {
      const labels = [
        {
          id: 'label-1',
          text: 'Test Label',
          x: 100,
          y: 100,
          rotation: 0 as const,
          fontFamily: 'MedievalSharp' as const,
          fontSize: 24,
          color: '#000000',
        },
      ];

      render(<MapViewport {...defaultProps} labels={labels} />);
      
      expect(screen.getByTestId('konva-text')).toBeInTheDocument();
    });

    it('should render multiple labels', () => {
      const labels = [
        {
          id: 'label-1',
          text: 'Label 1',
          x: 100,
          y: 100,
          rotation: 0 as const,
          fontFamily: 'MedievalSharp' as const,
          fontSize: 24,
          color: '#000000',
        },
        {
          id: 'label-2',
          text: 'Label 2',
          x: 200,
          y: 200,
          rotation: 45 as const,
          fontFamily: 'Cinzel' as const,
          fontSize: 18,
          color: '#FF0000',
        },
      ];

      render(<MapViewport {...defaultProps} labels={labels} />);
      
      const textElements = screen.getAllByTestId('konva-text');
      expect(textElements.length).toBe(2);
    });
  });

  describe('interactivity', () => {
    it('should have Stage set as draggable for panning', () => {
      render(<MapViewport {...defaultProps} />);
      
      const stage = screen.getByTestId('konva-stage');
      expect(stage).toHaveAttribute('draggable', 'true');
    });
  });
});
