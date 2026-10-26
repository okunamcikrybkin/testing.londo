export type SiteLogConfig = {
  apiSecret: string;
  siteUrl: string;
};

/** Returns null when optional site logging has not been configured locally. */
export function loadSiteLogConfig(): SiteLogConfig | null {
  const siteUrl = process.env.LONDO_SITE_URL?.trim();
  const apiSecret = process.env.LONDO_BOT_API_SECRET?.trim();

  if (!siteUrl || !apiSecret) {
    return null;
  }

  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return { apiSecret, siteUrl };
}
