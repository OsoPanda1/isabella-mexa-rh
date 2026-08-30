/**
 * Tests: Billing — catálogo de precios reales (25% bajo promedio de mercado)
 * y generación de URLs de checkout (Stripe real, sin mock).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { STRIPE_CATALOG } from "../src/lib/billing/stripe";
import { ISABELLA_PLANS, buildCheckoutUrl, planById } from "../src/lib/subscription.server";

describe("stripe catalog (precios -25% del promedio de mercado)", () => {
  it("define montos correctos en centavos (USD)", () => {
    expect(STRIPE_CATALOG.plus.amountCents).toBe(1500); // $15.00
    expect(STRIPE_CATALOG.premium.amountCents).toBe(2249); // $22.49
    expect(STRIPE_CATALOG.vip.amountCents).toBe(3749); // $37.49
    expect(STRIPE_CATALOG.enterprise.amountCents).toBe(11250); // $112.50
  });

  it("cada plan pago tiene una variable STRIPE_PRICE_*", () => {
    for (const key of ["plus", "premium", "vip", "enterprise"]) {
      expect(STRIPE_CATALOG[key as keyof typeof STRIPE_CATALOG].envVar).toMatch(/^STRIPE_PRICE_[A-Z]+$/);
    }
  });
});

describe("plan pricing mirror", () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    for (const key of Object.keys(STRIPE_CATALOG)) {
      delete process.env[STRIPE_CATALOG[key as keyof typeof STRIPE_CATALOG].envVar];
    }
  });

  it("monthlyUsd coincide con el catálogo Stripe (sin redondeo roto)", () => {
    expect(planById("plus").monthlyUsd).toBe(STRIPE_CATALOG.plus.amountCents / 100);
    expect(planById("premium").monthlyUsd).toBe(STRIPE_CATALOG.premium.amountCents / 100);
    expect(planById("vip").monthlyUsd).toBe(STRIPE_CATALOG.vip.amountCents / 100);
    expect(planById("enterprise").monthlyUsd).toBe(STRIPE_CATALOG.enterprise.amountCents / 100);
  });

  it("buildCheckoutUrl cae a contacto comercial cuando Stripe no está configurado (sin mock)", () => {
    const url = buildCheckoutUrl("plus", "user-1");
    expect(url).not.toContain("checkout/mock");
    expect(url).toContain("billing/contact");
    expect(ISABELLA_PLANS.some((p) => p.name.toLowerCase().includes("introducción"))).toBe(false);
  });

  it("buildCheckoutUrl usa el provider de Stripe cuando STRIPE_SECRET_KEY está presente", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const url = buildCheckoutUrl("premium", "user-2");
    expect(url).toContain("/api/v1/billing/checkout/provider");
    expect(url).toContain("plan=premium");
  });
});
