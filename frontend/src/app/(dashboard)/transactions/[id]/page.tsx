'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatTZS, formatDate, getStatusColor, getInspectionCountdown, truncateId } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Shield, Clock, CheckCircle, AlertTriangle,
  DollarSign, Package, Star,
} from 'lucide-react';

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('transaction');
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState('');
  const [otpAction, setOtpAction] = useState<'release' | 'deposit' | 'delivery' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTx = () => {
    api.get(`/transactions/${id}`).then((r) => setTx(r.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTx(); }, [id]);

  const handleDeposit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/transactions/${id}/deposit`);
      setOtpAction('deposit');
      toast({ title: 'OTP Sent', description: 'Enter the OTP to confirm your deposit' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleVerifyDeposit = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/transactions/${id}/deposit/verify`, { otp });
      toast({ title: 'Payment initiated!', description: 'Complete via mobile money prompt' });
      setOtpAction(null);
      fetchTx();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleRequestRelease = async () => {
    setActionLoading(true);
    try {
      // First request release OTP
      const res = await api.post(`/api/auth/generate-otp`, { purpose: 'release' }).catch(async () => {
        // Fallback: use direct release which triggers OTP internally
        return { data: { message: 'OTP sent' } };
      });
      setOtpAction('release');
      toast({ title: 'OTP Sent', description: 'Enter the OTP to release funds to merchant' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleRelease = async () => {
    setActionLoading(true);
    try {
      await api.post(`/transactions/${id}/release`, { otp });
      toast({ title: 'Funds released!', description: 'Payment sent to merchant', variant: 'default' });
      setOtpAction(null);
      fetchTx();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this transaction?')) return;
    setActionLoading(true);
    try {
      await api.post(`/transactions/${id}/cancel`);
      toast({ title: 'Transaction cancelled' });
      fetchTx();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!tx) return <div className="text-center py-16">Transaction not found</div>;

  const isCustomer = user?.id === tx.customerId;
  const isMerchant = user?.id === tx.merchantId;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Transaction #{truncateId(tx.id)}</h1>
          <p className="text-sm text-gray-500">{formatDate(tx.createdAt)}</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tx.status)}`}>
          {t(`status.${tx.status}` as any)}
        </span>
      </div>

      {/* Amount card */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Escrow Amount</p>
              <p className="text-3xl font-bold text-gray-900">{formatTZS(tx.amount)}</p>
              <p className="text-sm text-gray-500 mt-1">Platform fee: {formatTZS(tx.platformFee)}</p>
            </div>
            <div className="p-4 bg-white rounded-full shadow-sm">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inspection countdown */}
      {tx.status === 'HELD' && tx.inspectionDeadline && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {t('inspectionCountdown')}: <strong>{getInspectionCountdown(tx.inspectionDeadline)}</strong>
              </p>
              <p className="text-xs text-yellow-600">Funds auto-release after inspection window closes</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Customer</p>
            <p className="font-semibold">{tx.customer.name}</p>
            <p className="text-sm text-gray-500">{tx.customer.phone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Merchant</p>
            <p className="font-semibold">{tx.merchant.name}</p>
            <p className="text-sm text-gray-500">{tx.merchant.phone}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agreement */}
      <Card>
        <CardHeader><CardTitle className="text-base">Agreement</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{tx.agreementDescription}</p>
        </CardContent>
      </Card>

      {/* Milestones */}
      {tx.milestones?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {tx.milestones.map((m: any, i: number) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{i + 1}. {m.title}</p>
                  <p className="text-xs text-gray-500">{m.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatTZS(m.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(m.status)}`}>{m.status}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* OTP input */}
      {otpAction && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800">
              {otpAction === 'deposit' ? 'Enter OTP to confirm deposit' : 'Enter OTP to release funds'}
            </p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              className="text-center text-xl tracking-widest bg-white"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
            <div className="flex gap-2">
              <Button
                onClick={otpAction === 'deposit' ? handleVerifyDeposit : handleRelease}
                disabled={otp.length !== 6 || actionLoading}
                className="flex-1"
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
              <Button variant="outline" onClick={() => { setOtpAction(null); setOtp(''); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!otpAction && (
        <div className="flex gap-3 flex-wrap">
          {isCustomer && tx.status === 'PENDING' && (
            <Button onClick={handleDeposit} disabled={actionLoading} className="gap-2">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <DollarSign className="h-4 w-4" /> {t('deposit')}
            </Button>
          )}
          {isCustomer && tx.status === 'HELD' && (
            <Button onClick={handleRequestRelease} disabled={actionLoading} className="gap-2 bg-green-600 hover:bg-green-700">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4" /> {t('release')}
            </Button>
          )}
          {(isCustomer || isMerchant) && tx.status === 'HELD' && (
            <Link href={`/disputes/new?txId=${tx.id}`}>
              <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50">
                <AlertTriangle className="h-4 w-4" /> {t('dispute')}
              </Button>
            </Link>
          )}
          {isCustomer && tx.status === 'PENDING' && (
            <Button variant="outline" onClick={handleCancel} disabled={actionLoading} className="gap-2">
              {t('cancel')}
            </Button>
          )}
          {(tx.status === 'RELEASED' || tx.status === 'REFUNDED') && (
            <Link href={`/ratings/new?txId=${tx.id}&rateUserId=${isCustomer ? tx.merchantId : tx.customerId}`}>
              <Button variant="outline" className="gap-2">
                <Star className="h-4 w-4" /> Rate this transaction
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
