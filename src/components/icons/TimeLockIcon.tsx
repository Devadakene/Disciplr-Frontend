import type { SVGProps } from 'react';

export interface TimeLockIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function TimeLockIcon({ size = 24, className, ...props }: TimeLockIconProps) {
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
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M5 5l1.5 1.5" />
      <path d="M19 5l-1.5 1.5" />
      <path d="M12 5V3" />
      <path d="M9 2h6" />
    </svg>
  );
}
