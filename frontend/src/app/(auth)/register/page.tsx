'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { Loader2, User, ShoppingBag } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^(\+?255|0)[67]\d{8}$/, 'Invalid Tanzanian phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nationalId: z.string().optional(),
  brelaNumber: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<'CUSTOMER' | 'MERCHANT'>('CUSTOMER');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');

  const form = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    if (role === 'MERCHANT' && !data.brelaNumber) {
      form.setError('brelaNumber', { message: 'BRELA number required for merchants' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', { ...data, role, email: data.email || undefined });
      setPhone(data.phone);
      setStep('otp');
      toast({ title: 'OTP Sent', description: `Verification code sent to ${data.phone}` });
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.response?.data?.message ?? 'An error occurred', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-registration', { phone, otp, purpose: 'register' });
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      toast({ title: 'Welcome to Escrow255!', description: `Account created for ${user.name}`, variant: 'default' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: 'Verification failed', description: err.response?.data?.message ?? 'Invalid OTP', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('verifyOtp')}</CardTitle>
          <CardDescription>{t('otpSent', { phone })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">{t('otp')}</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              className="text-center text-2xl tracking-widest"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button onClick={onVerify} className="w-full" disabled={loading || otp.length !== 6}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('verifyOtp')}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-primary"
            onClick={() => setStep('form')}
          >
            ← Back to registration
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{t('register')}</CardTitle>
        <CardDescription>Create your Escrow255 account</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Role selection */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(['CUSTOMER', 'MERCHANT'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                role === r ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {r === 'CUSTOMER' ? <User className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
              <span className="font-medium">{t(r.toLowerCase() as 'customer' | 'merchant')}</span>
            </button>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input placeholder="Amina Hassan" {...form.register('name')} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('phone')}</Label>
            <Input type="tel" placeholder={t('phoneHint')} {...form.register('phone')} />
            {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('email')}</Label>
            <Input type="email" placeholder="amina@example.com" {...form.register('email')} />
          </div>

          <div className="space-y-2">
            <Label>{t('password')}</Label>
            <Input type="password" {...form.register('password')} />
            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('nationalId')}</Label>
            <Input placeholder="19XXXXXXXXX" {...form.register('nationalId')} />
          </div>

          {role === 'MERCHANT' && (
            <div className="space-y-2">
              <Label>
                {t('brelaNumber')} <Badge variant="destructive" className="text-xs ml-1">Required</Badge>
              </Label>
              <Input placeholder="BRN/XXXXXXXXXX" {...form.register('brelaNumber')} />
              {form.formState.errors.brelaNumber && (
                <p className="text-sm text-destructive">{form.formState.errors.brelaNumber.message}</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('register')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {t('login')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
