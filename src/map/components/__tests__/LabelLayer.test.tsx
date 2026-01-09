/**
 * LabelLayer Component Tests (TDD - T058)
 * 
 * Tests for the label layer component that renders
 * text labels on the map with drag, edit, and selection support.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelLayer } from '../LabelLayer';
import { MapLabel, FONT_OPTIONS, ROTATION_OPTIONS } from '../../types/map.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Layer: ({ children, ...props }: any) => (
    <div data-testid="konva-layer">{children}</div>
  ),
  Text: ({ text, x, y, rotation, fontFamily, fontSize, fill, draggable, onClick, onDblClick, onDragEnd, ...props }: any) => (
    <div
      data-testid="konva-text"
      data-text={text}
      data-x={x}
      data-y={y}
      data-rotation={rotation}
      data-font-family={fontFamily}
      data-font-size={fontSize}
      data-fill={fill}
      data-draggable={draggable}
      onClick={onClick}
      onDoubleClick={onDblClick}
      onDragEnd={onDragEnd}
    />
  ),
  Transformer: ({ ...props }: any) => (
    <div data-testid="konva-transformer" />
  ),
}));

describe('LabelLayer', () => {
  const mockLabels: MapLabel[] = [
    {
      id: 'label-1',
      text: 'Test Label 1',
      x: 100,
      y: 200,
      rotation: 0,
      fontFamily: 'MedievalSharp',
      fontSize: 24,
      color: '#000000',
    },
    {
      id: 'label-2',
      text: 'Test Label 2',
      x: 300,
      y: 400,
      rotation: 45,
      fontFamily: 'Pirata One',
      fontSize: 32,
      color: '#FF0000',
    },
  ];

  const defaultProps = {
    labels: mockLabels,
    selectedLabelId: null,
    onLabelSelect: jest.fn(),
    onLabelUpdate: jest.fn(),
    onLabelDelete: jest.fn(),
    mode: 'view' as const,
  };

  describe('base rendering', () => {
    it('should render a Konva Layer', () => {
      render(<LabelLayer {...defaultProps} />);
      
      expect(screen.getByTestId('konva-layer')).toBeInTheDocument();
    });

    it('should render all labels', () => {
      render(<LabelLayer {...defaultProps} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(2);
    });

    it('should render labels with correct properties', () => {
      render(<LabelLayer {...defaultProps} />);
      
      const texts = screen.getAllByTestId('konva-text');
      const firstText = texts[0];
      
      expect(firstText).toHaveAttribute('data-text', 'Test Label 1');
      expect(firstText).toHaveAttribute('data-x', '100');
      expect(firstText).toHaveAttribute('data-y', '200');
      expect(firstText).toHaveAttribute('data-rotation', '0');
      expect(firstText).toHaveAttribute('data-font-family', 'MedievalSharp');
      expect(firstText).toHaveAttribute('data-font-size', '24');
      expect(firstText).toHaveAttribute('data-fill', '#000000');
    });

    it('should render empty layer when no labels', () => {
      render(<LabelLayer {...defaultProps} labels={[]} />);
      
      const texts = screen.queryAllByTestId('konva-text');
      expect(texts.length).toBe(0);
    });
  });

  describe('label selection', () => {
    it('should call onLabelSelect when label is clicked', () => {
      const onLabelSelect = jest.fn();
      render(<LabelLayer {...defaultProps} onLabelSelect={onLabelSelect} />);
      
      const texts = screen.getAllByTestId('konva-text');
      const firstText = texts[0];
      
      fireEvent.click(firstText);
      
      expect(onLabelSelect).toHaveBeenCalledWith('label-1');
    });

    it('should highlight selected label', () => {
      render(<LabelLayer {...defaultProps} selectedLabelId="label-1" />);
      
      const texts = screen.getAllByTestId('konva-text');
      // Selected label should have transformer (visual indicator)
      const transformer = screen.queryByTestId('konva-transformer');
      expect(transformer).toBeInTheDocument();
    });

    it('should not show transformer when no label is selected', () => {
      render(<LabelLayer {...defaultProps} selectedLabelId={null} />);
      
      const transformer = screen.queryByTestId('konva-transformer');
      expect(transformer).not.toBeInTheDocument();
    });
  });

  describe('label dragging', () => {
    it('should make labels draggable', () => {
      render(<LabelLayer {...defaultProps} />);
      
      const texts = screen.getAllByTestId('konva-text');
      texts.forEach((text) => {
        expect(text).toHaveAttribute('data-draggable', 'true');
      });
    });

    it('should call onLabelUpdate when label is dragged', () => {
      const onLabelUpdate = jest.fn();
      render(<LabelLayer {...defaultProps} onLabelUpdate={onLabelUpdate} />);
      
      const texts = screen.getAllByTestId('konva-text');
      const firstText = texts[0];
      
      // Simulate drag end
      const dragEvent = {
        target: {
          x: () => 150,
          y: () => 250,
        },
      };
      
      const onDragEnd = (firstText as any).onDragEnd;
      if (onDragEnd) {
        onDragEnd(dragEvent);
      }
      
      expect(onLabelUpdate).toHaveBeenCalledWith('label-1', { x: 150, y: 250 });
    });
  });

  describe('label editing', () => {
    it('should enable inline editing when label is double-clicked', () => {
      const onLabelSelect = jest.fn();
      render(<LabelLayer {...defaultProps} onLabelSelect={onLabelSelect} mode="label" />);
      
      const texts = screen.getAllByTestId('konva-text');
      const firstText = texts[0];
      
      fireEvent.doubleClick(firstText);
      
      // Should select label for editing
      expect(onLabelSelect).toHaveBeenCalledWith('label-1');
    });
  });

  describe('label placement mode', () => {
    it('should call onLabelUpdate with new label when clicked in label mode', () => {
      const onLabelUpdate = jest.fn();
      render(
        <LabelLayer
          {...defaultProps}
          onLabelUpdate={onLabelUpdate}
          mode="label"
          onLabelPlace={(x, y) => {
            onLabelUpdate('new-label', { text: 'New Label', x, y });
          }}
        />
      );
      
      const layer = screen.getByTestId('konva-layer');
      
      // Simulate click on layer (not on existing label)
      fireEvent.click(layer, { clientX: 500, clientY: 600 });
      
      // Should create new label at click position
      expect(onLabelUpdate).toHaveBeenCalled();
    });
  });

  describe('label properties', () => {
    it('should render labels with all rotation angles', () => {
      const labelsWithRotations: MapLabel[] = ROTATION_OPTIONS.map((angle, index) => ({
        id: `label-${index}`,
        text: `Label ${angle}°`,
        x: 100 + index * 50,
        y: 100,
        rotation: angle,
        fontFamily: 'MedievalSharp',
        fontSize: 24,
        color: '#000000',
      }));

      render(<LabelLayer {...defaultProps} labels={labelsWithRotations} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(ROTATION_OPTIONS.length);
      
      texts.forEach((text, index) => {
        expect(text).toHaveAttribute('data-rotation', String(ROTATION_OPTIONS[index]));
      });
    });

    it('should render labels with all font families', () => {
      const labelsWithFonts: MapLabel[] = FONT_OPTIONS.map((font, index) => ({
        id: `label-${index}`,
        text: `Label ${font}`,
        x: 100 + index * 50,
        y: 100,
        rotation: 0,
        fontFamily: font,
        fontSize: 24,
        color: '#000000',
      }));

      render(<LabelLayer {...defaultProps} labels={labelsWithFonts} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(FONT_OPTIONS.length);
      
      texts.forEach((text, index) => {
        expect(text).toHaveAttribute('data-font-family', FONT_OPTIONS[index]);
      });
    });

    it('should render labels with different font sizes', () => {
      const labelsWithSizes: MapLabel[] = [8, 16, 24, 32, 48, 72].map((size, index) => ({
        id: `label-${index}`,
        text: `Label ${size}px`,
        x: 100 + index * 50,
        y: 100,
        rotation: 0,
        fontFamily: 'MedievalSharp',
        fontSize: size,
        color: '#000000',
      }));

      render(<LabelLayer {...defaultProps} labels={labelsWithSizes} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(6);
      
      texts.forEach((text, index) => {
        const expectedSize = [8, 16, 24, 32, 48, 72][index];
        expect(text).toHaveAttribute('data-font-size', String(expectedSize));
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty text gracefully', () => {
      const labelsWithEmptyText: MapLabel[] = [
        {
          id: 'label-empty',
          text: '',
          x: 100,
          y: 100,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];

      render(<LabelLayer {...defaultProps} labels={labelsWithEmptyText} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(1);
      expect(texts[0]).toHaveAttribute('data-text', '');
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(200);
      const labelsWithLongText: MapLabel[] = [
        {
          id: 'label-long',
          text: longText,
          x: 100,
          y: 100,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];

      render(<LabelLayer {...defaultProps} labels={labelsWithLongText} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(1);
      expect(texts[0]).toHaveAttribute('data-text', longText);
    });

    it('should handle negative coordinates', () => {
      const labelsWithNegativeCoords: MapLabel[] = [
        {
          id: 'label-negative',
          text: 'Negative Coords',
          x: -100,
          y: -200,
          rotation: 0,
          fontFamily: 'MedievalSharp',
          fontSize: 24,
          color: '#000000',
        },
      ];

      render(<LabelLayer {...defaultProps} labels={labelsWithNegativeCoords} />);
      
      const texts = screen.getAllByTestId('konva-text');
      expect(texts.length).toBe(1);
      expect(texts[0]).toHaveAttribute('data-x', '-100');
      expect(texts[0]).toHaveAttribute('data-y', '-200');
    });
  });
});
