export type LiveConfig = {
  gatewayBaseUrl: string;
  gatewayApiKey: string;
  gatewayModel: string;
  gatewayTimeoutMs: number;
  mcpApiKey: string;
  mcpTimeoutMs: number;
  mcpUrls: Record<string, string>;
  jevUrl: string;
  jevApiKey: string;
  jevModel: string;
  jevTimeoutMs: number;
};

export type ConfigResult = { ok: true; config: LiveConfig } | { ok: false; reason: string };
const endpointKeys = ["MCP_CUSTOMER_URL", "MCP_PRODUCT_URL", "MCP_APPLICATION_URL", "MCP_CLAIM_URL", "MCP_POLICY_URL"] as const;
function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
function httpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) return null;
    return url.toString();
  } catch { return null; }
}

export function validateLiveConfig(env: NodeJS.ProcessEnv): ConfigResult {
  if (env.DEMO_MODE !== "live") return { ok: false, reason: "DEMO_MODE must be explicitly set to live; offline is the default." };
  if (env.LIVE_ACCESS_APPROVED !== "true") return { ok: false, reason: "A separate explicit live-access approval flag is required." };
  if (env.LIVE_UI_ENABLED !== "true") return { ok: false, reason: "The live UI path is not explicitly enabled." };
  const gatewayUrl = httpUrl(env.AI_GATEWAY_BASE_URL);
  const gatewayApiKey = env.AI_GATEWAY_API_KEY;
  const gatewayModel = env.AI_GATEWAY_MODEL;
  const gatewayTimeoutMs = positiveInteger(env.AI_GATEWAY_TIMEOUT_MS);
  const mcpApiKey = env.MCP_API_KEY;
  const mcpTimeoutMs = positiveInteger(env.MCP_TIMEOUT_MS);
  const jevUrl = httpUrl(env.AI_GATEWAY_JEV_URL);
  const jevApiKey = env.AI_GATEWAY_JEV_API_KEY;
  const jevModel = env.AI_GATEWAY_JEV_MODEL;
  const jevTimeoutMs = positiveInteger(env.AI_GATEWAY_JEV_TIMEOUT_MS);
  const mcpEntries = endpointKeys.map((key) => [key, httpUrl(env[key])] as const);
  if (!gatewayUrl || !gatewayApiKey || !gatewayModel || !gatewayTimeoutMs || !mcpApiKey || !mcpTimeoutMs || !jevUrl || !jevApiKey || !jevModel || !jevTimeoutMs || mcpEntries.some(([, url]) => !url)) {
    return { ok: false, reason: "Required live Gateway, MCP, Jev, model, or timeout configuration is missing or invalid." };
  }
  return {
    ok: true,
    config: {
      gatewayBaseUrl: gatewayUrl,
      gatewayApiKey,
      gatewayModel,
      gatewayTimeoutMs,
      mcpApiKey,
      mcpTimeoutMs,
      mcpUrls: Object.fromEntries(mcpEntries.map(([key, url]) => [key.replace("MCP_", "").replace("_URL", "").toLowerCase(), url!])),
      jevUrl,
      jevApiKey,
      jevModel,
      jevTimeoutMs,
    },
  };
}

export class TurnUsageCounter {
  private phaseAGenerations = 0;
  private supplementGenerations = 0;
  private mcpInvocations = 0;
  recordGeneration(phase: "agent" | "supplement"): void {
    if (phase === "agent") this.phaseAGenerations += 1;
    else this.supplementGenerations += 1;
  }
  recordMcpInvocation(): void { this.mcpInvocations += 1; }
  usage() { return { phaseAGenerations: this.phaseAGenerations, supplementGenerations: this.supplementGenerations, mcpInvocations: this.mcpInvocations }; }
}

export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class LiveRequestRegistry {
  private readonly reserved = new Map<string, { fingerprint: string; result: Promise<unknown>; completed: boolean }>();

  async execute<T>(requestId: string, fingerprint: string, operation: () => Promise<T>): Promise<{ status: "created" | "replayed"; result: T } | { status: "conflict" | "full" }> {
    const previous = this.reserved.get(requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return { status: "conflict" };
      return { status: "replayed", result: await previous.result as T };
    }
    if (this.reserved.size >= 4096) {
      const oldestCompleted = [...this.reserved].find(([, entry]) => entry.completed);
      if (!oldestCompleted) return { status: "full" };
      this.reserved.delete(oldestCompleted[0]);
    }
    const entry = { fingerprint, result: Promise.resolve().then(operation) as Promise<unknown>, completed: false };
    this.reserved.set(requestId, entry);
    const result = entry.result as Promise<T>;
    void result.then(() => { entry.completed = true; }, () => { entry.completed = true; });
    return { status: "created", result: await result };
  }
}
