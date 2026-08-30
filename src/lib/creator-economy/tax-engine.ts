/**
 * Motor tributario SAT México 2026 — Régimen de Plataformas Digitales.
 *
 * Conforme a LISR Art. 113-A/113-B y LIVA Art. 18-M (ejercicio 2026):
 *   - Con RFC validado + e.firma: ISR 2.1% sobre base gravable, IVA retenido 50%
 *   - Sin RFC o RFC inválido:      ISR 20.0% sobre base gravable, IVA retenido 100%
 *
 * Los montos se calculan en enteros (centavos) con redondeo half-up por paso,
 * nunca con aritmética flotante acumulada.
 */

import type { Currency, TaxDeductionCalculation } from "./types";

export const VAT_RATE_PERCENT = 16; // IVA México
export const ISR_RATE_RFC_VALID_PERCENT = 2.1;
export const ISR_RATE_NO_RFC_PERCENT = 20.0;
export const VAT_WITHHELD_RFC_VALID_PERCENT = 50;
export const VAT_WITHHELD_NO_RFC_PERCENT = 100;

const roundHalfUp = (x: number): number => Math.floor(x + 0.5);

/** Extract the IVA included in a gross, tax-inclusive amount. */
export function extractVatFromGross(grossMinor: number, vatRatePercent = VAT_RATE_PERCENT): number {
  // gross = base * (1 + rate/100)  =>  vat = gross * rate / (100 + rate)
  return roundHalfUp((grossMinor * vatRatePercent) / (100 + vatRatePercent));
}

export interface TaxInput {
  grossAmountMinor: number;
  currency: Currency;
  rfc: string | null;
  rfcValidated: boolean;
  eFirmaValid: boolean;
  taxResidencyCountry: string;
  vatApplies?: boolean; // default true for MX
}

export function calculateSatDeductions(input: TaxInput): TaxDeductionCalculation {
  const vatApplies = input.vatApplies ?? input.taxResidencyCountry === "MX";
  const rfcOk = Boolean(input.rfc) && input.rfcValidated && input.eFirmaValid;

  const vatAmountMinor = vatApplies ? extractVatFromGross(input.grossAmountMinor) : 0;
  const taxableBaseMinor = input.grossAmountMinor - vatAmountMinor;

  const appliedIsrRatePercent =
    input.taxResidencyCountry === "MX"
      ? rfcOk
        ? ISR_RATE_RFC_VALID_PERCENT
        : ISR_RATE_NO_RFC_PERCENT
      : 0; // non-MX residency handled via W-8BEN/W-9 flows, no SAT withholding

  const appliedVatRatePercent = vatApplies
    ? rfcOk
      ? VAT_WITHHELD_RFC_VALID_PERCENT
      : VAT_WITHHELD_NO_RFC_PERCENT
    : 0;

  const isrWithheldMinor = roundHalfUp((taxableBaseMinor * appliedIsrRatePercent) / 100);
  const vatWithheldMinor = roundHalfUp((vatAmountMinor * appliedVatRatePercent) / 100);
  const netPayableToCreatorMinor = input.grossAmountMinor - isrWithheldMinor - vatWithheldMinor;

  return Object.freeze({
    grossAmountMinor: input.grossAmountMinor,
    vatAmountMinor,
    taxableBaseMinor,
    isrWithheldMinor,
    vatWithheldMinor,
    netPayableToCreatorMinor,
    rfcUsed: rfcOk ? input.rfc : null,
    appliedIsrRatePercent,
    appliedVatRatePercent,
  });
}

/** RFC syntax (personas físicas/morales, 12-13 chars) — structural check only. */
export function isRfcFormatValid(rfc: string): boolean {
  return /^[A-ZÑ&]{3,4}\d{6}[A-V0-9]{3}$/.test(rfc.trim().toUpperCase());
}

/** CLABE Interbancaria: 18 dígitos con dígito verificador ponderado (3,7,1). */
export function isClabeValid(clabe: string): boolean {
  const digits = clabe.trim();
  if (!/^\d{18}$/.test(digits)) return false;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += (Number(digits[i]) * weights[i % 3]) % 10;
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[17]);
}

/**
 * CFDI 4.0 (Complemento Plataformas Digitales) metadata payload — the
 * document itself is emitted by the certified PAC at month close.
 */
export function buildCfdiMetadata(creatorRfc: string, period: string, calc: TaxDeductionCalculation) {
  return Object.freeze({
    tipoComprobante: "R", // retenciones e información de pagos
    complemento: "plataformasdigitales",
    version: "4.0",
    periodo: period,
    receptorRfc: creatorRfc,
    impuestos: {
      isrRetenidoMinor: calc.isrWithheldMinor,
      ivaRetenidoMinor: calc.vatWithheldMinor,
      ivaTrasladadoMinor: calc.vatAmountMinor,
    },
  });
}
