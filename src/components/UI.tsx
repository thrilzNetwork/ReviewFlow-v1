import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = ({ children, onClick, className, variant = 'primary', disabled = false }: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  className?: string, 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent',
  disabled?: boolean
}) => {
  const variants = {
    primary: 'bg-white text-black active:bg-zinc-200',
    secondary: 'bg-charcoal text-white active:bg-zinc-800',
    outline: 'border border-white/20 text-white active:bg-white/10',
    danger: 'bg-red-500 text-white active:bg-red-600',
    accent: 'bg-pink text-black active:bg-pink-light font-bold',
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={cn(
        'px-6 py-4 rounded-3xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 tracking-tight',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className, ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={cn('bg-charcoal/60 rounded-3xl border border-white/10 p-8', className)} {...props}>
    {children}
  </div>
);
