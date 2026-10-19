import React from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  className?: string;
  ariaLabel?: string;
  height?: number | string;
  width?: number | string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

/**
 * Simple skeleton placeholder component.
 * Renders a shimmering block that matches the width/height of its container.
 * Accepts optional `className` to customise size/shape.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  ariaLabel = "Loading",
  height,
  width,
  style,
  'data-testid': testId = "skeleton",
}) => (
  <div 
    className={`skeleton ${className ?? ''}`} 
    data-testid={testId}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={ariaLabel}
    style={{
      ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
      ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
      ...style,
    }}
  />
);

export default Skeleton;
