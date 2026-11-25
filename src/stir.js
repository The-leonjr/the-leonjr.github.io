// A small shared note between the card sphere and the water behind it.
// The sphere writes where it is on screen and how fast it is spinning; the water reads it each
// frame and lets the spin drag the water around it.
export const sphereStir = {
  x: 0, // centre on screen, in CSS pixels
  y: 0,
  radius: 0, // in CSS pixels
  dx: 0, // how far the sphere's surface moved this frame, in CSS pixels
  dy: 0,
  live: false, // false when the sphere isn't on screen
};

// The play panel's "Make a mess" button bumps this number; the water notices the change on its
// next frame and drops a handful of big swirls into itself.
export const waterPokes = {
  splashes: 0,
};
