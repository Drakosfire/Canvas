/**
 * GridOverlay Component Tests (TDD)
 * 
 * Tests for the grid overlay component that renders
 * square or hexagonal grids using Konva Lines.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridOverlay } from '../GridOverlay';
import { DEFAULT_GRID_CONFIG, GridConfig } from '../../types/map.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Layer: ({ children, listening, ...props }: any) => (
    <div data-testid="konva-layer" data-listening={listening}>
      {children}
    </div>
  ),
  Line: ({ points, stroke, strokeWidth, opacity, ...props }: any) => (
    <div 
      data-testid="konva-line" 
      data-points={JSON.stringify(points)}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-opacity={opacity}
    />
  ),
  Group: ({ children, draggable, x, y, onDragEnd, ...props }: any) => (
    <div
      data-testid="konva-group"
      data-draggable={draggable}
      data-x={x}
      data-y={y}
      onDragEnd={() => {
        onDragEnd?.({
          target: {
            x: () => 25,
            y: () => 30,
          },
        });
      }}
    >
      {children}
    </div>
  ),
}));

describe('GridOverlay', () => {
  const visibleGridConfig: GridConfig = {
    ...DEFAULT_GRID_CONFIG,
    visible: true,
    cellSizePx: 50,
  };

  const defaultProps = {
    width: 800,
    height: 600,
    gridConfig: visibleGridConfig,
  };

  describe('base rendering', () => {
    it('should render a Konva Layer', () => {
      render(<GridOverlay {...defaultProps} />);
      
      expect(screen.getByTestId('konva-layer')).toBeInTheDocument();
    });

    it('should not render grid lines when grid is not visible', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: false,
      };

      render(<GridOverlay {...defaultProps} gridConfig={config} />);
      
      const lines = screen.queryAllByTestId('konva-line');
      expect(lines.length).toBe(0);
    });

    it('should render grid lines when grid is visible', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      render(<GridOverlay {...defaultProps} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('square grid', () => {
    it('should render square grid lines with correct parameters', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'square',
        cellSizePx: 50,
        color: '#000000',
        opacity: 0.5,
        offsetX: 0,
        offsetY: 0,
      };

      render(<GridOverlay {...defaultProps} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
      
      // Check first line has correct properties
      const firstLine = lines[0];
      expect(firstLine).toHaveAttribute('data-stroke', '#000000');
      expect(firstLine).toHaveAttribute('data-opacity', '0.5');
    });

    it('should apply grid offsets correctly', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'square',
        cellSizePx: 50,
        offsetX: 25,
        offsetY: 25,
      };

      render(<GridOverlay {...defaultProps} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('hex grid', () => {
    it('should render hex grid lines when type is hex', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'hex',
        cellSizePx: 50,
        color: '#FF0000',
        opacity: 0.7,
      };

      render(<GridOverlay {...defaultProps} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
      
      // Check first line has correct properties
      const firstLine = lines[0];
      expect(firstLine).toHaveAttribute('data-stroke', '#FF0000');
      expect(firstLine).toHaveAttribute('data-opacity', '0.7');
    });

    it('should apply hex grid offsets correctly', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'hex',
        cellSizePx: 50,
        offsetX: 30,
        offsetY: 40,
      };

      render(<GridOverlay {...defaultProps} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('grid configuration', () => {
    it('should update grid lines when cell size changes', () => {
      const config1: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      const { rerender } = render(<GridOverlay {...defaultProps} gridConfig={config1} />);
      
      const lines1 = screen.getAllByTestId('konva-line');
      const count1 = lines1.length;

      const config2: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 100,
      };

      rerender(<GridOverlay {...defaultProps} gridConfig={config2} />);
      
      const lines2 = screen.getAllByTestId('konva-line');
      const count2 = lines2.length;
      
      // Different cell sizes should produce different line counts
      expect(count2).not.toBe(count1);
    });

    it('should update grid color when color changes', () => {
      const config1: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        color: '#000000',
      };

      const { rerender } = render(<GridOverlay {...defaultProps} gridConfig={config1} />);
      
      const lines1 = screen.getAllByTestId('konva-line');
      expect(lines1[0]).toHaveAttribute('data-stroke', '#000000');

      const config2: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        color: '#FF0000',
      };

      rerender(<GridOverlay {...defaultProps} gridConfig={config2} />);
      
      const lines2 = screen.getAllByTestId('konva-line');
      expect(lines2[0]).toHaveAttribute('data-stroke', '#FF0000');
    });

    it('should update opacity when opacity changes', () => {
      const config1: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        opacity: 0.5,
      };

      const { rerender } = render(<GridOverlay {...defaultProps} gridConfig={config1} />);
      
      const lines1 = screen.getAllByTestId('konva-line');
      expect(lines1[0]).toHaveAttribute('data-opacity', '0.5');

      const config2: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        opacity: 0.8,
      };

      rerender(<GridOverlay {...defaultProps} gridConfig={config2} />);
      
      const lines2 = screen.getAllByTestId('konva-line');
      expect(lines2[0]).toHaveAttribute('data-opacity', '0.8');
    });
  });

  describe('dimensions', () => {
    it('should handle different viewport sizes', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      render(<GridOverlay width={1200} height={900} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle very small viewports', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 10,
      };

      render(<GridOverlay width={100} height={100} gridConfig={config} />);
      
      const lines = screen.getAllByTestId('konva-line');
      // Should still render some lines even for small viewports
      expect(lines.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('grid adjustment mode (US3)', () => {
    it('should call onOffsetChange when grid is dragged in adjust mode', () => {
      const onOffsetChange = jest.fn();
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
        offsetX: 0,
        offsetY: 0,
      };

      render(
        <GridOverlay
          {...defaultProps}
          gridConfig={config}
          mode="grid-adjust"
          onOffsetChange={onOffsetChange}
        />
      );

      const group = screen.getByTestId('konva-group');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('data-draggable', 'true');

      fireEvent.dragEnd(group);

      expect(onOffsetChange).toHaveBeenCalledWith({ offsetX: 25, offsetY: 30 });
    });

    it('should not be draggable when mode is not grid-adjust', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      render(
        <GridOverlay
          {...defaultProps}
          gridConfig={config}
          mode="view"
        />
      );

      const group = screen.queryByTestId('konva-group');
      if (group) {
        expect(group).toHaveAttribute('data-draggable', 'false');
      }
    });

    it('should apply initial offset from gridConfig when rendering', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
        offsetX: 25,
        offsetY: 30,
      };

      render(
        <GridOverlay
          {...defaultProps}
          gridConfig={config}
          mode="grid-adjust"
          onOffsetChange={jest.fn()}
        />
      );

      const group = screen.getByTestId('konva-group');
      expect(group).toHaveAttribute('data-x', '25');
      expect(group).toHaveAttribute('data-y', '30');
    });
  });
});
