'use client';

import { useState, useRef, type CSSProperties } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { getCategoryLabel } from '@/lib/categories';
import { linkedInShareUrl } from '@/lib/site';

interface StatusCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    title: string;
    description: string;
    category: string;
    platform: string;
    totalVotes?: number;
    rank: number;
  };
  productUrl: string;
}

// The card is exported to PNG with html-to-image (renders through the browser, so text positions match the
// preview). The card keeps inline hex/rgba styles so the image looks identical everywhere; the 3D tilt is
// applied to a wrapper in the preview and switched off while capturing.
const C = {
  navyDeep: '#0B2545',
  navy: '#0F3460',
  navyLight: '#1a5490',
  green: '#059669',
  greenLight: '#34D399',
  gold: '#FBBF24',
  goldDeep: '#F59E0B',
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.14)',
};

const label: CSSProperties = { color: C.muted, fontSize: '11px', fontWeight: 800, letterSpacing: '1.6px' };

export default function StatusCardModal({ isOpen, onClose, product, productUrl }: StatusCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageCopied, setImageCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  const votes = product.totalVotes || 0;
  const ranked = votes > 0 && product.rank > 0;
  const category = getCategoryLabel(product.category);

  const shareText = ranked
    ? `🏆 "${product.title}" is ranked #${product.rank} on RankBid with ${votes} vote${votes === 1 ? '' : 's'}!\n\n📊 ${category}\n\nHelp it climb, vote in 10 seconds (no account needed): ${productUrl}`
    : `🚀 Just launched "${product.title}" on RankBid!\n\n📊 ${category}\n\nBe one of the first to support it, vote in 10 seconds (no account needed): ${productUrl}`;

  // Render the card flat (no tilt) before capturing it.
  const captureCard = async (): Promise<Blob> => {
    if (!cardRef.current) throw new Error('Card not found. Please refresh and try again.');
    setCapturing(true);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const blob = await toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true });
      if (!blob) throw new Error('Failed to create image');
      return blob;
    } finally {
      setCapturing(false);
    }
  };

  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const blob = await captureCard();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rankbid-${product.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Failed to download image:', error);
      alert(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      const blob = await captureCard();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setImageCopied(true);
      setTimeout(() => setImageCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy image:', error);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } catch {}
  };

  const openShare = (url: string) => window.open(url, '_blank', 'width=600,height=520');

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 14, y: px * 18 });
  };

  const flat = capturing || (tilt.x === 0 && tilt.y === 0);

  return (
    <div className="fixed inset-0 bg-[#0B2545]/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F3460] to-[#1a5490] text-white flex items-center justify-center shadow-md">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 3.5h10v5a5 5 0 01-10 0v-5zM4.5 5.5H7v3a3 3 0 01-2.5-3zM17 5.5h2.5a3 3 0 01-2.5 3v-3zM11 14h2v3h3v2.5H8V17h3z" /></svg>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#1F2937]">Share your rank card</h2>
              <p className="text-xs text-[#1F2937]/50">Post it anywhere to collect votes</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1F2937]/40 hover:text-[#1F2937] hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* 3D preview stage */}
          <div
            className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 py-6 sm:py-8 px-2 flex justify-center overflow-hidden"
            style={{ perspective: '1100px' }}
            onMouseMove={onMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
          >
            <div
              style={{
                transform: capturing ? 'none' : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: flat ? 'transform 500ms cubic-bezier(0.22,1,0.36,1)' : 'transform 80ms linear',
                transformStyle: 'preserve-3d',
                borderRadius: '24px',
                boxShadow: capturing ? 'none' : `${-tilt.y * 1.2}px ${18 + tilt.x}px 40px rgba(11,37,69,0.35), 0 4px 10px rgba(11,37,69,0.15)`,
                maxWidth: '100%',
              }}
            >
              {/* ===== Captured card (inline styles only) ===== */}
              <div
                ref={cardRef}
                style={{
                  position: 'relative',
                  width: '400px',
                  maxWidth: '100%',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  padding: '28px',
                  boxSizing: 'border-box',
                  color: C.white,
                  background: `linear-gradient(140deg, ${C.navyDeep} 0%, ${C.navy} 48%, ${C.navyLight} 100%)`,
                  border: `1px solid ${C.faint}`,
                  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
                }}
              >
                {/* Glows */}
                <div style={{ position: 'absolute', top: '-90px', right: '-70px', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.42) 0%, rgba(52,211,153,0) 70%)' }} />
                <div style={{ position: 'absolute', bottom: '-110px', left: '-80px', width: '260px', height: '260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.35) 0%, rgba(96,165,250,0) 70%)' }} />
                {/* Glossy sheen */}
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0) 60%)' }} />

                <div style={{ position: 'relative' }}>
                  {/* Brand */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '34px' }}>
                    <img src="/brand/logo-horizontal-white.png" alt="RankBid" width={119} height={28} style={{ display: 'block', width: '119px', height: '28px' }} />
                  </div>

                  {/* Product name */}
                  <div style={{ ...label, marginBottom: '8px' }}>PRODUCT</div>
                  <div style={{ fontWeight: 900, fontSize: '30px', lineHeight: 1.2, wordBreak: 'break-word', marginBottom: '30px' }}>
                    {product.title}
                  </div>

                  {/* Votes */}
                  <div style={{ borderRadius: '20px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.faint}`, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={label}>VOTES</div>
                      <div style={{ fontWeight: 900, fontSize: '56px', lineHeight: 1.05, marginTop: '6px', color: C.greenLight }}>{votes}</div>
                    </div>
                    <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: `linear-gradient(135deg, ${C.greenLight} 0%, ${C.green} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 26px rgba(5,150,105,0.45)' }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill={C.white}><path d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" /></svg>
                    </div>
                  </div>
                </div>
              </div>
              {/* ===== end captured card ===== */}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleDownloadImage}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0F3460] to-[#1a5490] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0F3460]/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Saving…' : 'Save PNG'}
            </button>
            <button
              onClick={handleCopyImage}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-[#0F3460] text-sm font-black rounded-xl hover:border-[#0F3460]/40 transition-all"
            >
              {imageCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {imageCopied ? 'Copied!' : 'Copy Image'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(shareText)}`)} className="px-3 py-2.5 rounded-xl bg-[#25D366] text-white text-xs sm:text-sm font-black hover:opacity-90 transition">WhatsApp</button>
            <button onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`)} className="px-3 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-black hover:opacity-90 transition">Post to X</button>
            <button onClick={() => openShare(linkedInShareUrl(shareText, productUrl))} className="px-3 py-2.5 rounded-xl bg-[#0A66C2] text-white text-xs sm:text-sm font-black hover:opacity-90 transition">LinkedIn</button>
          </div>

          {/* Suggested text */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1F2937]/45">Suggested post</p>
              <button onClick={handleCopyText} className="text-xs font-black text-[#0F3460] hover:underline">
                {textCopied ? 'Copied!' : 'Copy text'}
              </button>
            </div>
            <p className="text-xs sm:text-sm text-[#1F2937]/75 whitespace-pre-line leading-relaxed">{shareText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
