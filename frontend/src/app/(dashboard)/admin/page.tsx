'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTZS, formatDate, truncateId } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, DollarSign, AlertTriangle, TrendingUp, FileCheck, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const t = useTranslations('admin');
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { toast } = useToast();

  const [stats, setStats] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'disputes' | 'users'>('overview');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [disputePage, setDisputePage] = useState(1);
  const [disputeTotal, setDisputeTotal] = useState(0);

  useEffect(() => {
    if (user?.role !== 'ADMIN') { router.replace('/dashboard'); return; }
    Promise.all([
      api.get('/admin/stats'),
      api.get(`/admin/disputes?page=${disputePage}&limit=5`),
      api.get(`/admin/users?page=${userPage}&limit=10`),
    ]).then(([statsRes, disputeRes, userRes]) => {
      setStats(statsRes.data.data);
      setDisputes(disputeRes.data.data);
      setDisputeTotal(disputeRes.data.pagination.totalPages);
      setUsers(userRes.data.data);
      setUserTotal(userRes.data.pagination.totalPages);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user, disputePage, userPage]);

  const handleKyc = async (userId: string, status: 'APPROVED' | 'REJECTED') => {
    await api.patch(`/admin/users/${userId}/kyc`, { status });
    toast({ title: `KYC ${status}` });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, kycStatus: status } : u));
  };

  const handleToggleStatus = async (userId: string) => {
    const res = await api.patch(`/admin/users/${userId}/toggle-status`);
    toast({ title: res.data.message });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !u.isActive } : u));
  };

  const handleResolveDispute = async (disputeId: string, action: string) => {
    const resolution = prompt('Enter resolution notes:');
    if (!resolution) return;
    await api.post(`/disputes/${disputeId}/resolve`, { action, resolution });
    toast({ title: 'Dispute resolved' });
    setDisputes((prev) => prev.filter((d) => d.id !== disputeId));
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'disputes', label: `Disputes ${stats?.openDisputes ? `(${stats.openDisputes})` : ''}` },
    { key: 'users', label: 'Users' },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard')}</h1>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('totalVolume'), value: formatTZS(stats.totalVolume), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
              { label: t('openDisputes'), value: stats.openDisputes, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
              { label: t('pendingKyc'), value: stats.pendingKyc, icon: FileCheck, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Platform Revenue', value: formatTZS(stats.platformRevenue), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-xl font-bold mt-0.5">{value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Dispute Rate</p>
                <p className="text-2xl font-bold">{stats.disputeRate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Avg Transaction Value</p>
                <p className="text-2xl font-bold">{formatTZS(stats.averageTransactionValue)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Status chart */}
          {stats.transactionsByStatus?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Transactions by Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.transactionsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v, 'Count']} />
                    <Bar dataKey="count" fill="#1a7a4a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Disputes queue */}
      {tab === 'disputes' && (
        <Card>
          <CardContent className="p-0">
            {disputes.length === 0 ? (
              <p className="text-center py-16 text-gray-500">No open disputes</p>
            ) : (
              <div className="divide-y">
                {disputes.map((d) => (
                  <div key={d.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">#{truncateId(d.id)}</span>
                          {d.isFastTrack && <Badge variant="warning">Fast-track</Badge>}
                        </div>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{d.reason}</p>
                        <div className="text-xs text-gray-500 mt-1 space-x-2">
                          <span>By: {d.raiser.name}</span>
                          <span>·</span>
                          <span>Amount: {formatTZS(d.transaction.amount)}</span>
                          <span>·</span>
                          <span>{formatDate(d.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => handleResolveDispute(d.id, 'RELEASE_TO_MERCHANT')} className="bg-blue-600 hover:bg-blue-700">
                        Release to Merchant
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleResolveDispute(d.id, 'REFUND_TO_CUSTOMER')} className="border-red-200 text-red-600">
                        Refund Customer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleResolveDispute(d.id, 'SPLIT')}>
                        Split 50/50
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Users */}
      {tab === 'users' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.phone} · {u.role}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.kycStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : u.kycStatus === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        KYC: {u.kycStatus}
                      </span>
                      {!u.isActive && <Badge variant="destructive">Suspended</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {u.kycStatus === 'PENDING' && (
                      <>
                        <Button size="sm" onClick={() => handleKyc(u.id, 'APPROVED')} className="bg-green-600 hover:bg-green-700">{t('approveKyc')}</Button>
                        <Button size="sm" variant="outline" onClick={() => handleKyc(u.id, 'REJECTED')} className="border-red-200 text-red-600">{t('rejectKyc')}</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleToggleStatus(u.id)} className={u.isActive ? 'border-red-200 text-red-600' : ''}>
                      {u.isActive ? t('suspend') : t('activate')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          {userTotal > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <Button variant="outline" size="sm" disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm text-gray-500">Page {userPage} of {userTotal}</span>
              <Button variant="outline" size="sm" disabled={userPage === userTotal} onClick={() => setUserPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
