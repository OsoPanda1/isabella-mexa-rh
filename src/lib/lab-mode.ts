/**
 * FEATURE_LAB_MODE — Controls prototype/simulated components.
 *
 * When false (default in production), all PQC/HSM/TEE functions throw
 * PROTOTYPE_NOT_AVAILABLE, making it impossible to accidentally use
 * simulated cryptography as if it were production.
 *
 * When true, prototype functions return simulated results for development,
 * testing, and lab environments only.
 */
export const LAB_MODE = process.env.FEATURE_LAB_MODE === "true";

export function requireLabMode(component: string): void {
  if (!LAB_MODE) {
    throw new Error(
      `PROTOTYPE_NOT_AVAILABLE: ${component} is a laboratory prototype. ` +
      `Set FEATURE_LAB_MODE=true to enable. ` +
      `This component must NOT be used in production.`
    );
  }
}

export function labDisclaimer(component: string): string {
  return `[LAB_PROTOTYPE] ${component} — Not production. Simulated results.`;
}
