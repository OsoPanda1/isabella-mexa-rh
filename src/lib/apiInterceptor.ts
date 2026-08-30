/**
 * Backward-compatible re-export.
 * All logic has moved to secure-fetch.ts — this barrel preserves existing imports.
 */
export {
  sanitizePrompt,
  generateAuditId,
  isabellaFetch,
  analyzePrompt,
  configureIsabellaFetch,
  setInMemoryAccessToken,
  IsabellaRequestError,
  type PromptRisk,
  type PromptDisposition,
  type PromptFinding,
  type PromptPolicyResult,
  type IsabellaFetchOptions,
  type IsabellaFetchConfig,
  type RequestAuthMode,
} from "./secure-fetch";
