import React from 'react';
import { cn } from '../../utils/cn';

const PALETTE = [
'bg-brand-100 text-brand-800',
'bg-info-soft text-info-ink',
'bg-warn-soft text-warn-ink',
'bg-success-soft text-success-ink',
'bg-canvas text-ink'];


function initials(name: string): string {
  return name.
  split(' ').
  filter(Boolean).
  slice(0, 2).
  map((part) => part[0]?.toUpperCase() ?? '').
  join('');
}

export function Avatar({ name, size = 'md' }: {name: string;size?: 'sm' | 'md' | 'lg';}) {
  const index = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTE.length;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        PALETTE[index],
        size === 'sm' && 'h-7 w-7 text-[11px]',
        size === 'md' && 'h-9 w-9 text-[13px]',
        size === 'lg' && 'h-14 w-14 text-lg'
      )}>
      
      {initials(name)}
    </span>);

}