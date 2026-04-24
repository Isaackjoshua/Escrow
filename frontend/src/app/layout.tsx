import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Escrow255 — Secure Payments for East Africa',
  description: 'Secure escrow payment platform for buyers and sellers in Tanzania and East Africa.',
  keywords: 'escrow, payments, Tanzania, M-Pesa, Tigo Pesa, secure transactions',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#1a7a4a',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Escrow255',
    description: 'Secure escrow payments — Malipo salama ya mkopo',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
