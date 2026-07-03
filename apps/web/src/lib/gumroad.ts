/**
 * Gumroad checkout links for each credit plan.
 * Permalinks match the published products at jobclawd.gumroad.com.
 */
export const GUMROAD_CHECKOUT: Record<string, string> = {
  starter: "https://jobclawd.gumroad.com/l/jobclawd-value-20",
  value: "https://jobclawd.gumroad.com/l/jobclawd-value-60",
  power: "https://jobclawd.gumroad.com/l/jobclawd-power-150",
};

/**
 * Build a Gumroad checkout URL for a plan, pre-filling the buyer's email so the
 * credits land on the correct JobClawd account. `wanted=true` opens checkout directly.
 */
export function gumroadCheckoutUrl(planId: string, email?: string): string {
  const base = GUMROAD_CHECKOUT[planId];
  if (!base) return "";
  const params = new URLSearchParams({ wanted: "true" });
  if (email) params.set("email", email);
  return `${base}?${params.toString()}`;
}
