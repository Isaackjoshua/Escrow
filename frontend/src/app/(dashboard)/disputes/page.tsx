'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatTZS, formatDate, truncateId } from '@/lib/utils';
import api from '@/lib/api';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/disputes?page=${page}&limit=10`).then((r) => {
      setDisputes(r.data.data);
      setTotalPages(r.data.pagination.totalPages);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Disputes</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : disputes.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No disputes found</p>
            </div>
          ) : (
            <div className="divide-y">
              {disputes.map((d) => (
                <div key={d.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-medium">#{truncateId(d.id)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                          {d.status.replace('_', ' ')}
                        </span>
                        {d.isFastTrack && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Fast-track
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{d.reason}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Raised by: {d.raiser.name}</span>
                        <span>·</span>
                        <span>Amount: {formatTZS(d.transaction.amount)}</span>
                        <span>·</span>
                        <span>{formatDate(d.createdAt)}</span>
                      </div>
                    </div>
                    <Link href={`/transactions/${d.transaction.id}`}>
                      <Button variant="outline" size="sm">View Tx</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
