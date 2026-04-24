'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Loader2, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  merchantPhone: z.string().regex(/^(\+?255|0)[67]\d{8}$/, 'Invalid Tanzanian phone number'),
  amount: z.coerce.number().min(1000, 'Minimum amount is TZS 1,000'),
  agreementDescription: z.string().min(20, 'Please describe the agreement in at least 20 characters').max(2000),
  inspectionWindowHours: z.coerce.number().min(1).max(168).default(48),
});

type FormValues = z.infer<typeof schema>;

export default function NewTransactionPage() {
  const t = useTranslations('transaction');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { inspectionWindowHours: 48 },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await api.post('/transactions', data);
      toast({ title: 'Transaction created!', description: 'Both parties will be notified.', variant: 'default' });
      router.push(`/transactions/${res.data.data.id}`);
    } catch (err: any) {
      toast({ title: 'Failed', description: err.response?.data?.message ?? 'Could not create transaction', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const amount = form.watch('amount');
  const platformFee = amount ? Math.round((amount * 2.5) / 100) : 0;
  const merchantReceives = amount ? amount - platformFee : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{t('create')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>
            Funds will be held securely until you confirm delivery or the inspection window expires.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>{t('merchantPhone')}</Label>
              <Input type="tel" placeholder="+255 7XX XXX XXX" {...form.register('merchantPhone')} />
              {form.formState.errors.merchantPhone && (
                <p className="text-sm text-destructive">{form.formState.errors.merchantPhone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('amount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">TZS</span>
                <Input
                  type="number"
                  className="pl-14"
                  placeholder="50,000"
                  min={1000}
                  {...form.register('amount', { valueAsNumber: true })}
                />
              </div>
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              )}
              {amount > 0 && (
                <div className="bg-blue-50 rounded-md p-3 text-sm space-y-1">
                  <div className="flex justify-between text-blue-700">
                    <span>Transaction amount:</span>
                    <span className="font-medium">TZS {amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Platform fee (2.5%):</span>
                    <span>TZS {platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-blue-800 font-semibold border-t border-blue-200 pt-1">
                    <span>Merchant receives:</span>
                    <span>TZS {merchantReceives.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('agreement')}</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                placeholder={t('agreementHint')}
                {...form.register('agreementDescription')}
              />
              {form.formState.errors.agreementDescription && (
                <p className="text-sm text-destructive">{form.formState.errors.agreementDescription.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('inspectionWindow')}</Label>
              <Input
                type="number"
                min={1}
                max={168}
                {...form.register('inspectionWindowHours', { valueAsNumber: true })}
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Default 48 hours. After this window, funds are auto-released.
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Escrow Transaction
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
