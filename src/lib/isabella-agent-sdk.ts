/**
 * Isabella Villaseñor AI™ — Native Agent SDK & Programmatic Leasing Library
 * 
 * Provides native programmatic agent leasing, streaming thoughts, tool call interception,
 * and interactive loop orchestration for Isabella Villaseñor AI v5.0.0.
 */

export interface CapabilitiesConfig {
  allowRunCommand?: boolean;
  allowFileEdit?: boolean;
  allowImageGen?: boolean;
  allowVoiceSynthesis?: boolean;
  allowNetworkFetch?: boolean;
  securityLevel?: "standard" | "elevated" | "zero_trust_strict";
}

export interface LocalAgentConfig {
  systemInstructions?: string;
  capabilities?: CapabilitiesConfig;
  activePreset?: "prime" | "empathic" | "strategic" | "sentinel" | "executor" | "synergistic";
  primaryModel?: string;
  territoryId?: string;
  leaseDurationMinutes?: number;
}

export interface AgentSessionInfo {
  sessionId: string;
  status: "active" | "terminated" | "expired";
  createdAt: string;
  expiresAt: string;
  systemInstructions: string;
  capabilities: CapabilitiesConfig;
  preset: string;
  model: string;
}

export interface InterceptedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: "approved" | "blocked" | "executed";
  result?: any;
  argusReason?: string;
  timestamp: string;
}

export interface CognitiveThoughtDelta {
  step: number;
  module: "ISA" | "SOPHIA" | "CROWN_GATEWAY" | "ORION" | "ARGUS";
  thought: string;
  confidence: number;
  timestamp: string;
}

export interface AgentChatResponse {
  text: string;
  thoughts: CognitiveThoughtDelta[];
  tool_calls: InterceptedToolCall[];
  telemetry: {
    tokensProcessed: number;
    latencyMs: number;
    modelUsed: string;
    isabellaMood: string;
    argusStatus: string;
  };
}

export class IsabellaAgent {
  private config: LocalAgentConfig;
  private baseUrl: string;
  private session: AgentSessionInfo | null = null;

  constructor(config: LocalAgentConfig = {}, baseUrl: string = "") {
    this.config = {
      systemInstructions: "Eres Isabella Villaseñor AI, infraestructura cognitiva territorial gobernada.",
      capabilities: {
        allowRunCommand: false,
        allowFileEdit: false,
        allowImageGen: true,
        allowVoiceSynthesis: true,
        allowNetworkFetch: true,
        securityLevel: "zero_trust_strict",
        ...config.capabilities,
      },
      activePreset: config.activePreset || "prime",
      primaryModel: config.primaryModel || "isabella-sovereign-v1",
      territoryId: config.territoryId || "rdm-nodo-cero",
      leaseDurationMinutes: config.leaseDurationMinutes || 60,
      ...config,
    };
    this.baseUrl = baseUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  }

  /**
   * Initializes and leases an agent session with C.R.O.W.N. Governance.
   */
  async lease(): Promise<AgentSessionInfo> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/isabella/agent/lease`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.config),
      });

      if (!res.ok) {
        throw new Error(`Error en arrendamiento de agente: HTTP ${res.status}`);
      }

      const data = await res.json();
      this.session = data.session;
      return this.session!;
    } catch (err) {
      // Fallback local session if server is offline
      const mockSession: AgentSessionInfo = {
        sessionId: `local-agent-${Date.now()}`,
        status: "active",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        systemInstructions: this.config.systemInstructions!,
        capabilities: this.config.capabilities!,
        preset: this.config.activePreset!,
        model: this.config.primaryModel!,
      };
      this.session = mockSession;
      return mockSession;
    }
  }

  /**
   * Sends a prompt and gets structured response with text, thoughts, tool calls, and telemetry.
   */
  async chat(prompt: string, contextPayload: Record<string, any> = {}): Promise<AgentChatResponse> {
    if (!this.session) {
      await this.lease();
    }

    const res = await fetch(`${this.baseUrl}/api/v1/isabella/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.session?.sessionId,
        prompt,
        contextPayload,
        capabilities: this.config.capabilities,
      }),
    });

    if (!res.ok) {
      throw new Error(`Error en ejecución de chat de agente: HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Streams response tokens, thoughts, and tool calls in real time.
   */
  async *stream(prompt: string): AsyncGenerator<{ type: "token" | "thought" | "tool_call" | "telemetry"; payload: any }> {
    if (!this.session) {
      await this.lease();
    }

    const response = await fetch(`${this.baseUrl}/api/v1/isabella/agent/stream?sessionId=${this.session?.sessionId}&prompt=${encodeURIComponent(prompt)}`);

    if (!response.body) {
      throw new Error("El servidor no admite streaming en este entorno.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  }

  /**
   * Returns current active session metadata.
   */
  getSession(): AgentSessionInfo | null {
    return this.session;
  }
}
