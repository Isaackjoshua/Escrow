'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { Loader2, Bell, BellOff, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, string> = {
  TRANSACTION: '💰', DELIVERY: '📦', DISPUTE: '⚠️', PAYMENT: '💳', SYSTEM: 'ℹ️',
};

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = () => {
    api.get(`/notifications?page=${page}&limit=20`).then((r) => {
      setNotifications(r.data.data);
      setTotalPages(r.data.pagination.totalPages);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, [page]);

  const markAllRead = async () => {
    await api.patch('/notifications/all/read').catch(console.error);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`).catch(console.error);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" /> {t('markAllRead')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <BellOff className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t('noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn('flex gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors', !n.read && 'bg-blue-50/50')}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <span className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', !n.read && 'font-medium text-gray-900', n.read && 'text-gray-600')}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
