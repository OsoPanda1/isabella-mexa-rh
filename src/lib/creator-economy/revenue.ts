/**
 * Revenue split engine (spec §6.3) — exact integer math, no floats across
 * financial boundaries:
 *
 *   neto_distribuible = bruto_base - procesamiento - terceros - reserva
 *   creador           = neto_distribuible × share_plan / 100
 *
 * Verification of the worked example (§6.3, gift $100.00 MXN via web,
 * Premium plan):
 *   gross 10000, IVA 1379, base 8621
 *   processor: 3.6% + $3.00 = 660 + IVA 106 = 766
 *   reserve 5% of base = 431
 *   net = 8621 - 766 - 431 = 7424
 *   creator 85% = 6310, platform 15% = 1114
 */

import { extractVatFromGross } from "./tax-engine";
import { PLANS } from "./plans";
import type { Currency, PlanId, RevenueSplit } from "./types";

export const CHARGEBACK_RESERVE_PERCENT = 5;
export const STRIPE_PERCENT = 3.6;
export const STRIPE_FIXED_MXN_MINOR = 300; // $3.00 MXN

const roundHalfUp = (x: number): number => Math.floor(x + 0.5);

export interface ProcessorQuote {
  feeMinor: number; // incluye IVA de la comisión
}

/** Stripe MX web checkout: 3.6% + $3.00, plus IVA 16% on the fee itself. */
export function quoteStripeFee(grossMinor: number): ProcessorQuote {
  const feeBase = roundHalfUp((grossMinor * STRIPE_PERCENT) / 100) + STRIPE_FIXED_MXN_MINOR;
  const feeVat = roundHalfUp((feeBase * 16) / 100);
  return Object.freeze({ feeMinor: feeBase + feeVat });
}

export interface SplitInput {
  grossAmountMinor: number;
  currency: Currency;
  plan: PlanId;
  thirdPartyFeeMinor?: number; // app-store cuts, 0 for web
  processorFeeMinor?: number; // override for tests / non-Stripe rails
}

export function computeRevenueSplit(input: SplitInput): RevenueSplit {
  const vatAmountMinor = extractVatFromGross(input.grossAmountMinor);
  const taxableBaseMinor = input.grossAmountMinor - vatAmountMinor;
  const processorFeeMinor =
    input.processorFeeMinor ?? quoteStripeFee(input.grossAmountMinor).feeMinor;
  const thirdPartyFeeMinor = input.thirdPartyFeeMinor ?? 0;
  const chargebackReserveMinor = roundHalfUp(
    (taxableBaseMinor * CHARGEBACK_RESERVE_PERCENT) / 100,
  );

  // I_neto = M_bruto − IVA − C_procesamiento − C_terceros − R_reserva (§6.3).
  const netDistributableMinor = Math.max(
    0,
    input.grossAmountMinor -
      vatAmountMinor -
      processorFeeMinor -
      thirdPartyFeeMinor -
      chargebackReserveMinor,
  );

  const platformPercent = PLANS[input.plan].platformGiftSharePercent;
  const creatorPercent = 100 - platformPercent;
  const creatorShareMinor = roundHalfUp((netDistributableMinor * creatorPercent) / 100);
  const platformShareMinor = netDistributableMinor - creatorShareMinor;

  return Object.freeze({
    grossAmountMinor: input.grossAmountMinor,
    vatAmountMinor,
    taxableBaseMinor,
    processorFeeMinor,
    thirdPartyFeeMinor,
    chargebackReserveMinor,
    netDistributableMinor,
    creatorShareMinor,
    platformShareMinor,
  });
}

/**
 * Asientos contables (§7.3): maps a split into debit/credit lines that
 * satisfy Σdebit = Σcredit exactly. Amounts in minor units.
 */
export function splitToLedgerLines(split: RevenueSplit): Array<{
  account:
    | "customer_cash_clearing"
    | "payment_processor_expense"
    | "tax_vat_payable"
    | "chargeback_reserve_held"
    | "creator_payable_pending"
    | "platform_revenue_gross";
  direction: "debit" | "credit";
  amountMinor: number;
}> {
  // Asiento de doble entrada (matriz §7.3). Pasarela y canal retienen sus
  // comisiones en origen: el clearing recibe solo el neto liquidado, y las
  // comisiones se reconocen como gasto. La distribución cubre el neto:
  //   IVA + reserva + creador + plataforma = bruto − fee − terceros (identidad §6.3)
  //   débitos  = (bruto − fee − terceros) clearing + fee + terceros gasto = bruto
  //   créditos = (fee + terceros) clearing + (bruto − fee − terceros) distribución = bruto ✓
  const cashSettledMinor =
    split.grossAmountMinor - split.processorFeeMinor - split.thirdPartyFeeMinor;

  const lines: Array<{
    account:
      | "customer_cash_clearing"
      | "payment_processor_expense"
      | "tax_vat_payable"
      | "chargeback_reserve_held"
      | "creator_payable_pending"
      | "platform_revenue_gross";
    direction: "debit" | "credit";
    amountMinor: number;
  }> = [
    { account: "customer_cash_clearing", direction: "debit", amountMinor: cashSettledMinor },
    { account: "payment_processor_expense", direction: "debit", amountMinor: split.processorFeeMinor },
    { account: "customer_cash_clearing", direction: "credit", amountMinor: split.processorFeeMinor },
    { account: "tax_vat_payable", direction: "credit", amountMinor: split.vatAmountMinor },
    { account: "chargeback_reserve_held", direction: "credit", amountMinor: split.chargebackReserveMinor },
    { account: "creator_payable_pending", direction: "credit", amountMinor: split.creatorShareMinor },
    { account: "platform_revenue_gross", direction: "credit", amountMinor: split.platformShareMinor },
  ];
  if (split.thirdPartyFeeMinor > 0) {
    lines.push({ account: "payment_processor_expense", direction: "debit", amountMinor: split.thirdPartyFeeMinor });
    lines.push({ account: "customer_cash_clearing", direction: "credit", amountMinor: split.thirdPartyFeeMinor });
  }
  return lines.filter((l) => l.amountMinor > 0);
}
