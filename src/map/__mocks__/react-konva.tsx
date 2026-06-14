/**
 * Shared react-konva mock for Jest (avoids loading native Konva/canvas in Node).
 */
import React from 'react';

export const Stage = ({ children, ...props }: any) => (
  <div data-testid="konva-stage" {...props}>{children}</div>
);

export const Layer = ({ children, ...props }: any) => (
  <div data-testid="konva-layer" {...props}>{children}</div>
);

export const Image = (props: any) => <div data-testid="konva-image" {...props} />;

export const Line = (props: any) => <div data-testid="konva-line" {...props} />;

export const Text = (props: any) => <div data-testid="konva-text" {...props} />;

export const Rect = (props: any) => <div data-testid="konva-rect" {...props} />;

export const Group = ({ children, ...props }: any) => (
  <div data-testid="konva-group" {...props}>{children}</div>
);

export const Circle = (props: any) => <div data-testid="konva-circle" {...props} />;

export const Transformer = (props: any) => <div data-testid="konva-transformer" {...props} />;
