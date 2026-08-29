'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  GitCompare, 
  AlertTriangle, 
  Play, 
  ShieldCheck, 
  Menu, 
  X 
} from 'lucide-react';
import { NewReconciliationModal } from './NewReconciliationModal';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [openExceptionsCount, setOpenExceptionsCount] = useState<number | null>(null);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Fetch open exception count dynamically for navigation badge
    fetch('/api/reconciliation/exceptions?resolved=false')
      .then((res) => res.json())
      .then((data) => {
        if (data.exceptions && Array.isArray(data.exceptions)) {
          setOpenExceptionsCount(data.exceptions.length);
        }
      })
      .catch(() => setOpenExceptionsCount(null));
  }, [pathname]);

  const navItems = [
    { label: 'Overview', href: '/', icon: LayoutDashboard },
    { label: 'Reconciliation', href: '/runs', icon: GitCompare },
    { 
      label: 'Exceptions', 
      href: '/exceptions', 
      icon: AlertTriangle, 
      badge: openExceptionsCount !== null ? openExceptionsCount : undefined 
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans antialiased">
      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900/60 p-4 space-y-6 shrink-0">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm tracking-tight">LedgerGuard</h1>
            <p className="text-[11px] text-slate-400 font-mono">Finance Ops Controller</p>
          </div>
        </div>

        <button
          onClick={() => setIsNewRunModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm shadow-indigo-900/40"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          New Reconciliation
        </button>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-500 pl-2.5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 px-2 font-mono">
          <div className="flex items-center justify-between">
            <span>Env: Demo / Local</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
        </div>
      </aside>

      {/* Mobile Topbar Navigation */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm text-slate-100">LedgerGuard</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 text-slate-400 hover:text-white"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-3">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsNewRunModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 text-white font-medium text-xs rounded-lg"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            New Reconciliation
          </button>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-md"
              >
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/20 text-amber-400 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>

      {/* New Reconciliation Modal */}
      {isNewRunModalOpen && (
        <NewReconciliationModal onClose={() => setIsNewRunModalOpen(false)} />
      )}
    </div>
  );
}
