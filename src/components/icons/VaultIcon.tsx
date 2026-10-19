import type { SVGProps } from 'react';

export interface VaultIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function VaultIcon({ size = 24, className, ...props }: VaultIconProps) {
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
      <path d="M12 2L4 6v6c0 5.25 3.4 10.17 8 11.38C16.6 22.17 20 17.25 20 12V6l-8-4z" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10v-1" />
    </svg>
  );
}
