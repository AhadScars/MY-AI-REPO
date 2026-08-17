import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md';
}

export function IconButton({
  active,
  label,
  children,
  size = 'md',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-ide-muted transition-colors',
        'hover:bg-ide-elevated hover:text-ide-text',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-ide-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-ide-elevated text-ide-text',
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
