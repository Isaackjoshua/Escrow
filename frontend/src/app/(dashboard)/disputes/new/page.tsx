'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Loader2, ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  reason: z.string().min(20, 'Please provide at least 20 characters describing the issue').max(2000),
  isFastTrack: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

function NewDisputeForm() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('txId');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [disputeId, setDisputeId] = useState<string | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    if (!txId) return;
    setLoading(true);
    try {
      const res = await api.post(`/transactions/${txId}/dispute`, data);
      const newDisputeId = res.data.data.id;
      setDisputeId(newDisputeId);

      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        await api.post(`/disputes/${newDisputeId}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast({ title: 'Dispute raised', description: 'Our team will review within 5–7 days', variant: 'default' });
      router.push('/disputes');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/disputes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Raise Dispute</h1>
      </div>

      {!txId && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          No transaction specified. Please go to your transaction and click "Raise Dispute".
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>Reason for Dispute</Label>
              <textarea
                className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                placeholder="Describe exactly what went wrong — item not delivered, wrong item, damaged goods, etc."
                {...form.register('reason')}
              />
              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Evidence (photos, screenshots, documents)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById('evidence-upload')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload files (max 5, 10MB each)</p>
                <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP, PDF</p>
                {files.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {files.map((f) => (
                      <p key={f.name} className="text-xs text-green-600">✓ {f.name}</p>
                    ))}
                  </div>
                )}
              </div>
              <input
                id="evidence-upload"
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
              <input
                type="checkbox"
                id="fastTrack"
                className="mt-0.5"
                {...form.register('isFastTrack')}
              />
              <label htmlFor="fastTrack" className="text-sm">
                <span className="font-medium text-purple-800">Fast-track review (TZS 5,000)</span>
                <br />
                <span className="text-purple-600">Get a resolution within 24 hours instead of 5–7 days</span>
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !txId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Dispute
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewDisputePage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>}><NewDisputeForm /></Suspense>;
}
