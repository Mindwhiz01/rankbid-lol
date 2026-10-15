import { ImageResponse } from 'next/og';
import { SITE_TAGLINE } from '@/lib/seo';
import { LOGO_WHITE_RATIO, logoWhiteDataUrl } from '@/lib/server/brand-logo';

export const alt = `RankBid: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logo = await logoWhiteDataUrl();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: 72, color: 'white', background: 'linear-gradient(135deg, #0B2545 0%, #0F3460 55%, #1a5490 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={logo} alt="RankBid" width={Math.round(76 * LOGO_WHITE_RATIO)} height={76} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>Ranked by people.</div>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, color: '#6EE7B7' }}>Not algorithms.</div>
        </div>
        <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.75)' }}>Free product launches · Live community votes · rankbid.click</div>
      </div>
    ),
    size,
  );
}
