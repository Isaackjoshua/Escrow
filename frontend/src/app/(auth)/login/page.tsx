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
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  phone: z.string().min(9, 'Enter a valid phone number'),
  password: z.string().min(1, 'Password is required'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type LoginForm = z.infer<typeof loginSchema>;
type OtpForm = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  const onLogin = async (data: LoginForm) => {
    setLoading(true);
    try {
      await api.post('/auth/login', data);
      setPhone(data.phone);
      setStep('otp');
      toast({ title: 'OTP Sent', description: `Verification code sent to ${data.phone}`, variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.response?.data?.message ?? 'An error occurred', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (data: OtpForm) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp: data.otp, purpose: 'login' });
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      toast({ title: 'Welcome back!', description: `Logged in as ${user.name}`, variant: 'default' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: 'OTP verification failed', description: err.response?.data?.message ?? 'Invalid OTP', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          {step === 'credentials' ? t('login') : t('verifyOtp')}
        </CardTitle>
        <CardDescription>
          {step === 'credentials'
            ? 'Enter your phone number and password'
            : t('otpSent', { phone })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'credentials' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('phoneHint')}
                {...loginForm.register('phone')}
              />
              {loginForm.formState.errors.phone && (
                <p className="text-sm text-destructive">{loginForm.formState.errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" {...loginForm.register('password')} />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('login')}
            </Button>
          </form>
        ) : (
          <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">{t('otp')}</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                className="text-center text-2xl tracking-widest"
                {...otpForm.register('otp')}
              />
              {otpForm.formState.errors.otp && (
                <p className="text-sm text-destructive">{otpForm.formState.errors.otp.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('verifyOtp')}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-primary"
              onClick={() => setStep('credentials')}
            >
              ← Back
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">
            {t('register')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
