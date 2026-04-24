import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface SelcomOrderPayload {
  vendor: string;
  order_id: string;
  buyer_email?: string;
  buyer_name: string;
  buyer_phone: string;
  amount: number;
  currency: string;
  redirect_url: string;
  cancel_url: string;
  webhook: string;
  billing_fields?: Record<string, string>;
}

interface SelcomDisbursementPayload {
  transid: string;
  msisdn: string;
  vendor: string;
  pin: string;
  amount: number;
  currency: string;
  utilityref: string;
  network: string;
}

function buildSelcomHeaders(body: string): Record<string, string> {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const digest = crypto
    .createHmac('sha256', env.SELCOM_API_SECRET)
    .update(body)
    .digest('base64');

  const authorization = Buffer.from(`${env.SELCOM_API_KEY}:${timestamp}`).toString('base64');

  return {
    'Content-Type': 'application/json;charset=utf-8',
    Authorization: `SELCOM ${authorization}`,
    'Digest-Method': 'HS256',
    Digest: digest,
    Timestamp: timestamp,
    'Cache-Control': 'no-cache',
  };
}

export async function initiateSelcomPayment(payload: SelcomOrderPayload): Promise<{
  orderId: string;
  paymentUrl: string;
}> {
  const body = JSON.stringify(payload);
  const headers = buildSelcomHeaders(body);

  try {
    const response = await axios.post(
      `${env.SELCOM_BASE_URL}/checkout/create-order`,
      payload,
      { headers }
    );

    const data = response.data;
    if (data.resultcode !== '000') {
      throw new Error(`Selcom order creation failed: ${data.result}`);
    }

    logger.info('Selcom payment initiated', { orderId: payload.order_id });
    return { orderId: payload.order_id, paymentUrl: data.data?.payment_url ?? '' };
  } catch (err) {
    logger.error('Selcom payment initiation error', { err });
    throw new Error('Payment initiation failed. Please try again.');
  }
}

export async function initiateSelcomDisbursement(
  payload: SelcomDisbursementPayload
): Promise<{ transactionId: string; reference: string }> {
  const body = JSON.stringify(payload);
  const headers = buildSelcomHeaders(body);

  try {
    const response = await axios.post(
      `${env.SELCOM_BASE_URL}/ussdpush/get-managed-push`,
      payload,
      { headers }
    );

    const data = response.data;
    if (data.resultcode !== '000') {
      throw new Error(`Selcom disbursement failed: ${data.result}`);
    }

    logger.info('Selcom disbursement initiated', { transid: payload.transid });
    return { transactionId: payload.transid, reference: data.data?.reference ?? '' };
  } catch (err) {
    logger.error('Selcom disbursement error', { err });
    throw new Error('Payout initiation failed. Please try again.');
  }
}

export function verifySelcomWebhook(
  payload: string,
  receivedDigest: string
): boolean {
  const expected = crypto
    .createHmac('sha256', env.SELCOM_API_SECRET)
    .update(payload)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedDigest));
}
