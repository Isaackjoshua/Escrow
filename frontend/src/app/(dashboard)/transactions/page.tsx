'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTZS, formatDate, getStatusColor, truncateId } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUSES = ['', 'PENDING', 'HELD', 'DISPUTED', 'RELEASED', 'REFUNDED', 'CANCELLED'];

export default function TransactionsPage() {
  const t = useTranslations('transaction');
  const user = useAuthStore((s) => s.user);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) params.append('status', status);
    api.get(`/transactions?${params}`).then((r) => {
      setTransactions(r.data.data);
      setTotalPages(r.data.pagination.totalPages);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('create').replace('New ', '') + 's'}</h1>
        <Link href="/transactions/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> {t('create')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s ? 'bg-primary text-primary-foreground' : 'bg-white border hover:bg-gray-50'
            }`}
          >
            {s ? t(`status.${s}` as any) : 'All'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">{t('noTransactions')}</p>
              <Link href="/transactions/new">
                <Button className="mt-4">Create Transaction</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <Link key={tx.id} href={`/transactions/${tx.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-gray-900">#{truncateId(tx.id)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                          {t(`status.${tx.status}` as any)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {user?.role === 'CUSTOMER' ? `Merchant: ${tx.merchant.name}` : `Customer: ${tx.customer.name}`}
                        {' · '}{formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-bold text-gray-900">{formatTZS(tx.amount)}</p>
                      {tx._count?.disputes > 0 && (
                        <p className="text-xs text-red-500">{tx._count.disputes} dispute(s)</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
