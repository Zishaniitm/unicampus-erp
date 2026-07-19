import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Razorpay integration helper.
 *
 * SECURITY (SRS Section 6 — Payment Rules):
 * - NEVER confirm a payment on redirect. ONLY on webhook with a verified signature.
 * - The webhook body signature is HMAC-SHA256 over the RAW request body using
 *   RAZORPAY_WEBHOOK_SECRET. Compare in constant time to avoid timing attacks.
 * - order_id is the idempotency key — the caller must check for an existing
 *   transaction with the same order_id before inserting.
 */

/**
 * Verifies a Razorpay webhook signature.
 *
 * @param rawBody   the exact raw request body string (NOT re-serialized JSON)
 * @param signature the value of the `x-razorpay-signature` header
 * @param secret    the webhook secret (defaults to env RAZORPAY_WEBHOOK_SECRET)
 * @returns true if the signature is valid, false otherwise
 * @throws Error if no secret is configured (misconfiguration should fail loudly)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string | undefined = env.RAZORPAY_WEBHOOK_SECRET,
): boolean {
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Both buffers must be equal length for timingSafeEqual, otherwise it throws.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf   = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies the payment signature returned to the client after checkout.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 * Used as a secondary check; the webhook remains the source of truth.
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string | undefined = env.RAZORPAY_KEY_SECRET,
): boolean {
  if (!secret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf   = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

let razorpayClient: any | null = null;

/**
 * Lazily constructs a Razorpay SDK client. Returns null if keys are not
 * configured (dev/test) so callers can degrade gracefully.
 */
function getClient(): any | null {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  if (!razorpayClient) {
    // Lazy require so tests that never call this don't need the dependency loaded.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Razorpay = require('razorpay');
    razorpayClient = new Razorpay({
      key_id:     env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

export interface RazorpayOrder {
  id:       string;
  amount:   number;
  currency: string;
  status:   string;
}

/**
 * Creates a Razorpay order for the given amount in paise.
 *
 * @param amountPaise amount to charge, in paise
 * @param receipt     a short receipt reference (our internal id)
 * @returns the created order
 * @throws Error if Razorpay is not configured or the API call fails
 */
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
  const client = getClient();
  if (!client) {
    throw new Error('Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  }
  try {
    const order = await client.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt,
      payment_capture: 1,
    });
    return order as RazorpayOrder;
  } catch (err: any) {
    logger.error({ code: 'ERR-FEE-001', message: 'Razorpay order creation failed', error: err?.message });
    throw err;
  }
}
