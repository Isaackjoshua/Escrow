import Image from 'next/image';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-green flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-brand-green font-bold text-lg">E</span>
          </div>
          <span className="text-2xl font-bold">Escrow255</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Malipo salama kwa wote.<br />
            <span className="text-brand-gold-light">Secure payments for all.</span>
          </h1>
          <p className="text-lg text-green-100">
            Weka fedha zako salama hadi bidhaa ifikia. Hold funds securely until goods arrive.
          </p>

          <div className="space-y-4">
            {[
              { icon: '🔒', text: 'Funds held until delivery confirmed' },
              { icon: '📱', text: 'OTP-secured every step of the way' },
              { icon: '⚡', text: 'M-Pesa, Tigo Pesa, Airtel Money' },
              { icon: '🛡️', text: 'Dispute resolution within 5–7 days' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-green-100">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-green-200 text-sm">© 2024 Escrow255. Dar es Salaam, Tanzania.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="text-xl font-bold text-brand-green">Escrow255</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
