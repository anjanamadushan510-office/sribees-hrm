import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ?
      <motion.div
        key="modal-root"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
        
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="absolute inset-0 bg-ink/35"
          onClick={onClose}
          aria-hidden />
        
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className={cn(
            'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-line',
            'bg-surface shadow-pop sm:max-w-lg sm:rounded-xl',
            className
          )}>
          
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
                {description ? <p className="mt-1 text-[13px] text-ink-soft">{description}</p> : null}
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1 text-ink-soft transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
              
                <XIcon className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
          </motion.div>
        </motion.div> :
      null}
    </AnimatePresence>);

}