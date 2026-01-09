/**
 * useMapExport Hook Tests
 * 
 * Tests for the map export hook functionality.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useMapExport } from '../useMapExport';
import { GridConfig, MapLabel } from '../../types/map.types';

// Mock fetch
global.fetch = jest.fn();

describe('useMapExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockGridConfig: GridConfig = {
    type: 'square',
    cellSizePx: 50,
    offsetX: 0,
    offsetY: 0,
    color: '#000000',
    opacity: 0.5,
    visible: false,
  };

  const mockLabels: MapLabel[] = [];

  it('should export map with inline project data', async () => {
    const mockResponse = {
      imageUrl: 'https://example.com/exported-map.png',
      fileSize: 123456,
      width: 1024,
      height: 1024,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useMapExport());

    const exportResult = await result.current.exportMap({
      baseImageUrl: 'https://example.com/base-map.png',
      gridConfig: mockGridConfig,
      labels: mockLabels,
    });

    expect(exportResult).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/mapgenerator/export'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('baseImageUrl'),
      })
    );
  });

  it('should handle export errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useMapExport());

    await expect(
      result.current.exportMap({
        baseImageUrl: 'https://example.com/base-map.png',
        gridConfig: mockGridConfig,
        labels: mockLabels,
      })
    ).rejects.toThrow('Network error');
  });

  it('should include grid visibility in export request', async () => {
    const visibleGridConfig: GridConfig = {
      ...mockGridConfig,
      visible: true,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        imageUrl: 'https://example.com/exported-map.png',
        fileSize: 123456,
        width: 1024,
        height: 1024,
      }),
    });

    const { result } = renderHook(() => useMapExport());

    await result.current.exportMap({
      baseImageUrl: 'https://example.com/base-map.png',
      gridConfig: visibleGridConfig,
      labels: mockLabels,
    });

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(callBody.project.gridConfig.visible).toBe(true);
  });

  it('should include labels in export request', async () => {
    const labelsWithData: MapLabel[] = [
      {
        id: 'label-1',
        text: 'Test Label',
        x: 100,
        y: 200,
        rotation: 0,
        fontFamily: 'MedievalSharp',
        fontSize: 24,
        color: '#000000',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        imageUrl: 'https://example.com/exported-map.png',
        fileSize: 123456,
        width: 1024,
        height: 1024,
      }),
    });

    const { result } = renderHook(() => useMapExport());

    await result.current.exportMap({
      baseImageUrl: 'https://example.com/base-map.png',
      gridConfig: mockGridConfig,
      labels: labelsWithData,
    });

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(callBody.project.labels).toHaveLength(1);
    expect(callBody.project.labels[0].text).toBe('Test Label');
  });

  it('should support PNG and JPEG formats', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        imageUrl: 'https://example.com/exported-map.png',
        fileSize: 123456,
        width: 1024,
        height: 1024,
      }),
    });

    const { result } = renderHook(() => useMapExport());

    // Test PNG
    await result.current.exportMap(
      {
        baseImageUrl: 'https://example.com/base-map.png',
        gridConfig: mockGridConfig,
        labels: mockLabels,
      },
      'png'
    );

    let callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(callBody.format).toBe('png');

    // Test JPEG
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        imageUrl: 'https://example.com/exported-map.jpg',
        fileSize: 123456,
        width: 1024,
        height: 1024,
      }),
    });

    await result.current.exportMap(
      {
        baseImageUrl: 'https://example.com/base-map.png',
        gridConfig: mockGridConfig,
        labels: mockLabels,
      },
      'jpeg'
    );

    callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );
    expect(callBody.format).toBe('jpeg');
  });
});
