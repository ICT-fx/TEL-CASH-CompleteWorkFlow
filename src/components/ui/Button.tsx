'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    
    const variants = {
      primary: "bg-blue-600 text-white shadow-lg hover:shadow-blue-500/40 btn-shimmer",
      secondary: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 btn-shimmer",
      outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
      ghost: "hover:bg-slate-100 text-slate-700",
    };

    const sizes = {
      sm: "px-5 py-2 text-sm rounded-full",
      md: "px-8 py-4 rounded-full font-medium",
      lg: "px-10 py-5 text-lg rounded-full font-semibold tracking-tight",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -1, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden shadow-blue-500/0 hover:shadow-blue-500/20",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
