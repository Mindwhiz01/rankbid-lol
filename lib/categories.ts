// Human-readable label for a stored category value.
// Known values map explicitly; anything else is split from CamelCase ("DigitalMarketing" -> "Digital Marketing").
const CATEGORY_LABELS: Record<string, string> = {
  AIMedia: 'AI',
  RealEstate: 'Real Estate',
  ECommerce: 'E-commerce',
  Ecommerce: 'E-commerce',
};

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Other';
  return CATEGORY_LABELS[category] ?? category.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Stored category values offered on the site, in display order.
export const CATEGORIES = ['Marketing', 'SEO', 'Productivity', 'Agents', 'Crypto', 'Developer', 'Health', 'Games', 'Business', 'Ecommerce', 'Travel', 'Directories', 'AIMedia', 'Agencies', 'Social', 'Education', 'People', 'Design', 'Hiring', 'Domains', 'Security', 'Sales', 'News', 'RealEstate', 'Writing', 'Audio', 'Analytics', 'Other'];

// Values found on older listings that the submit form no longer offers. They still get a
// category page so those listings' breadcrumbs resolve, but aren't shown in the category nav.
export const LEGACY_CATEGORIES = ['DigitalMarketing', 'Technology', 'Unlimited'];

/**
 * A category name someone typed under "Other", tidied up ("pet  care" -> "Pet Care"), or null when
 * it can't be one: 2-30 characters, Latin letters and digits (it needs a URL slug) plus & + ' . -
 * A name that matches a built-in category returns that category's stored value instead.
 */
export function cleanCustomCategory(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 30) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 &+'.-]*$/.test(name) || !/[A-Za-z]/.test(name)) return null;
  const slug = categorySlug(name);
  const builtIn = CATEGORIES.find(c => categorySlug(c) === slug);
  if (builtIn) return builtIn;
  if (LEGACY_CATEGORIES.some(c => categorySlug(c) === slug)) return null;
  return name.replace(/(^|\s)([a-z])/g, (_, space, ch) => space + ch.toUpperCase());
}

/** URL slug for a stored category value: "AIMedia" -> "ai", "Ecommerce" -> "e-commerce". */
export function categorySlug(category: string): string {
  return getCategoryLabel(category).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Slugs from earlier labels; the category page redirects them to the current slug.
const OLD_SLUGS: Record<string, string> = { 'ai-media': 'AIMedia' };

/**
 * Stored category value for a slug (or a raw stored value, case-insensitive), or null if unknown.
 * Pass the categories people added under "Other" (lib/server/custom-categories) to resolve those too.
 */
export function categoryFromSlug(slug: string, custom: readonly string[] = []): string | null {
  const s = slug.toLowerCase();
  if (OLD_SLUGS[s]) return OLD_SLUGS[s];
  return [...CATEGORIES, ...LEGACY_CATEGORIES, ...custom].find(c => categorySlug(c) === s || c.toLowerCase() === s) ?? null;
}

/**
 * Category page for a stored value. Built-in and added categories get their own page;
 * anything else falls back to the categories hub instead of a 404.
 */
export function categoryPath(category: string): string {
  return categoryFromSlug(category) || cleanCustomCategory(category) === category
    ? `/categories/${categorySlug(category)}`
    : '/categories';
}
