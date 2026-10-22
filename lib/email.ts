import { Resend } from 'resend';
import { SITE_URL, SUPPORT_EMAIL } from '@/lib/site';
import { HOME_SPONSORED } from '@/lib/premiumSpots';

export type SubmissionEmailListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  platform: string;
  url: string;
  imageUrl?: string;
};

export type EmailResult = { sent: true; id: string; from: string; to: string } | { sent: false; error: string };

export type EmailAttachment = { filename: string; content: Buffer };

// Sender on our own domain (must be verified in Resend). If Resend rejects it, fall back to
// Resend's shared sender, which can only deliver to the Resend account owner's address.
const FROM = process.env.NOTIFICATION_FROM || 'RankBid <noreply@rankbid.click>';
const FALLBACK_FROM = 'RankBid <onboarding@resend.dev>';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? escapeHtml(url) : '#');

function submissionHtml(listing: SubmissionEmailListing): string {
  const title = escapeHtml(listing.title);
  const description = escapeHtml(listing.description);
  const productUrl = `${SITE_URL}/product/${encodeURIComponent(listing.id)}`;
  return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #0F3460; margin-top: 0;">New Submission Added</h2>

            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-left: 4px solid #0F3460; border-radius: 4px;">
              <p style="margin: 5px 0; font-weight: bold; color: #1F2937;">
                📌 ${title}
              </p>
              <p style="margin: 8px 0; color: #4b5563; font-size: 14px;">
                ${description}
              </p>
              <div style="margin-top: 10px;">
                <span style="display: inline-block; padding: 4px 12px; background-color: #e5e7eb; border-radius: 4px; font-size: 12px; font-weight: bold; color: #1F2937;">
                  📂 ${escapeHtml(listing.category)}
                </span>
                <span style="display: inline-block; padding: 4px 12px; background-color: #e5e7eb; border-radius: 4px; font-size: 12px; font-weight: bold; color: #1F2937;">
                  🔗 ${escapeHtml(listing.platform)}
                </span>
              </div>
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 4px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold;">URL</p>
              <p style="margin: 0; word-break: break-all;">
                <a href="${safeHref(listing.url)}" style="color: #0F3460; text-decoration: none; font-weight: bold;">
                  ${escapeHtml(listing.url)}
                </a>
              </p>
            </div>

            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <a href="${productUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0F3460; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                View on RankBid
              </a>
              <a href="${SITE_URL}/admin" style="display: inline-block; margin-left: 8px; padding: 10px 20px; background-color: #e5e7eb; color: #1F2937; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                Open admin
              </a>
            </div>

            <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
              You're receiving this because you're subscribed to new submission notifications from RankBid
            </p>
          </div>
        </div>
      `;
}

/** Sends one email through Resend, falling back to the shared sender. Never throws. */
async function send(to: string, subject: string, html: string, label: string, attachments?: EmailAttachment[]): Promise<EmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(`RESEND_API_KEY not configured, skipping ${label} email`);
      return { sent: false, error: 'RESEND_API_KEY not configured' };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const message = { to, subject, html, ...(attachments?.length ? { attachments } : {}) };

    // Resend reports failures in `error` instead of throwing.
    let from = FROM;
    let { data, error } = await resend.emails.send({ from, ...message });
    if (error) {
      console.error(`Resend rejected sender ${from}:`, error);
      from = FALLBACK_FROM;
      ({ data, error } = await resend.emails.send({ from, ...message }));
    }
    if (error || !data) {
      console.error(`Failed to send ${label} email:`, error);
      return { sent: false, error: error?.message || 'Unknown Resend error' };
    }

    console.log(`${label} email sent to ${to} from ${from} (resend id ${data.id})`);
    return { sent: true, id: data.id, from, to };
  } catch (error) {
    console.error(`Failed to send ${label} email:`, error);
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Emails the admin about a new submission. Never throws: a failed email must not block the submission. */
export async function sendNewSubmissionEmail(listing: SubmissionEmailListing): Promise<EmailResult> {
  const to = process.env.NOTIFICATION_EMAIL || 'nouman@mindwhiz.com';
  return send(to, `🎉 New Submission: ${listing.title}`, submissionHtml(listing), `New submission (listing ${listing.id})`);
}

/**
 * Tells someone they've been given access to the admin dashboard. `password` is included only when
 * the owner just created their account with it; existing accounts keep their own password.
 */
export async function sendAdminInviteEmail(e: { to: string; name?: string | null; password?: string | null; invitedBy?: string | null }): Promise<EmailResult> {
  const hello = e.name ? `Hi ${escapeHtml(e.name)},` : 'Hi,';
  const by = e.invitedBy ? ` by ${escapeHtml(e.invitedBy)}` : '';
  const credentials = e.password
    ? `<div style="margin: 16px 0; padding: 14px 16px; background-color: #f3f4f6; border-radius: 6px; font-size: 14px;">
         <div><span style="color: #6b7280;">Email:</span> <strong>${escapeHtml(e.to)}</strong></div>
         <div style="margin-top: 6px;"><span style="color: #6b7280;">Password:</span> <strong style="font-family: monospace;">${escapeHtml(e.password)}</strong></div>
       </div>`
    : `<p>Sign in with <strong>${escapeHtml(e.to)}</strong> and ${e.password === null ? 'the password you were given' : 'your RankBid password'}.</p>`;
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #1F2937; font-size: 15px; line-height: 1.5;">
            <h2 style="color: #0F3460; margin-top: 0;">You're now a RankBid admin</h2>
            <p>${hello}</p>
            <p>You've been given access to the RankBid admin dashboard${by}.</p>
            ${credentials}
            <a href="${SITE_URL}/admin" style="display: inline-block; margin-top: 8px; padding: 10px 20px; background-color: #0F3460; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Open the dashboard</a>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              Keep these details private. If you weren't expecting this, you can ignore this email or contact ${SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      `;
  return send(e.to, `You've been given access to the RankBid admin dashboard`, html, 'Admin invite');
}

