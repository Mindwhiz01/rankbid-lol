// Server-only: guest voter emails aren't verified, so make one inbox count as one voter.
import { promises as dns } from 'dns';

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

// Reserved for documentation and testing (RFC 2606 / 6761): never a real inbox.
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org', 'localhost']);
const RESERVED_TLDS = ['.test', '.example', '.invalid', '.localhost', '.local'];

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (DISPOSABLE_DOMAINS.has(domain) || RESERVED_DOMAINS.has(domain)) return true;
  if (RESERVED_TLDS.some(tld => domain.endsWith(tld))) return true;
  for (const d of RESERVED_DOMAINS) if (domain.endsWith(`.${d}`)) return true;
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

/**
 * False when the email's domain can't receive mail: it doesn't exist, has no MX records,
 * or publishes a "null MX" (RFC 7505). Lookup errors and timeouts count as fine, so a DNS
 * hiccup never blocks a real voter.
 */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
    ]);
    if (records === null) return true; // timed out
    return records.some(r => r.exchange && r.exchange !== '.');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return !(code === 'ENOTFOUND' || code === 'ENODATA');
  }
}
