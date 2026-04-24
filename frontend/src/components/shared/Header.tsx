'use client';
import { useState, useEffect } from 'react';
import { Bell, Globe, Menu } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    if (!user) return;
    api.get('/notifications/unread-count').then((r) => setUnread(r.data.data.count)).catch(() => {});
  }, [user]);

  const toggleLocale = () => {
    const next = locale === 'en' ? 'sw' : 'en';
    setLocale(next);
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
      <button onClick={onMenuClick} className="md:hidden p-2 hover:bg-gray-100 rounded-md">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 md:pl-0" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleLocale} title="Toggle language">
          <Globe className="h-5 w-5" />
          <span className="sr-only">Toggle language ({locale === 'en' ? 'SW' : 'EN'})</span>
        </Button>

        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </Link>

        <div className="hidden md:flex items-center gap-2 pl-2 border-l">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium text-gray-700">{user?.name}</span>
        </div>
      </div>
    </header>
  );
}
