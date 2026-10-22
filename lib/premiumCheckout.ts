// Client-side: send a premium bid from PremiumListingModal to checkout and follow the payment redirect.
// Stripe is the only payment method: checkout answers with the Stripe page to redirect to.

export interface PremiumFormData {
  /** Whole USD charged; with a live spot it is added to that bid. */
  bidUsd: number;
  /** The product's current live bid (0 when none): the bid this payment raises. */
  raiseFromUsd?: number;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderWebsite?: string;
  founderTwitter?: string;
  founderLinkedin?: string;
  founderInstagram?: string;
  founderFacebook?: string;
  founderTiktok?: string;
  founderYoutube?: string;
  founderGithub?: string;
  paymentMethod?: string;
}

/**
 * Starts checkout for one listing. Resolves 'redirecting' when the browser is being sent to the
 * payment page, or 'submitted' when no payment page is involved (e.g. a manual request for the admin).
 * Throws with a readable message on failure.
 */
export async function startPremiumCheckout(listingId: string, data: PremiumFormData): Promise<'redirecting' | 'submitted'> {
  const { paymentMethod, ...item } = data;
  const res = await fetch('/api/premium-listings/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ listingId, ...item }], paymentMethod: paymentMethod || 'stripe' }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || `Checkout failed (${res.status})`);

  if (result.paymentRequired && result.redirectUrl) {
    window.location.href = result.redirectUrl;
    return 'redirecting';
  }

  return 'submitted';
}
