/**
 * Fluxitron Webhook Sender — Store → Hub
 *
 * Sends order events to Fluxitron Hub's webhook URL.
 * Topics: orders/create, orders/update, orders/cancel
 *
 * Retry policy: 3 attempts with exponential backoff (1s, 5s, 30s)
 */

const RETRY_DELAYS = [1000, 5000, 30000]; // ms

interface WebhookPayload {
  topic: 'orders/create' | 'orders/update' | 'orders/cancel';
  data: any;
}

/**
 * Send a webhook event to Fluxitron Hub.
 * Non-blocking — fires and retries in the background.
 */
export async function sendFluxitronWebhook(payload: WebhookPayload): Promise<void> {
  const webhookUrl = process.env.FLUXITRON_WEBHOOK_URL;
  const apiKey = process.env.FLUXITRON_WEBHOOK_API_KEY;

  if (!webhookUrl || !apiKey) {
    console.log('[Fluxitron Webhook] Skipping — FLUXITRON_WEBHOOK_URL or FLUXITRON_WEBHOOK_API_KEY not configured');
    return;
  }

  // Fire and forget — don't block the response
  sendWithRetry(webhookUrl, apiKey, payload, 0).catch((err) => {
    console.error('[Fluxitron Webhook] All retries exhausted:', err.message);
  });
}

async function sendWithRetry(
  url: string,
  apiKey: string,
  payload: WebhookPayload,
  attempt: number
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Webhook-Topic': payload.topic,
      },
      body: JSON.stringify(payload.data),
    });

    if (response.ok) {
      console.log(`[Fluxitron Webhook] ✅ ${payload.topic} sent successfully`);
      return;
    }

    // Non-2xx response
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  } catch (err: any) {
    if (attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      console.warn(
        `[Fluxitron Webhook] ⚠️ ${payload.topic} failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWithRetry(url, apiKey, payload, attempt + 1);
    }

    throw err;
  }
}
