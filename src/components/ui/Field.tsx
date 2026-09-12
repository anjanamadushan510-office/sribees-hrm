import React, { useId } from 'react';
import { cn } from '../../utils/cn';

const CONTROL =
'w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint ' +
'transition-[border-color,box-shadow] duration-150 ease-out disabled:bg-canvas disabled:text-ink-soft';

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

function Wrapper({
  label,
  error,
  hint,
  required,
  id,
  className,
  children
}: BaseProps & {id: string;children: React.ReactNode;}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {error ?
      <p id={`${id}-error`} role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </p> :
      hint ?
      <p id={`${id}-hint`} className="text-[12px] text-ink-soft">
          {hint}
        </p> :
      null}
    </div>);

}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  ...rest
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrapper label={label} error={error} hint={hint} required={required} id={id} className={className}>
      <input
        {...rest}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'h-10', error ? 'border-danger' : 'border-line focus:border-brand-500')} />
      
    </Wrapper>);

}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  children,
  ...rest
}: BaseProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrapper label={label} error={error} hint={hint} required={required} id={id} className={className}>
      <select
        {...rest}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'h-10 appearance-none pr-8', error ? 'border-danger' : 'border-line focus:border-brand-500')}>
        
        {children}
      </select>
    </Wrapper>);

}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  className,
  ...rest
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrapper label={label} error={error} hint={hint} required={required} id={id} className={className}>
      <textarea
        {...rest}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'min-h-[88px] py-2', error ? 'border-danger' : 'border-line focus:border-brand-500')} />
      
    </Wrapper>);

}