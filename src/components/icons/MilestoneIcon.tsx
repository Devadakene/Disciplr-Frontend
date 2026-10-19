import type { SVGProps } from 'react';

export interface MilestoneIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function MilestoneIcon({ size = 24, className, ...props }: MilestoneIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M4 20V4" />
      <path d="M4 4l8 4 8-4" />
      <path d="M20 4v6" />
      <path d="M12 8v8" />
      <path d="M12 16l4 2" />
      <path d="M12 16l-4 2" />
    </svg>
  );
}
