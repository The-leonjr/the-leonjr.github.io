import { useState } from 'react';
import { DEFAULTS, params, save, reset, tuneEnabled } from '../tune.js';

// Slider panel for tuning the water. Only shows when the address ends in ?tune.
const SLIDERS = [
  ['Stroke', [
    ['strokeWidth', 'Stroke width', 0.02, 0.3, 0.005],
    ['drag', 'Drag strength', 0, 3, 0.05],
    ['cursorLag', 'Cursor lag (low = more lag)', 0.02, 0.6, 0.01],
    ['stirLife', 'Stir keeps moving', 0.85, 0.995, 0.001],
    ['linger', 'Settle speed (low = lingers)', 0.001, 0.06, 0.001],
  ]],
  ['Look', [
    ['minWater', 'Always-on water', 0, 0.5, 0.01],
    ['trailDark', 'Trail darkness', 0, 0.8, 0.01],
    ['wetEdges', 'Wet edges', 0, 30, 0.5],
    ['rightBoost', 'Rose side boost', 0, 0.4, 0.01],
    ['bottomFade', 'Bottom fade', 0, 0.4, 0.01],
  ]],
  ['Extras (start at 0)', [
    ['wisps', 'Wisps', 0, 3, 0.05],
    ['swirls', 'Swirls', 0, 2, 0.05],
  ]],
  ['Quality', [
    ['detail', 'Detail (higher = smoother, heavier)', 0.25, 1, 0.05],
  ]],
];

const COLOURS = [
  ['leftMain', 'Left main'],
  ['leftLight', 'Left light'],
  ['leftDeep', 'Left deep'],
  ['rightMain', 'Right main'],
  ['rightLight', 'Right light'],
  ['rightDeep', 'Right deep'],
];

const decimals = (step) => Math.max(0, -Math.floor(Math.log10(step)));

export default function TunePanel() {
  const [, redraw] = useState(0);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  if (!tuneEnabled) return null;

  const set = (key, value) => {
    params[key] = value;
    save();
    redraw((n) => n + 1);
  };

  const copy = async () => {
    const text = `export const DEFAULTS = ${JSON.stringify(params, null, 2)};`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy these settings:', text);
    }
  };

  if (!open) {
    return (
      <button type="button" className="tune-toggle" onClick={() => setOpen(true)}>
        Tune water
      </button>
    );
  }

  return (
    <aside className="tune-panel" aria-label="Water tuning">
      <header>
        <strong>Water tuning</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide panel">Hide</button>
      </header>
      {SLIDERS.map(([group, rows]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {rows.map(([key, label, min, max, step]) => (
            <label key={key} className="tune-row">
              <span>
                {label}
                <output>{Number(params[key]).toFixed(decimals(step))}</output>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={params[key]}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>Colours</legend>
        <div className="tune-colours">
          {COLOURS.map(([key, label]) => (
            <label key={key}>
              <input type="color" value={params[key]} onChange={(e) => set(key, e.target.value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="tune-actions">
        <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy settings'}</button>
        <button
          type="button"
          onClick={() => {
            reset();
            redraw((n) => n + 1);
          }}
        >
          Reset
        </button>
      </div>
      <p className="tune-note">
        Settings save in this browser. When it feels right, press Copy settings and send them over
        (or paste them over DEFAULTS in src/tune.js). Changed from default:{' '}
        {Object.keys(DEFAULTS).filter((k) => params[k] !== DEFAULTS[k]).join(', ') || 'nothing yet'}.
      </p>
    </aside>
  );
}
