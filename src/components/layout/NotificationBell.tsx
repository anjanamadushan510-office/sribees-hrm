'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '../../contexts/NotificationsContext';
import { relativeTime } from '../../utils/time';
import { cn } from '../../utils/cn';

export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const recent = items.slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-md p-1.5 text-ink-soft transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink">
        
        <BellIcon className="h-5 w-5" />
        {unread > 0 ?
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span> :
        null}
      </button>

      <AnimatePresence>
        {open ?
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-[13px] font-semibold text-ink">Notifications</p>
              {unread > 0 ?
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-[12px] font-medium text-brand-700 hover:underline">
              
                  Mark all read
                </button> :
            null}
            </div>
            {recent.length === 0 ?
          <p className="px-4 py-8 text-center text-[13px] text-ink-soft">You are all caught up.</p> :

          <ul className="max-h-[320px] overflow-y-auto">
                {recent.map((item) =>
            <li key={item.id}>
                    <button
                type="button"
                onClick={() => {
                  void markRead(item.id);
                  setOpen(false);
                  router.push(item.link);
                }}
                className={cn(
                  'flex w-full gap-2.5 border-b border-line px-4 py-3 text-left last:border-b-0',
                  'transition-colors duration-150 ease-out hover:bg-canvas'
                )}>
                
                      <span
                  className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-brand-600')}
                  aria-hidden />
                
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">{item.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-soft">{item.body}</span>
                        <span className="mt-1 block text-[11px] text-ink-faint">{relativeTime(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
            )}
              </ul>
          }
            <div className="border-t border-line px-4 py-2">
              <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/notifications');
              }}
              className="text-[12px] font-medium text-brand-700 hover:underline">
              
                View all notifications
              </button>
            </div>
          </motion.div> :
        null}
      </AnimatePresence>
    </div>);

}