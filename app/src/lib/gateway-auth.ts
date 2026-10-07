/**
 * Attach an AI Consumer key only to one known AI Gateway route.
 * The caller supplies a route URL (not just an origin) so redirects, other
 * paths, and provider destinations can never receive this inbound credential.
 */
export function createGatewayApiKeyFetch(
  routeUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  const configured = new URL(routeUrl);
  if ((configured.protocol !== "http:" && configured.protocol !== "https:") || configured.username || configured.password || configured.search || configured.hash || !apiKey) {
    throw new Error("Invalid Gateway route configuration");
  }
  const expectedPath = configured.pathname.replace(/\/+$/, "") || "/";
  const expectedOrigin = configured.origin;

  return async (input, init) => {
    const original = new Request(input, init);
    const target = new URL(original.url);
    if (
      target.origin !== expectedOrigin ||
      target.pathname !== expectedPath ||
      target.search !== "" ||
      target.hash !== "" ||
      target.username !== "" ||
      target.password !== "" ||
      original.method !== "POST"
    ) {
      throw new Error("Gateway request target is not allowed");
    }

    const headers = new Headers(original.headers);
    headers.delete("authorization");
    headers.set("apikey", apiKey);
    const request = new Request(original, { headers, redirect: "error" });
    const response = await fetchImpl(request);
    if (response.status >= 300 && response.status < 400) {
      throw new Error("Gateway redirect refused");
    }
    return response;
  };
}