/** Card layout shared by the sponsored-spot emails. `body` is trusted HTML built from escaped values. */
function premiumHtml(heading: string, body: string, button?: { href: string; label: string }): string {
  const cta = button
    ? `<a href="${button.href}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #0F3460; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">${escapeHtml(button.label)}</a>`
    : '';
  return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #1F2937; font-size: 15px; line-height: 1.5;">
            <h2 style="color: #0F3460; margin-top: 0;">${escapeHtml(heading)}</h2>
            ${body}
            ${cta}
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              Sponsored listings follow the <a href="${SITE_URL}/tos" style="color: #9ca3af;">RankBid Terms</a>. Questions? Email ${SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      `;
}

export type PremiumEmail = { to: string; productTitle: string; listingId: string; position: number; bidUsd: number };

const usd = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;

/**
 * Congratulations and receipt once the webhook has activated a paid bid; `position` is its rank at that moment.
 * `badges` is the badge zip for that rank (lib/server/badges.tsx); without it the email still goes out.
 */
export async function sendPremiumReceipt(e: PremiumEmail & { paidUsd?: number; expiresAt?: string | null; badges?: EmailAttachment }): Promise<EmailResult> {
  const title = escapeHtml(e.productTitle);
  const until = e.expiresAt ? ` until ${new Date(e.expiresAt).toUTCString().slice(5, 16)}` : ' with no end date';
  const badges = e.badges
    ? `<p>Your <strong>#${e.position}</strong> badges are attached (<strong>${escapeHtml(e.badges.filename)}</strong>): light and dark versions, plus a ready-to-paste snippet for your website.</p>`
    : '';
  const body = `
    <p>Congratulations! <strong>${title}</strong> is now sponsored and ranked <strong>#${e.position}</strong> on RankBid.</p>
    ${e.paidUsd != null && e.paidUsd < e.bidUsd
      ? `<p>Payment received: <strong>${usd(e.paidUsd)}</strong>, raising your bid to <strong>${usd(e.bidUsd)}</strong>.</p>`
      : `<p>Payment received: <strong>${usd(e.bidUsd)}</strong>.</p>`}
    ${badges}
    <p>Sponsored listings are ranked by price. Yours stays live${until}; a higher bid can move you down, and we'll email you every time someone outbids you. Payments for active listings are not refundable.</p>`;
  const product = `${SITE_URL}/product/${encodeURIComponent(e.listingId)}`;
  return send(
    e.to,
    `🎉 Congratulations, you're #${e.position} on RankBid`,
    premiumHtml(`You're #${e.position} on RankBid`, body, { href: product, label: 'See your listing' }),
    `Premium receipt (#${e.position})`,
    e.badges ? [e.badges] : undefined,
  );
}

/** Card layout for the vote-submission emails; same card as the sponsored ones, without the sponsor terms. */
function voteHtml(heading: string, body: string, button: { href: string; label: string }): string {
  return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #1F2937; font-size: 15px; line-height: 1.5;">
            <h2 style="color: #0F3460; margin-top: 0;">${escapeHtml(heading)}</h2>
            ${body}
            <a href="${button.href}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #0F3460; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">${escapeHtml(button.label)}</a>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              You're getting this because you submitted this product to RankBid. Questions? Email ${SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      `;
}

const productLink = (listingId: string) => `${SITE_URL}/product/${encodeURIComponent(listingId)}`;
const votes = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'vote' : 'votes'}`;

/**
 * Confirms a free submission to the person who submitted it. `rank` is its position right after submitting;
 * `badges` is the "#N Ranked on RankBid" card zip for it (lib/server/badges.tsx). Without them the email still goes out.
 */
export async function sendSubmissionConfirmation(e: { to: string; listingId: string; productTitle: string; rank?: number; badges?: EmailAttachment }): Promise<EmailResult> {
  const title = escapeHtml(e.productTitle);
  const ranked = e.rank ? ` and ranked <strong>#${e.rank}</strong>` : '';
  const badges = e.badges && e.rank
    ? `<p>Your <strong>#${e.rank}</strong> rank cards are attached (<strong>${escapeHtml(e.badges.filename)}</strong>): light and dark versions to share or put on your website, plus a ready-to-paste snippet.</p>`
    : '';
  const body = `
    <p>Thanks for submitting <strong>${title}</strong>. It's live on RankBid now${ranked}.</p>
    ${badges}
    <p>Rankings are decided by votes: the more votes your product gets, the higher it climbs. Share your product page with your users and followers to start collecting votes.</p>`;
  const subject = e.rank ? `✅ ${e.productTitle} is live on RankBid at #${e.rank}` : `✅ ${e.productTitle} is live on RankBid`;
  return send(e.to, subject, voteHtml('Your submission is live', body, { href: productLink(e.listingId), label: 'View and share your product' }), 'Submission confirmation', e.badges ? [e.badges] : undefined);
}

