import { useEffect, useRef, useState } from 'react';
import { DEFAULTS, params } from '../tune.js';
import { waterPokes } from '../stir.js';

// "Play with the water": a small panel in the corner of the hero for visitors.
// It changes the same live settings the water and the orb read every frame (src/tune.js), but
// only for this visit: nothing is saved, so a reload (or Reset) puts everything back.

const PALETTES = [
  { name: 'Mint and rose', left: ['#5fcca6', '#cfeadf', '#23897b'], right: ['#ea7896', '#f4d6de', '#93437c'] },
  { name: 'Apricot and plum', left: ['#f2a65e', '#f8dcc0', '#c06a2e'], right: ['#9a6fc0', '#e3d6ef', '#5b3a7e'] },
  { name: 'Lemon and berry', left: ['#e3c84f', '#f4ecc0', '#a58a1e'], right: ['#d0477a', '#f3cddb', '#7f1f4a'] },
  { name: 'Sage and lilac', left: ['#9cbf7a', '#e1ecd3', '#5f8a3e'], right: ['#b58bd6', '#ebdff5', '#6f4a94'] },
];

// Every setting this panel can touch, so Reset knows what to put back.
const TOUCHED = ['leftMain', 'leftLight', 'leftDeep', 'rightMain', 'rightLight', 'rightDeep', 'swirls', 'restSpin', 'cardOrbit'];

function applyPalette(p) {
  [params.leftMain, params.leftLight, params.leftDeep] = p.left;
  [params.rightMain, params.rightLight, params.rightDeep] = p.right;
}

export default function PlayPanel({ reduced }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(0);
  const [swirl, setSwirl] = useState(DEFAULTS.swirls);
  const [spin, setSpin] = useState(1); // 1 = normal orb speed
  const toggle = useRef();

  // Escape closes the panel and puts focus back on its button.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pickPalette = (i) => {
    setPalette(i);
    applyPalette(PALETTES[i]);
  };
  const changeSwirl = (v) => {
    setSwirl(v);
    params.swirls = v;
  };
  const changeSpin = (v) => {
    setSpin(v);
    params.restSpin = DEFAULTS.restSpin * v;
    params.cardOrbit = DEFAULTS.cardOrbit * v;
  };
  const reset = () => {
    TOUCHED.forEach((k) => (params[k] = DEFAULTS[k]));
    setPalette(0);
    setSwirl(DEFAULTS.swirls);
    setSpin(1);
  };

  return (
    <div className="play">
      {open && (
        <div className="play-panel" id="play-panel" role="group" aria-label="Play with the water">
          <p className="play-label" id="play-colours">Colours</p>
          <div className="play-swatches" role="group" aria-labelledby="play-colours">
            {PALETTES.map((p, i) => (
              <button
                key={p.name}
                type="button"
                className="play-swatch"
                aria-pressed={palette === i}
                aria-label={p.name}
                title={p.name}
                onClick={() => pickPalette(i)}
                style={{ '--a': p.left[0], '--b': p.right[0] }}
              />
            ))}
          </div>

          <label className="play-label" htmlFor="play-swirl">Swirl</label>
          <input id="play-swirl" type="range" min="0" max="3" step="0.05" value={swirl} onChange={(e) => changeSwirl(Number(e.target.value))} />

          <label className="play-label" htmlFor="play-spin">Orb spin</label>
          <input id="play-spin" type="range" min="0" max="4" step="0.1" value={spin} onChange={(e) => changeSpin(Number(e.target.value))} />

          <div className="play-actions">
            {!reduced && (
              <button type="button" className="btn" onClick={() => (waterPokes.splashes += 1)}>
                Make a mess
              </button>
            )}
            <button type="button" className="text-link" onClick={reset}>Reset</button>
          </div>
        </div>
      )}
      <button
        ref={toggle}
        type="button"
        className="btn ghost play-toggle"
        aria-expanded={open}
        aria-controls="play-panel"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Done' : 'Play with the water'}
      </button>
    </div>
  );
}
