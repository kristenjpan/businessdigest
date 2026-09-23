export const PRODUCT_TOKEN = "DailyAllocationDigest";

/**
 * Identifying User-Agent. SEC asks automated clients to include a contact
 * (https://www.sec.gov/os/accessing-edgar-data). `SEC_CONTACT` is optional: when it is unset,
 * GitHub Actions' built-in repo URL is used, so the pipeline needs no configuration.
 */
export function userAgent(): string {
  const repo =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
      : "";
  const contact = process.env.SEC_CONTACT?.trim() || repo;
  return `${PRODUCT_TOKEN}/1.0 (public-feed news digest${contact ? `; ${contact}` : ""})`;
}
