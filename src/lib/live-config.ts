export type LiveConfig = {
  gatewayBaseUrl: string;
  gatewayApiKey: string;
  gatewayModel: string;
  gatewayTimeoutMs: number;
  gatewayRequestBudget: number;
  mcpTimeoutMs: number;
  mcpToolInvocationBudget: number;
  mcpUrls: Record<string, string>;
  jevUrl: string;
  jevApiKey: string;
  jevModel: string;
  jevTimeoutMs: number;
  jevAttemptBudget: number;
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
  const gatewayRequestBudget = positiveInteger(env.AI_GATEWAY_REQUEST_BUDGET);
  const mcpTimeoutMs = positiveInteger(env.MCP_TIMEOUT_MS);
  const mcpToolInvocationBudget = positiveInteger(env.MCP_TOOL_INVOCATION_BUDGET);
  const jevUrl = httpUrl(env.AI_GATEWAY_JEV_URL);
  const jevApiKey = env.AI_GATEWAY_JEV_API_KEY;
  const jevModel = env.AI_GATEWAY_JEV_MODEL;
  const jevTimeoutMs = positiveInteger(env.AI_GATEWAY_JEV_TIMEOUT_MS);
  const jevAttemptBudget = positiveInteger(env.AI_GATEWAY_JEV_ATTEMPT_BUDGET);
  const mcpEntries = endpointKeys.map((key) => [key, httpUrl(env[key])] as const);
  if (!gatewayUrl || !gatewayApiKey || !gatewayModel || !gatewayTimeoutMs || !gatewayRequestBudget || !mcpTimeoutMs || !mcpToolInvocationBudget || !jevUrl || !jevApiKey || !jevModel || !jevTimeoutMs || !jevAttemptBudget || mcpEntries.some(([, url]) => !url)) {
    return { ok: false, reason: "Required live Gateway, MCP, Jev, model, timeout, or request-budget configuration is missing or invalid." };
  }
  return {
    ok: true,
    config: {
      gatewayBaseUrl: gatewayUrl,
      gatewayApiKey,
      gatewayModel,
      gatewayTimeoutMs,
      gatewayRequestBudget,
      mcpTimeoutMs,
      mcpToolInvocationBudget,
      mcpUrls: Object.fromEntries(mcpEntries.map(([key, url]) => [key.replace("MCP_", "").replace("_URL", "").toLowerCase(), url!])),
      jevUrl,
      jevApiKey,
      jevModel,
      jevTimeoutMs,
      jevAttemptBudget,
    },
  };
}

export class ProcessUsageBudget {
  private gatewayCalls = 0;
  private jevAttempts = 0;
  private mcpInvocations = 0;
  private gatewayLimit?: number;
  private jevLimit?: number;
  private mcpLimit?: number;

  configure(gatewayLimit: number, jevLimit: number, mcpLimit: number): boolean {
    if (this.gatewayLimit !== undefined && this.gatewayLimit !== gatewayLimit) return false;
    if (this.jevLimit !== undefined && this.jevLimit !== jevLimit) return false;
    if (this.mcpLimit !== undefined && this.mcpLimit !== mcpLimit) return false;
    this.gatewayLimit = gatewayLimit;
    this.jevLimit = jevLimit;
    this.mcpLimit = mcpLimit;
    return true;
  }
  reserveGatewayCall(): boolean {
    if (this.gatewayLimit === undefined || this.gatewayCalls >= this.gatewayLimit) return false;
    this.gatewayCalls += 1;
    return true;
  }
  reserveJevAttempt(): boolean {
    if (this.jevLimit === undefined || this.jevAttempts >= this.jevLimit) return false;
    this.jevAttempts += 1;
    return true;
  }
  reserveMcpInvocation(): boolean {
    if (this.mcpLimit === undefined || this.mcpInvocations >= this.mcpLimit) return false;
    this.mcpInvocations += 1;
    return true;
  }
  usage() { return { gatewayCalls: this.gatewayCalls, jevAttempts: this.jevAttempts, mcpInvocations: this.mcpInvocations }; }
}

export class TurnLimits {
  private phaseAGenerations = 0;
  private supplementGenerations = 0;
  private mcpInvocations = 0;
  reserveGeneration(phase: "agent" | "supplement"): boolean {
    if (phase === "agent") {
      if (this.phaseAGenerations >= 6) return false;
      this.phaseAGenerations += 1;
      return true;
    }
    if (this.supplementGenerations >= 1) return false;
    this.supplementGenerations += 1;
    return true;
  }
  reserveMcpInvocation(): boolean {
    if (this.mcpInvocations >= 8) return false;
    this.mcpInvocations += 1;
    return true;
  }
  usage() { return { phaseAGenerations: this.phaseAGenerations, supplementGenerations: this.supplementGenerations, mcpInvocations: this.mcpInvocations }; }
}

export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class LiveRequestRegistry {
  private readonly reserved = new Map<string, { fingerprint: string; result: Promise<unknown> }>();

  async execute<T>(requestId: string, fingerprint: string, operation: () => Promise<T>): Promise<{ status: "created" | "replayed"; result: T } | { status: "conflict" | "full" }> {
    const previous = this.reserved.get(requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return { status: "conflict" };
      return { status: "replayed", result: await previous.result as T };
    }
    if (this.reserved.size >= 4096) return { status: "full" };
    const result = Promise.resolve().then(operation);
    this.reserved.set(requestId, { fingerprint, result });
    return { status: "created", result: await result };
  }
}
