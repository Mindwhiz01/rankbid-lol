// Push every URL in the live sitemap to IndexNow (Bing, Yandex, Seznam, Naver). Bing's index
// feeds ChatGPT Search, Copilot and DuckDuckGo, so this gets new pages seen without waiting for a crawl.
// The key is verified against <SITE_URL>/<KEY>.txt (public/<KEY>.txt).
// Usage: npm run indexnow   (after a deploy, a launch, or a batch of new listings)
// Set NEXT_PUBLIC_SITE_URL to push a different domain.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rankbid.click').replace(/\/+$/, '');
const KEY = '47be621a69687f58d1d60979fb074dbc';

const xml = await (await fetch(`${SITE_URL}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE_URL).host, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});

console.log(`IndexNow: submitted ${urls.length} URLs -> ${res.status} ${res.statusText}`);
if (!res.ok) process.exit(1);
