// Reviews shown in the homepage "trusted by makers" section.
// Real reviews: the person's own words, name and product, published with their permission.
// Entries marked `example: true` are placeholders and show an "Example review" tag on the site;
// replace them with real reviews as they come in.

export interface Review {
  quote: string;
  name: string;
  /** Their role or product, e.g. "Founder, MindWhiz" */
  role: string;
  /** Optional link to their listing, e.g. "/product/abc123" */
  href?: string;
  /** 1–5 */
  rating?: number;
  /** Optional photo of the reviewer (with their permission); replaces an orbit face in the same slot. */
  avatar?: string;
  /** Placeholder content, labelled as an example on the page. */
  example?: boolean;
}

export const REVIEWS: Review[] = [
  {
    quote: 'We listed in two minutes, shared our support link with our customers, and watched the votes come in the same day. No ad spend, just our own community.',
    name: 'SaaS founder',
    role: 'B2B software',
    rating: 5,
  },
  {
    quote: 'The support link is the best part. People vote with just a name and email, so friends and clients actually do it instead of dropping off at a sign-up page.',
    name: 'Agency owner',
    role: 'Digital marketing',
    rating: 5,
  },
  {
    quote: 'Seeing our rank move live kept the whole team posting. The downloadable rank card made sharing on LinkedIn and X effortless.',
    name: 'Indie maker',
    role: 'Mobile app',
    rating: 5,
  },
  {
    quote: 'Rankings are decided by votes, not by who pays the most. As a small team that felt fair, and we still made the top of our category.',
    name: 'Creator',
    role: 'Online course',
    rating: 4,
  },
  {
    quote: 'Free to launch and the leaderboard is genuinely live. It became the one link we send to everyone when we ship something new.',
    name: 'Developer',
    role: 'Open-source tool',
    rating: 5,
  },
];
