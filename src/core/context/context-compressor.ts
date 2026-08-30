/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — CONTEXT COMPRESSOR (Module 3)
 * Manages context window: compresses history when it exceeds limits.
 * ================================================================
 */

export type MessageRole = "user" | "system" | "tool" | "assistant";

export interface CompressedContext {
  readonly messages: Array<{ role: MessageRole; content: string }>;
  readonly compressed: boolean;
  readonly originalCount: number;
  readonly compressedCount: number;
}

const SUMMARY_MARKER = "[context compressed]";

export function compressContext(
  messages: Array<{ role: MessageRole; content: string }>,
  contextWindowTokens: number,
): CompressedContext {
  const estimatedTokens = estimateTokens(messages);

  if (estimatedTokens <= contextWindowTokens) {
    return {
      messages,
      compressed: false,
      originalCount: messages.length,
      compressedCount: messages.length,
    };
  }

  const targetTokens = Math.floor(contextWindowTokens * 0.75);
  const preserved: Array<{ role: MessageRole; content: string }> = [];
  let tokenCount = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens([messages[i]]);
    if (tokenCount + msgTokens > targetTokens) break;
    preserved.unshift(messages[i]);
    tokenCount += msgTokens;
  }

  const summary: { role: MessageRole; content: string } = {
    role: "system",
    content: `${SUMMARY_MARKER} (${messages.length - preserved.length} messages summarized) Earlier conversation context was compressed to fit the context window.`,
  };

  return {
    messages: [summary, ...preserved],
    compressed: true,
    originalCount: messages.length,
    compressedCount: preserved.length + 1,
  };
}

function estimateTokens(messages: Array<{ role: MessageRole; content: string }>): number {
  let total = 0;
  for (const m of messages) {
    total += Math.ceil(m.content.length / 3.5) + 4;
  }
  return total;
}
