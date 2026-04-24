'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard, ArrowLeftRight, AlertTriangle, Bell, User, LogOut,
  ShieldCheck, Package, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, clearAuth } = useAuthStore();

  const baseLinks = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/transactions', label: t('transactions'), icon: ArrowLeftRight },
    { href: '/disputes', label: t('disputes'), icon: AlertTriangle },
    { href: '/notifications', label: t('notifications'), icon: Bell },
  ];

  const merchantLinks = [
    { href: '/merchant', label: 'Merchant Hub', icon: Package },
  ];

  const adminLinks = [
    { href: '/admin', label: t('admin'), icon: ShieldCheck },
  ];

  const links = [
    ...baseLinks,
    ...(user?.role === 'MERCHANT' ? merchantLinks : []),
    ...(user?.role === 'ADMIN' ? [...merchantLinks, ...adminLinks] : []),
  ];

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth();
    router.push('/login');
    toast({ title: 'Logged out', description: 'See you next time!', variant: 'default' });
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">E</span>
        </div>
        <span className="text-lg font-bold text-brand-green">Escrow255</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t space-y-1">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
            pathname === '/profile' ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <User className="h-5 w-5" />
          {t('profile')}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          {t('logout')}
        </button>
      </div>

      {/* User info */}
      {user && (
        <div className="px-6 py-4 bg-gray-50 border-t">
          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
          <p className="text-xs text-gray-500">{user.phone}</p>
          <span className={cn(
            'inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium',
            user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
            user.role === 'MERCHANT' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          )}>
            {user.role}
          </span>
        </div>
      )}
    </aside>
  );
}
