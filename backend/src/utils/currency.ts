// TZS formatting helpers — no external locale support needed on server

export function formatTZS(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `TZS ${num.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function calculatePlatformFee(amount: number, feePercent: number): number {
  return Math.round((amount * feePercent) / 100);
}

export function amountAfterFee(amount: number, feePercent: number): number {
  return amount - calculatePlatformFee(amount, feePercent);
}
