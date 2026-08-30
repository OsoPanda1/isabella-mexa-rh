/**
 * Isabella Villaseñor AI — Idlen Chat Ads Integration (Server-Sive)
 * Monetización contextual de conversaciones con ads nativos gobernados por ARGUS.
 *
 * Attribution checklist (per Idlen docs):
 * - Stable sessionId for the same session lifecycle
 * - One ad fetch per render cycle (no duplicate impressions)
 * - Impression auto-tracked by getAd()
 * - Click tracked explicitly via trackClick()
 */
import { IdlenChatAds } from "@idlen/chat-sdk/server";
import type { ChatAdRequest, ChatContext, ChatAdFormat } from "@idlen/chat-sdk";

const IDLEN_API_KEY = process.env.IDLEN_API_KEY || "";
const IDLEN_ENABLED = IDLEN_API_KEY.startsWith("idl_pk_");

let adsClient: IdlenChatAds | null = null;

function getClient(): IdlenChatAds | null {
  if (!IDLEN_ENABLED) return null;
  if (!adsClient) {
    adsClient = new IdlenChatAds({ apiKey: IDLEN_API_KEY });
  }
  return adsClient;
}

export interface IsabellaAdResult {
  hasAd: boolean;
  ad?: {
    adId: string;
    title: string;
    body: string;
    ctaText: string;
    ctaUrl: string;
    format: string;
    imageUrl?: string;
    advertiserName: string;
    advertiserLogo?: string;
    markdown: string;
    html: string;
    plainText: string;
    impressionToken: string;
    publisherId: string;
    requestId: string;
  };
  context?: ChatContext;
  error?: string;
}

/**
 * Obtiene un ad contextual para una conversación de Isabella.
 * Impression is auto-tracked by getAd() per Idlen docs.
 */
export async function getIsabellaAd(params: {
  sessionId: string;
  userMessage: string;
  format?: ChatAdFormat;
}): Promise<IsabellaAdResult> {
  const client = getClient();
  if (!client) {
    return { hasAd: false, error: "IDLEN_NOT_CONFIGURED" };
  }

  try {
    const context = client.extractContext(params.userMessage);

    const request: ChatAdRequest = {
      sessionId: params.sessionId,
      rawText: params.userMessage,
      context: {
        topics: context.topics,
        intent: context.intent,
        category: context.category,
      },
      format: params.format || "chat_sponsored_recommendation",
      maxAds: 1,
    };

    // getAd() auto-tracks the impression per Idlen docs
    const ad = await client.getAd(request);

    if (!ad) {
      return { hasAd: false, context };
    }

    return {
      hasAd: true,
      ad: {
        adId: ad.adId,
        title: ad.title,
        body: ad.body,
        ctaText: ad.ctaText,
        ctaUrl: ad.ctaUrl,
        format: ad.format,
        imageUrl: ad.imageUrl,
        advertiserName: ad.advertiserName,
        advertiserLogo: ad.advertiserLogo,
        markdown: ad.renderMarkdown(),
        html: ad.renderHTML(),
        plainText: ad.renderPlainText(),
        impressionToken: ad.impressionToken,
        publisherId: ad.publisherId,
        requestId: ad.requestId,
      },
      context,
    };
  } catch (err: any) {
    return { hasAd: false, error: err?.message || String(err) };
  }
}

/**
 * Server-side click tracking per Idlen docs:
 *   await ads.trackClick(ad.adId, ad.publisherId, ad.requestId);
 */
export async function trackIdlenClick(params: {
  adId: string;
  publisherId: string;
  requestId: string;
}): Promise<{ tracked: boolean; error?: string }> {
  const client = getClient();
  if (!client) {
    return { tracked: false, error: "IDLEN_NOT_CONFIGURED" };
  }

  try {
    await client.trackClick(params.adId, params.publisherId, params.requestId);
    return { tracked: true };
  } catch (err: any) {
    return { tracked: false, error: err?.message || String(err) };
  }
}

/**
 * Ad con frecuencia controlada: solo cada 3er mensaje.
 * Una sola fetch por ciclo de render (no duplicate impressions).
 */
export async function maybeAppendAd(
  responseText: string,
  params: {
    sessionId: string;
    userMessage: string;
    messageCount: number;
  },
): Promise<{ text: string; ad?: IsabellaAdResult["ad"] }> {
  if (params.messageCount % 3 !== 0 || params.messageCount === 0) {
    return { text: responseText };
  }

  const adResult = await getIsabellaAd({
    sessionId: params.sessionId,
    userMessage: params.userMessage,
    format: "chat_sponsored_recommendation",
  });

  if (!adResult.hasAd || !adResult.ad) {
    return { text: responseText };
  }

  const adBlock = `\n\n---\n${adResult.ad.markdown}`;
  return { text: responseText + adBlock, ad: adResult.ad };
}

export function getIdlenStatus() {
  return {
    configured: IDLEN_ENABLED,
    apiKeyPrefix: IDLEN_API_KEY ? IDLEN_API_KEY.slice(0, 12) + "..." : "NOT_SET",
    clientReady: adsClient !== null,
  };
}
