// Server-only: guest voter emails aren't verified, so make one inbox count as one voter.

// Throwaway inbox providers. Not exhaustive; it covers the ones offered first in search results.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me', '10minutemail.com', '10minutemail.net',
  'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempmail.plus', 'tempr.email',
  'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr', 'trashmail.com', 'trashmail.de', 'trashmail.net',
  'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'mohmal.com',
  'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'mailcatch.com', 'mytemp.email', 'moakt.com', 'burnermail.io',
  'discard.email', 'spambox.us', 'mailpoof.com', 'inboxkitten.com', 'emailfake.com', 'email-fake.com',
  'tmpmail.org', 'tmpmail.net', 'tmails.net', 'tempinbox.com', 'mail.tm', 'mail.gw', 'byom.de', 'linshiyouxiang.net',
  'dropmail.me', '1secmail.com', '1secmail.net', '1secmail.org', 'cock.li', 'mailsac.com', 'harakirimail.com',
  'mvrht.net', 'spamgourmet.com', 'jetable.org', 'mail-temp.com', 'luxusmail.org', 'tempmailaddress.com',
  'emltmp.com', 'vomoto.com', 'wuuvo.com', 'kzccv.com', 'qiott.com', 'cuvox.de', 'armyspy.com', 'dayrep.com',
  'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us',
]);

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Subdomains of a throwaway provider (e.g. x.mailinator.com).
  for (const d of DISPOSABLE_DOMAINS) if (domain.endsWith(`.${d}`)) return true;
  return false;
}

/**
 * The inbox an address delivers to: lowercase, "+tag" dropped (all major providers ignore it),
 * and for Gmail dots dropped and googlemail.com folded into gmail.com.
 * "Jo.Doe+vote2@googlemail.com" → "jodoe@gmail.com".
 */
export function canonicalEmail(email: string): string {
  const [rawLocal, rawDomain = ''] = email.trim().toLowerCase().split('@');
  let local = rawLocal.split('+')[0];
  let domain = rawDomain;
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}