/** A listing got a new vote (throttled per listing by the caller). */
export async function sendNewVoteEmail(e: { to: string; listingId: string; productTitle: string; totalVotes: number; rank: number }): Promise<EmailResult> {
  const title = escapeHtml(e.productTitle);
  const body = `
    <p><strong>${title}</strong> just got a new vote! It now has <strong>${votes(e.totalVotes)}</strong> and is ranked <strong>#${e.rank}</strong>.</p>
    <p>Keep sharing your product page to climb higher.</p>`;
  return send(e.to, `👍 New vote for ${e.productTitle}: you're #${e.rank}`, voteHtml('You got a new vote', body, { href: productLink(e.listingId), label: 'See your ranking' }), `New vote (#${e.rank})`);
}

/** Another listing passed this one in the rankings. */
export async function sendOvertakenEmail(e: { to: string; listingId: string; productTitle: string; newRank: number; byTitle: string; votesNeeded: number }): Promise<EmailResult> {
  const title = escapeHtml(e.productTitle);
  const body = `
    <p><strong>${escapeHtml(e.byTitle)}</strong> just moved above <strong>${title}</strong>. You're now ranked <strong>#${e.newRank}</strong>.</p>
    <p>Get <strong>${votes(Math.max(1, e.votesNeeded))}</strong> more to take your spot back. Share your product page and ask your users to vote.</p>`;
  return send(e.to, `⚠️ You've been passed: ${e.productTitle} is now #${e.newRank}`, voteHtml('Someone moved above you', body, { href: productLink(e.listingId), label: 'Get more votes' }), `Overtaken (#${e.newRank})`);
}

