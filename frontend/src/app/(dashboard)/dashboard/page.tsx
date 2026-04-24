'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTZS, formatDate, getStatusColor, truncateId } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { ArrowLeftRight, Plus, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

interface Transaction {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  customer: { name: string };
  merchant: { name: string };
}

interface Stats {
  active: number;
  completed: number;
  disputed: number;
  totalValue: number;
}

export default function DashboardPage() {
  const t = useTranslations('transaction');
  const user = useAuthStore((s) => s.user);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({ active: 0, completed: 0, disputed: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/transactions?limit=5').then((r) => {
      const txs: Transaction[] = r.data.data;
      setTransactions(txs);
      setStats({
        active: txs.filter((t) => ['PENDING', 'HELD'].includes(t.status)).length,
        completed: txs.filter((t) => t.status === 'RELEASED').length,
        disputed: txs.filter((t) => t.status === 'DISPUTED').length,
        totalValue: txs.reduce((sum, t) => sum + parseFloat(t.amount), 0),
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Active Transactions', value: stats.active, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Disputed', value: stats.disputed, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total Value', value: formatTZS(stats.totalValue), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Habari, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's your Escrow255 overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-full ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/transactions/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Transaction
          </Button>
        </Link>
        <Link href="/transactions">
          <Button variant="outline" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" /> View All Transactions
          </Button>
        </Link>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <Link href="/transactions">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t('noTransactions')}</p>
              <Link href="/transactions/new">
                <Button variant="outline" size="sm" className="mt-3">
                  Create your first transaction
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <Link key={tx.id} href={`/transactions/${tx.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        #{truncateId(tx.id)} — {user?.role === 'CUSTOMER' ? tx.merchant.name : tx.customer.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-900">{formatTZS(tx.amount)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {t(`status.${tx.status}` as any)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
