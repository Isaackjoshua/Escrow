'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Loader2, ArrowLeft, Star } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function RatingForm() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('txId');
  const rateUserId = searchParams.get('rateUserId');
  const router = useRouter();
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(0);

  const onSubmit = async () => {
    if (!txId || !rateUserId || score === 0) return;
    setLoading(true);
    try {
      await api.post('/ratings', { transactionId: txId, ratedUserId: rateUserId, score, comment: comment || undefined });
      toast({ title: 'Rating submitted!', description: 'Thank you for your feedback.' });
      router.push('/transactions');
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Rate Transaction</h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-gray-600">How would you rate this experience?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setScore(s)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-10 w-10 transition-colors',
                      (hovered || score) >= s ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>
            {(hovered || score) > 0 && (
              <p className="text-sm font-medium text-gray-700">
                {labels[(hovered || score) - 1]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              placeholder="Share your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
            />
          </div>

          <Button
            className="w-full"
            onClick={onSubmit}
            disabled={score === 0 || loading || !txId || !rateUserId}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Rating
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewRatingPage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>}><RatingForm /></Suspense>;
}
