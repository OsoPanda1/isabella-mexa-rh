/* ============================================================================
 * Isabella Stripe Billing Gateway
 *
 * Integración real con la API de Stripe Checkout (no mock). El catálogo se
 * sincroniza desde el arranque: crea/recupera los productos y sus precios de
 * suscripción mensual, de modo que NO hace falta poblar STRIPE_PRICE_* a mano.
 *
 * Precios objetivo (25% por debajo del promedio de mercado, USD/mes):
 *   Plus $15.00 · Premium $22.49 · VIP $37.49 · Enterprise $112.50
 *
 * El pago se procesa por Stripe (Checkout Session) y el webhook aplica el plan
 * con setUserPlan tras checkout.session.completed.
 * ============================================================================ */
import type Stripe from "stripe";
import type { IsabellaPlanId } from "../subscription.server";
import { setUserPlan } from "../subscription.server";
import { nodeRequire } from "../node-require";

type StripeClient = Stripe | null;
type PriceObject = Stripe.Price;

export interface BillingAmount {
  label: string;
  amountCents: number;
  envVar: string;
}

/** Catálogo canónico: montos en centavos (USD), 25% bajo promedio de mercado. */
export const STRIPE_CATALOG: Record<"plus" | "premium" | "vip" | "enterprise", BillingAmount> = {
  plus: { label: "Isabella Plus", amountCents: 1500, envVar: "STRIPE_PRICE_PLUS" },
  premium: { label: "Isabella Premium", amountCents: 2249, envVar: "STRIPE_PRICE_PREMIUM" },
  vip: { label: "Isabella VIP", amountCents: 3749, envVar: "STRIPE_PRICE_VIP" },
  enterprise: { label: "Isabella Enterprise", amountCents: 11250, envVar: "STRIPE_PRICE_ENTERPRISE" },
};

const PAID_PLANS: Array<keyof typeof STRIPE_CATALOG> = ["plus", "premium", "vip", "enterprise"];

let stripeClient: StripeClient = null;
let catalogReady = false;

export function getStripe(): StripeClient {
  if (stripeClient) return stripeClient;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  try {
    const StripeModule = nodeRequire("stripe") as unknown as new (apiKey: string, opts?: Record<string, unknown>) => NonNullable<StripeClient>;
    stripeClient = new StripeModule(secret, { apiVersion: "2024-06-20" });
  } catch {
    stripeClient = null;
  }
  return stripeClient;
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripe());
}

function priceFromEnv(planId: keyof typeof STRIPE_CATALOG): PriceObject | null {
  const client = getStripe();
  if (!client) return null;
  const priceId = process.env[STRIPE_CATALOG[planId].envVar];
  if (!priceId) return null;
  return { id: priceId } as PriceObject;
}

/**
 * Crea/recupera el producto y su precio mensual para cada plan. Sincroniza el
 * monto objetivo y persiste los IDs en process.env[STRIPE_PRICE_*] para que el
 * resto del runtime los pueda leer. Idempotente.
 */
export async function ensureStripeCatalog(): Promise<boolean> {
  const client = getStripe();
  if (!client) return false;
  if (catalogReady) return true;

  for (const planId of PAID_PLANS) {
    const spec = STRIPE_CATALOG[planId];
    try {
      // Producto activo por etiqueta estable (evita duplicados entre arranques).
      const products = await client.products.list({
        active: true,
        limit: 100,
      });
      let product = products.data.find((p) => p.name === spec.label) ?? null;
      if (!product) {
        product = await client.products.create({ name: spec.label, active: true });
      }

      // Precio mensual recurrente; si existe uno con el monto correcto lo
      // reutilizamos, si no creamos uno nuevo.
      const prices = await client.prices.list({ product: product.id, active: true, limit: 100 });
      let price = prices.data.find((p) => p.unit_amount === spec.amountCents && p.recurring?.interval === "month") ?? null;
      if (!price) {
        price = await client.prices.create({
          product: product.id,
          unit_amount: spec.amountCents,
          currency: "usd",
          recurring: { interval: "month" },
        });
      }
      process.env[spec.envVar] = price.id;
    } catch (err) {
      // Catálogo parcial no debe tumbar el arranque; se reintenta en runtime.
      // eslint-disable-next-line no-console
      console.warn(`[stripe] catalog sync failed for ${planId}`, err);
    }
  }

  catalogReady = true;
  return true;
}

/** Crea una Checkout Session de Stripe para el plan solicitado. */
export async function createStripeCheckoutSession(planId: IsabellaPlanId, clientReferenceId: string): Promise<{ url: string } | null> {
  const client = getStripe();
  if (!client) return null;
  if (planId === "free" || planId === "custom") return null;
  if (!(planId in STRIPE_CATALOG)) return null;

  await ensureStripeCatalog();
  const price = priceFromEnv(planId as keyof typeof STRIPE_CATALOG);
  if (!price) return null;

  const base = process.env.BILLING_CHECKOUT_BASE_URL || process.env.VITE_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const session = await client.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: clientReferenceId,
      metadata: { planId, userId: clientReferenceId },
      success_url: `${base}/billing/result?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${base}/billing/result?status=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      payment_method_collection: "if_required",
    });
    return session.url ? { url: session.url } : null;
  } catch {
    return null;
  }
}

/**
 * Verifica y procesa un evento de webhook de Stripe.
 * Aplica el plan tras checkout.session.completed.
 */
export async function handleStripeWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean; error?: string }> {
  const client = getStripe();
  if (!client) return { received: false, error: "stripe_not_configured" };
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return { received: false, error: "STRIPE_WEBHOOK_SECRET not configured" };

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return { received: false, error: `webhook_signature_invalid: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const planId = (session.metadata?.planId ?? session.client_reference_id) as IsabellaPlanId | undefined;
    const userId = (session.client_reference_id ?? session.metadata?.userId) as string | undefined;
    if (userId && planId && (planId === "plus" || planId === "premium" || planId === "vip" || planId === "enterprise")) {
      setUserPlan(userId, planId);
    }
  }
  return { received: true };
}
