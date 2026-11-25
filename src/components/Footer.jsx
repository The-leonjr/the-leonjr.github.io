import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { site } from '../data/projects.js';
import { setUpStickerBoard } from '../stickerBoard.js';

// The site's ending, on every page: like the back cover of a sketchbook, signed with a big felt
// "LEON JR.". Three stickers are real links (LinkedIn, GitHub, Email). On the homepage they spread
// up over the About section too, and with a mouse you can peel one off and stick it anywhere
// (see stickerBoard.js). A drag never opens the link.

const STICKERS = [
  { id: 'linkedin', label: 'LinkedIn (opens in a new tab)', href: site.linkedin, external: true },
  { id: 'github', label: 'GitHub (opens in a new tab)', href: site.github, external: true },
  { id: 'email', label: `Email ${site.short}`, href: `mailto:${site.email}` },
];

// An SVG filter that turns flat burgundy type into cut felt: fuzzy fibre edges, a nubbly
// surface lit from the top left, and a soft shadow because felt sits slightly raised.
function FeltFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter id="felt" x="-4%" y="-8%" width="108%" height="120%" colorInterpolationFilters="sRGB">
        {/* 1. fuzzy edges: nudge the outline about with very fine noise */}
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="fuzz" />
        <feDisplacementMap in="SourceGraphic" in2="fuzz" scale="6" xChannelSelector="R" yChannelSelector="G" result="shape" />
        {/* 2. fibres: stretched noise, lit like a bumpy surface, kept only inside the letters */}
        <feTurbulence type="fractalNoise" baseFrequency="0.55 0.9" numOctaves="3" seed="11" result="fibres" />
        <feDiffuseLighting in="fibres" surfaceScale="2.2" lightingColor="#ffffff" result="lit">
          <feDistantLight azimuth="225" elevation="58" />
        </feDiffuseLighting>
        <feComposite in="lit" in2="shape" operator="in" result="litShape" />
        <feBlend in="litShape" in2="shape" mode="multiply" result="felt" />
        {/* 3. a soft shadow underneath */}
        <feGaussianBlur in="shape" stdDeviation="3" result="blur" />
        <feOffset in="blur" dx="2" dy="4" result="drop" />
        <feColorMatrix in="drop" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 0 0.12  0 0 0 0.35 0" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="felt" />
        </feMerge>
      </filter>
    </svg>
  );
}

export default function Footer() {
  const footer = useRef();
  const layer = useRef();
  const { pathname } = useLocation();
  // Set the stickers up again on every page, because the homepage has an About section to spread over.
  useEffect(() => setUpStickerBoard(footer.current, layer.current), [pathname]);

  const [copyStatus, setCopyStatus] = useState('');
  const resetCopy = useRef();
  useEffect(() => () => clearTimeout(resetCopy.current), []);
  const copy = async () => {
    clearTimeout(resetCopy.current);
    try {
      await navigator.clipboard.writeText(site.email);
      setCopyStatus('Email copied');
      resetCopy.current = setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      setCopyStatus(site.email);
    }
  };

  return (
    <footer id="contact" className="finale" ref={footer} aria-labelledby="finale-title">
      <FeltFilter />
      <div className="finale-inner">
        <h2 id="finale-title">
          <span>You scrolled all the way down.</span> <span>That's basically an interview.</span>
        </h2>
        <p className="finale-sub">If you're hiring an AI or software intern, let's talk.</p>
        {site.availability && <p className="availability">{site.availability}</p>}
        {/* Plain links right under the joke, so all three are on screen after the Contact jump
            even when the stickers have been spread up the page. */}
        <p className="finale-contact">
          <a className="text-link" href={`mailto:${site.email}`}>Email</a>
          <span className="sep" aria-hidden="true">·</span>
          <a className="text-link" href={site.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)">LinkedIn</a>
          <span className="sep" aria-hidden="true">·</span>
          <a className="text-link" href={site.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)">GitHub</a>
          <span className="sep" aria-hidden="true">·</span>
          <button type="button" className="text-link" onClick={copy}>Copy email</button>
          <span className="copy-status" role="status">{copyStatus}</span>
        </p>

        <div className="sticker-stage">
          <div className="felt-wordmark" aria-hidden="true">LEON JR.</div>
        </div>

        {/* The sticker layer covers this footer and, on the homepage, the About section above it. */}
        <nav className="sticker-layer" ref={layer} aria-label={`Contact ${site.short}`}>
          {STICKERS.map((s) => (
            <a
              key={s.id}
              data-id={s.id}
              className={`sticker sticker--${s.id}`}
              href={s.href}
              aria-label={s.label}
              draggable="false"
              {...(s.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            />
          ))}
        </nav>

        <div className="finale-base">
          <p className="sticker-hint">
            <span className="hint-mouse">Click a sticker to open it, or drag it somewhere else.</span>
            <span className="hint-touch">Tap a sticker to get in touch.</span>
          </p>
          <div className="finale-utils">
            {site.resume && (
              <a className="text-link" href={site.resume} target="_blank" rel="noopener noreferrer">Résumé</a>
            )}
            <a className="text-link" href="#main" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              Back to top ↑
            </a>
          </div>
          <span className="finale-copy">© 2026 {site.name}</span>
        </div>
      </div>
    </footer>
  );
}
