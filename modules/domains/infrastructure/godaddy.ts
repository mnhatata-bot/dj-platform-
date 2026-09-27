export type DomainAvailability = {
  domain: string;
  available: boolean | null;
  price?: number;
  currency?: string;
  definitive: boolean;
  affiliateUrl: string;
};

const apiBase = "https://api.godaddy.com";

function affiliateUrl(domain: string) {
  const url = new URL("https://www.godaddy.com/domains/searchresults.aspx");
  url.searchParams.set("domainToCheck", domain);
  const affiliate = process.env.GODADDY_AFFILIATE_CODE;
  if (affiliate) url.searchParams.set("isc", affiliate);
  return url.toString();
}

export const godaddy = {
  configured() {
    return Boolean(process.env.GODADDY_PAT);
  },
  affiliateUrl,
  async availability(domain: string): Promise<DomainAvailability> {
    const fallback: DomainAvailability = {
      domain,
      available: null,
      definitive: false,
      affiliateUrl: affiliateUrl(domain),
    };
    const token = process.env.GODADDY_PAT;
    if (!token) return fallback;
    const url = new URL("/v1/domains/available", apiBase);
    url.searchParams.set("domain", domain);
    url.searchParams.set("checkType", "FAST");
    url.searchParams.set("forTransfer", "false");
    const shopperId = process.env.GODADDY_SHOPPER_ID;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(shopperId ? { "X-Shopper-Id": shopperId } : {}) },
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    const result = (await response.json()) as {
      available?: boolean;
      definitive?: boolean;
      price?: number;
      currency?: string;
    };
    return {
      ...fallback,
      available: typeof result.available === "boolean" ? result.available : null,
      definitive: Boolean(result.definitive),
      price: typeof result.price === "number" ? result.price / 1_000_000 : undefined,
      currency: result.currency,
    };
  },
};
