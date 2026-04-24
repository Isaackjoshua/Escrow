'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTZS, formatDate, getStatusColor, truncateId } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { DollarSign, Package, Star, Link2, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MerchantDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const [stats, setStats] = useState({ pending: 0, held: 0, released: 0, totalEarned: 0, avgRating: 0, totalRatings: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const escrowLink = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${user?.phone}`;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/transactions?limit=10'),
      api.get(`/ratings/user/${user.id}`),
    ]).then(([txRes, ratingRes]) => {
      const txs = txRes.data.data;
      setTransactions(txs);
      const released = txs.filter((t: any) => t.status === 'RELEASED');
      const totalEarned = released.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) - parseFloat(t.platformFee)), 0);
      setStats({
        pending: txs.filter((t: any) => t.status === 'PENDING').length,
        held: txs.filter((t: any) => t.status === 'HELD').length,
        released: released.length,
        totalEarned,
        avgRating: ratingRes.data.data.averageScore,
        totalRatings: ratingRes.data.data.totalRatings,
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const copyLink = () => {
    navigator.clipboard.writeText(escrowLink);
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Share it on WhatsApp or social media' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Merchant Hub</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500">{user?.name}</p>
            {user?.kycStatus === 'APPROVED' && (
              <Badge variant="success" className="gap-1">
                <CheckCircle className="h-3 w-3" /> Verified
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Pending Orders', value: stats.pending, icon: Package, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Funds in Escrow', value: stats.held, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed', value: stats.released, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <div className={`p-3 rounded-full ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Total earned */}
        <Card className="bg-brand-green text-white">
          <CardContent className="p-6">
            <p className="text-green-200 text-sm">Total Earned</p>
            <p className="text-3xl font-bold mt-1">{formatTZS(stats.totalEarned)}</p>
            <p className="text-green-200 text-xs mt-1">Net after platform fees</p>
          </CardContent>
        </Card>

        {/* Rating */}
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500 text-sm">Your Rating</p>
            <div className="flex items-center gap-2 mt-1">
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              <p className="text-3xl font-bold">{stats.avgRating.toFixed(1)}</p>
              <span className="text-gray-400 text-sm">/ 5</span>
            </div>
            <p className="text-gray-400 text-xs mt-1">{stats.totalRatings} ratings</p>
          </CardContent>
        </Card>
      </div>

      {/* Escrow payment link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Your Escrow Payment Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">Share this link on WhatsApp or social media for customers to pay you securely via escrow.</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={escrowLink}
              className="flex-1 text-sm bg-gray-50 border rounded-md px-3 py-2 font-mono"
            />
            <Button variant="outline" onClick={copyLink} className="gap-2 flex-shrink-0">
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <Link href="/transactions"><Button variant="ghost" size="sm">View all</Button></Link>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-center py-10 text-gray-500">No transactions yet</p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <Link key={tx.id} href={`/transactions/${tx.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">#{truncateId(tx.id)} — {tx.customer.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatTZS(tx.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>{tx.status}</span>
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
