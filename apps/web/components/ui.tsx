import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink hover:bg-accent/90',
        secondary: 'bg-panel-2 text-ink border border-line-2 hover:bg-line',
        ghost: 'text-muted hover:text-ink hover:bg-panel-2',
        outline: 'border border-line-2 text-ink hover:bg-panel-2',
        destructive: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-6', icon: 'h-8 w-8' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-line bg-panel', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-bold tracking-tight', className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', {
  variants: {
    tone: {
      neutral: 'border-line-2 bg-panel-2 text-muted',
      good: 'border-accent/30 bg-accent/10 text-accent',
      warn: 'border-warn/30 bg-warn/10 text-warn',
      bad: 'border-danger/30 bg-danger/10 text-danger',
      info: 'border-info/30 bg-info/10 text-info',
      anti: 'border-anti/30 bg-anti/10 text-anti',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-9 w-full rounded-md border border-line-2 bg-bg px-3 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none', className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn('w-full rounded-md border border-line-2 bg-bg px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('h-9 w-full rounded-md border border-line-2 bg-bg px-2 text-sm text-ink focus:border-accent/60 focus:outline-none', className)} {...props} />
));
Select.displayName = 'Select';

export function Field({ label, hint, children, className, counter }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; counter?: [number, number] }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
        {counter ? <span className={cn('font-mono normal-case', counter[0] > counter[1] ? 'text-warn' : 'text-faint')}>{counter[0]}/{counter[1]}</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn('mt-2 font-mono text-3xl font-medium tabular-nums', tone === 'bad' && 'text-danger', tone === 'warn' && 'text-warn', tone === 'good' && 'text-accent')}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-faint">{hint}</div> : null}
    </Card>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{eyebrow}</div> : null}
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-2 px-6 py-12 text-center">
      <div className="text-sm font-bold">{title}</div>
      {children ? <div className="mx-auto mt-2 max-w-xl text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Honest marker for functionality that is planned but not built yet. */
export function NotBuilt({ phase, children }: { phase: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-warn/25 bg-warn/5 px-5 py-4 text-sm">
      <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-warn">Not built yet · {phase}</div>
      <div className="text-muted">{children}</div>
    </div>
  );
}
