import * as RadixSlider from '@radix-ui/react-slider';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Slider({ value, onChange, min, max, step, label, className, children, tone = 'primary' }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string; className?: string; children?: ReactNode; tone?: 'primary' | 'sun' }) {
  return (
    <RadixSlider.Root value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={step} className={cn('relative flex h-11 w-full touch-none select-none items-center', className)}>
      <RadixSlider.Track className="relative h-2.5 grow rounded-full bg-line">
        <RadixSlider.Range className={cn('absolute h-full rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-sun')} />
      </RadixSlider.Track>
      {children}
      <RadixSlider.Thumb aria-label={label} className={cn('block size-8 rounded-full border-[3px] bg-white shadow-float transition-transform hover:scale-105 focus-visible:scale-110', tone === 'primary' ? 'border-primary' : 'border-sun')} />
    </RadixSlider.Root>
  );
}
