import AfricasTalking from 'africastalking';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const at = AfricasTalking({
  apiKey: env.AFRICAS_TALKING_API_KEY,
  username: env.AFRICAS_TALKING_USERNAME,
});

const sms = at.SMS;

export async function sendSms(to: string | string[], message: string): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  const formatted = recipients.map((p) => (p.startsWith('+') ? p : `+255${p.replace(/^0/, '')}`));

  try {
    const result = await sms.send({
      to: formatted,
      message,
      from: env.AFRICAS_TALKING_SENDER_ID,
    });
    logger.info('SMS sent', { to: formatted, result: result.SMSMessageData?.Recipients });
  } catch (err) {
    logger.error('SMS send failed', { to: formatted, err });
    throw new Error('Failed to send SMS notification');
  }
}

export async function sendOtpSms(phone: string, otp: string, purpose: string): Promise<void> {
  const messages: Record<string, string> = {
    login: `Your Escrow255 login OTP is: ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes. Do not share this code.`,
    deposit: `Your Escrow255 deposit verification OTP is: ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes. Do not share.`,
    release: `Your Escrow255 fund release OTP is: ${otp}. Enter this to confirm delivery and release funds.`,
    milestone: `Your Escrow255 milestone confirmation OTP is: ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes.`,
    delivery: `Your Escrow255 delivery OTP is: ${otp}. Give this to the courier to confirm delivery handover.`,
    register: `Your Escrow255 registration OTP is: ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes.`,
  };

  const message = messages[purpose] ?? `Your Escrow255 OTP is: ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes.`;
  await sendSms(phone, message);
}

export async function sendTransactionNotification(
  phone: string,
  event: string,
  details: Record<string, string>
): Promise<void> {
  const messages: Record<string, (d: Record<string, string>) => string> = {
    transaction_initiated: (d) =>
      `Escrow255: New escrow transaction of TZS ${d.amount} initiated. Agreement: "${d.description}". Both parties must confirm terms.`,
    terms_agreed: (d) =>
      `Escrow255: Both parties have agreed to escrow terms for TZS ${d.amount}. Please deposit funds to proceed.`,
    deposit_confirmed: (d) =>
      `Escrow255: TZS ${d.amount} deposited and held in escrow. Merchant notified to deliver. Ref: ${d.txId}`,
    merchant_notified: (d) =>
      `Escrow255: Escrow funds of TZS ${d.amount} are secured. Please proceed with delivery. Ref: ${d.txId}`,
    delivery_otp: (d) =>
      `Escrow255: Delivery OTP for transaction ${d.txId}: ${d.otp}. Share ONLY with courier/merchant on delivery.`,
    funds_released: (d) =>
      `Escrow255: TZS ${d.amount} has been released to merchant. Transaction ${d.txId} complete. Thank you!`,
    funds_refunded: (d) =>
      `Escrow255: TZS ${d.amount} has been refunded. Transaction ${d.txId}. Check your mobile money account.`,
    dispute_opened: (d) =>
      `Escrow255: Dispute raised for transaction ${d.txId}. Our team will review within 5-7 days. Funds are frozen.`,
    dispute_resolved: (d) =>
      `Escrow255: Dispute for transaction ${d.txId} has been resolved. Resolution: ${d.resolution}.`,
    inspection_reminder: (d) =>
      `Escrow255: Reminder — you have ${d.hours} hours remaining to inspect your order and raise a dispute. Ref: ${d.txId}`,
  };

  const builder = messages[event];
  if (!builder) {
    logger.warn('Unknown SMS event', { event });
    return;
  }

  await sendSms(phone, builder(details));
}
