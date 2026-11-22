// Live settings for the water effect.
// Normal visitors always get DEFAULTS. Opening the site with ?tune on the end of the address
// shows a slider panel that edits these values while the page runs.
// When you're happy, press "Copy settings" in the panel and paste the result over DEFAULTS.

export const DEFAULTS = {
  minWater: 0.5, // the water never thins below this
  linger: 0.018, // how fast dragged colour settles back (lower = lingers longer)
  drag: 1.65, // how far colour travels with the cursor
  strokeWidth: 0.04, // width of the stroke the cursor leaves
  stirLife: 0.912, // how long the cursor's stir keeps moving the water
  cursorLag: 0.13, // lower = the stir point trails further behind the cursor
  trailDark: 0.52, // how much darker the wet trail is
  wetEdges: 13, // how strong the darker wet edges are
  wisps: 0, // swirly tendrils inside the moving water (0 = off)
  swirls: 0.95, // a pair of curls left behind the cursor, like a wake (0 = off)
  sphereStir: 0.05,
  ringTilt: 0.3, // how much we look down onto the ring of cards
  ringLean: 0.18, // the ring's lean: positive = left side up, right side down
  spinDir: 1, // which way the first turn and the fan-out go (1 or -1) // how much spinning the card sphere drags the water around it (0 = off)
  granules: 0.75, // darker pigment specks that appear as dragged colour dries back (0 = off)
  rightBoost: 0.4, // extra pigment on the rose side
  fadeStart: 0.3, // where the fade begins, as a share of the hero height above its bottom edge
  fadeTail: 0.35, // how far the water reaches below the hero, as a share of the gap to "Selected work"
  fadeRagged: 0.03, // how much the fade's end wobbles across the page (0 = a straight line)
  detail: 1, // calculation resolution: higher = smoother edges, more GPU work
  leftMain: '#5fcca6',
  leftLight: '#cfeadf',
  leftDeep: '#23897b',
  rightMain: '#ea7896',
  rightLight: '#f4d6de',
  rightDeep: '#93437c',
};

export const tuneEnabled =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('tune');

const KEY = 'water-tune';

function load() {
  if (!tuneEnabled) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

// One shared object. The water reads it every frame, the panel writes to it.
export const params = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(params));
  } catch {
    /* storage blocked: settings just won't survive a reload */
  }
}

export function reset() {
  Object.assign(params, DEFAULTS);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
