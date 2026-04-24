import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EAT_TZ = 'Africa/Dar_es_Salaam';

export function formatTZS(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `TZS ${num.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string | Date): string {
  return formatInTimeZone(new Date(date), EAT_TZ, 'dd MMM yyyy, HH:mm');
}

export function formatDateShort(date: string | Date): string {
  return formatInTimeZone(new Date(date), EAT_TZ, 'dd MMM yyyy');
}

export function getInspectionCountdown(deadline: string | Date): string {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    HELD: 'bg-blue-100 text-blue-800',
    DISPUTED: 'bg-red-100 text-red-800',
    RELEASED: 'bg-green-100 text-green-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

export function truncateId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