/** The bid was paid but couldn't be activated (below the minimum). Admin refunds it. */
export async function sendPremiumRefundNotice(e: PremiumEmail & { requiredUsd?: number }): Promise<EmailResult> {
  const title = escapeHtml(e.productTitle);
  const needed = e.requiredUsd ? ` Sponsored listings need at least ${usd(e.requiredUsd)}.` : '';
  const body = `
    <p>Your payment of <strong>${usd(e.bidUsd)}</strong> for <strong>${title}</strong> couldn't be used for a sponsored listing.${needed}</p>
    <p>Your payment will be refunded in full to your card. You can bid again any time.</p>`;
  const raise = `${SITE_URL}/sponsor?listing=${encodeURIComponent(e.listingId)}`;
  return send(e.to, `Your RankBid payment will be refunded`, premiumHtml('Your sponsored listing could not start', body, { href: raise, label: 'Bid again' }), 'Premium refund notice');
}

/** A higher bid moved a holder down (newPosition is its new rank); says whether it also left the homepage top 10. */
export async function sendPremiumOutbidAlert(e: PremiumEmail & { newPosition: number | null }): Promise<EmailResult> {
  const title = escapeHtml(e.productTitle);
  const where = e.newPosition ? `moved from #${e.position} to <strong>#${e.newPosition}</strong>` : `moved down from #${e.position}`;
  const leftHome = e.position <= HOME_SPONSORED && (e.newPosition == null || e.newPosition > HOME_SPONSORED);
  const offHome = e.newPosition != null && e.newPosition > HOME_SPONSORED;
  const status = leftHome
    ? ' and is no longer on the RankBid homepage'
    : offHome ? '' : ', and it is still on the RankBid homepage';
  const next = offHome
    ? `It's still sponsored and listed on <a href="${SITE_URL}/sponsored">the sponsored page</a> for good. Raise your bid to get back into the top 10.`
    : `Raise your bid to take #${e.position} back.`;
  const body = `
    <p>Someone outbid you. <strong>${title}</strong> ${where}${status}.</p>
    <p>${next}</p>`;
  const raise = `${SITE_URL}/sponsor?listing=${encodeURIComponent(e.listingId)}`;
  const subject = e.newPosition ? `You've been outbid: now #${e.newPosition} on RankBid` : `You've been outbid on RankBid`;
  const heading = leftHome ? 'You dropped off the homepage' : 'Someone outbid you';
  return send(e.to, subject, premiumHtml(heading, body, { href: raise, label: 'Raise your bid' }), `Premium outbid alert (#${e.position} → ${e.newPosition ?? '?'})`);
}

/** Password reset link (valid for an hour, single use). */
export async function sendPasswordResetEmail(e: { to: string; name?: string | null; resetUrl: string }): Promise<EmailResult> {
  const hello = e.name ? `Hi ${escapeHtml(e.name)},` : 'Hi,';
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #1F2937; font-size: 15px; line-height: 1.5;">
            <h2 style="color: #0F3460; margin-top: 0;">Reset your RankBid password</h2>
            <p>${hello}</p>
            <p>Someone asked to reset the password for this account. Click the button to choose a new one. The link works once and expires in 1 hour.</p>
            <a href="${e.resetUrl}" style="display: inline-block; margin-top: 8px; padding: 10px 20px; background-color: #0F3460; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Choose a new password</a>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              If you didn't ask for this, ignore this email: your password stays the same. Questions? Email ${SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      `;
  return send(e.to, 'Reset your RankBid password', html, 'Password reset');
}

/** The RankBid team changed this account's email or password. The new password itself is never sent. */
export async function sendAccountUpdatedEmail(e: { to: string; name?: string | null; email: string | null; password: boolean }): Promise<EmailResult> {
  const hello = e.name ? `Hi ${escapeHtml(e.name)},` : 'Hi,';
  const changes = [
    e.email ? `<li>Your sign-in email is now <strong>${escapeHtml(e.email)}</strong>.</li>` : '',
    e.password ? '<li>Your password was changed.</li>' : '',
  ].join('');
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #1F2937; font-size: 15px; line-height: 1.5;">
            <h2 style="color: #0F3460; margin-top: 0;">Your RankBid account was updated</h2>
            <p>${hello}</p>
            <p>The RankBid team updated your account:</p>
            <ul>${changes}</ul>
            <p>You've been signed out on every device. Sign in again with the new details.</p>
            <a href="${SITE_URL}/login" style="display: inline-block; margin-top: 8px; padding: 10px 20px; background-color: #0F3460; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Sign in</a>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              Didn't ask for this? Email ${SUPPORT_EMAIL} right away.
            </p>
          </div>
        </div>
      `;
  return send(e.to, 'Your RankBid account was updated', html, 'Account updated');
}
