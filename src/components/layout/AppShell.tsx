'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  ClockIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  XIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
  { to: '/attendance', label: 'My time', icon: ClockIcon },
  { to: '/leave', label: 'Leave', icon: CalendarDaysIcon },
  { to: '/team', label: 'Who is on', icon: UsersIcon },
  { to: '/employees', label: 'People', icon: UsersIcon, adminOnly: true },
  { to: '/audit', label: 'Audit log', icon: ClipboardListIcon, adminOnly: true },
  { to: '/security', label: 'Security checks', icon: ShieldCheckIcon, adminOnly: true }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const items = NAV.filter((item) => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const currentPath = pathname ?? '';
        const isActive = item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to);
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
              'transition-colors duration-150 ease-out',
              isActive ? 'bg-white text-brand-900 font-semibold shadow-sm' : 'text-white/90 hover:bg-white/15 hover:text-white'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-full w-full bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar px-3 py-4 lg:flex">
        <Brand />
        <div className="mt-6 flex-1">{nav}</div>
        <AccountCard onSignOut={handleSignOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-navbar px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-white transition-colors duration-150 ease-out hover:bg-white/20 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <p className="hidden text-sm font-semibold text-white lg:block">
              {items.find((item) => item.to === pathname)?.label ?? 'Northwind People'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <Link
              href="/profile"
              aria-label="Your profile"
              className="rounded-full transition-opacity duration-150 ease-out hover:opacity-80"
            >
              <Avatar name={profile?.fullName ?? '?'} size="sm" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/35" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative flex h-full w-64 flex-col border-r border-line bg-sidebar px-3 py-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-white hover:bg-white/20"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex-1">{nav}</div>
            <AccountCard onSignOut={handleSignOut} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[13px] font-bold text-brand-800 shadow-sm">
        N
      </span>
      {!compact ? (
        <span className="text-sm font-bold tracking-tight text-white">
          Northwind <span className="text-white/80 font-normal">People</span>
        </span>
      ) : null}
    </div>
  );
}

function AccountCard({ onSignOut }: { onSignOut: () => void }) {
  const { profile, isAdmin } = useAuth();
  if (!profile) return null;
  return (
    <div className="mt-4 border-t border-white/20 pt-3">
      <Link
        href="/profile"
        className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-150 ease-out hover:bg-white/15 text-white"
      >
        <Avatar name={profile.fullName} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">{profile.fullName}</span>
          <span className="block truncate text-[12px] text-white/80">{isAdmin ? 'HR administrator' : 'Employee'}</span>
        </span>
        <UserIcon className="h-3.5 w-3.5 text-white/70" />
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors duration-150 ease-out hover:bg-white/15 hover:text-white"
      >
        <LogOutIcon className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}