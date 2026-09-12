import React from 'react';
import Link from 'next/link';
import { CompassIcon } from 'lucide-react';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink-soft">
        <CompassIcon className="h-5 w-5" />
      </span>
      <h1 className="text-base font-semibold text-ink">That page does not exist</h1>
      <p className="text-[13px] text-ink-soft">The link may be out of date, or you may not have access to it.</p>
      <Link href="/" className="text-[13px] font-medium text-brand-700 hover:underline">
        Back to your dashboard
      </Link>
    </div>
  );
}