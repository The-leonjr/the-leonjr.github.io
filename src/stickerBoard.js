// The three contact stickers live on one big "sketchbook page": the About section plus the
// footer on the homepage, or just the footer on project pages. This file places them and lets a
// mouse drag them anywhere on that page.
//
// It's plain DOM code (no React state) because positions change on every mouse move, and
// re-rendering React that often would be wasteful.

const DRAG_START = 7; // pixels the mouse must move before a press becomes a drag
const EDGE = 80; // pointer this close to the top or bottom of the window scrolls the page while dragging
const EDGE_SPEED = 16; // fastest edge scroll, in pixels per frame
// Writing a sticker may not be dropped on. Dropping it there sends it back to its last free spot.
const NO_DROP = '#about-title, .about-text p, .toolkit, .hackathons, .finale h2 span, .finale-sub, .availability, .finale-contact, .finale-base';

export function setUpStickerBoard(footer, layer) {
  const stickers = [...layer.querySelectorAll('.sticker')];
  const moved = new Set(); // stickers someone dragged; the others re-place themselves when the layout changes

  // ----- Positions are in pixels from the layer's top-left corner -----
  const origin = () => layer.getBoundingClientRect();
  const rectOf = (el) => {
    const o = origin();
    const r = el.getBoundingClientRect();
    return { left: r.left - o.left, top: r.top - o.top, right: r.right - o.left, bottom: r.bottom - o.top, width: r.width, height: r.height };
  };
  const size = () => stickers[0].offsetWidth;
  const keepInside = (x, y) => ({
    x: Math.min(Math.max(x, 0), layer.clientWidth - size()),
    y: Math.min(Math.max(y, 0), layer.clientHeight - size()),
  });
  const setSpot = (sticker, { x, y }) => {
    sticker.style.left = `${x}px`;
    sticker.style.top = `${y}px`;
  };
  const spotOf = (sticker) => ({ x: sticker.offsetLeft, y: sticker.offsetTop });

  // Would a sticker at this spot cover writing? Its outer edge doesn't count, so the white rim and the
  // see-through corners may overlap text a little, like a real sticker stuck next to a note.
  function coversText({ x, y }) {
    const s = size();
    const pad = s * 0.1;
    const box = { left: x + pad, top: y + pad, right: x + s - pad, bottom: y + s - pad };
    return [...document.querySelectorAll(NO_DROP)].some((el) => {
      const r = rectOf(el);
      return box.left < r.right && box.right > r.left && box.top < r.bottom && box.bottom > r.top;
    });
  }

  // ----- Starting spots -----
  // The layer reaches up to the top of About (if this page has one), then each sticker tries
  // its favourite spots in order and takes the first one that doesn't cover writing.
  function layout() {
    const about = document.getElementById('about');
    const reach = about ? footer.getBoundingClientRect().top - about.getBoundingClientRect().top : 0;
    footer.style.setProperty('--reach', `${Math.max(0, reach)}px`);

    const s = size();
    const orbEl = about && about.querySelector('.ascii-frame');
    const orb = orbEl && rectOf(orbEl);
    const lines = [...footer.querySelectorAll('.finale h2 span')].map(rectOf);
    const head = { right: Math.max(...lines.map((r) => r.right)), top: lines[0].top, bottom: lines[lines.length - 1].bottom };
    const stage = rectOf(footer.querySelector('.sticker-stage'));
    const sub = rectOf(footer.querySelector('.finale-sub'));

    // Each sticker's first choice is the layout Leon picked by dragging (a desktop screenshot);
    // the later ones are fallbacks for narrower screens where that spot would cover writing.
    const favourites = {
      // above the orb's top-left edge, then off the orb's top right, then the top left of LEON JR.
      linkedin: [
        orb && { x: orb.left - s * 0.54, y: orb.top - s * 0.5 },
        orb && { x: orb.right - s * 0.5, y: orb.top - s * 0.05 },
        { x: stage.left, y: stage.top },
      ],
      // just after the end of the joke, then beside the internship line, then just above the
      // joke on the right (phones), then the top right of LEON JR.
      email: [
        { x: head.right + s * 0.3, y: head.bottom - s * 0.4 },
        { x: sub.right + s * 0.25, y: sub.top - s * 0.1 },
        { x: stage.right - s, y: head.top - s * 0.95 },
        { x: stage.left + stage.width * 0.79, y: stage.top + stage.height * 0.1 },
      ],
      // off the orb's bottom-left edge, beside the skills, then low across LEON JR.
      github: [
        orb && { x: orb.left - s * 0.52, y: orb.bottom - s * 0.46 },
        { x: stage.left + stage.width * 0.55, y: stage.bottom - s },
      ],
    };

    for (const sticker of stickers) {
      if (moved.has(sticker)) {
        const { x, y } = spotOf(sticker);
        setSpot(sticker, keepInside(x, y));
        continue;
      }
      const options = favourites[sticker.dataset.id].filter(Boolean).map(({ x, y }) => keepInside(x, y));
      setSpot(sticker, options.find((spot) => !coversText(spot)) || options[options.length - 1]);
    }
    layer.classList.add('is-ready');
  }

  // ----- Dragging (mouse only, so touch screens still scroll normally) -----
  let drag = null; // { sticker, pointer id, where the press started, where the pointer is now, ... }
  let justDragged = null; // a sticker that was just dropped, so its click must not open the link
  let topLayer = 0; // the last sticker you moved goes on top
  let frame = 0;

  // Put the dragged sticker under the pointer, kept inside the page.
  function follow() {
    const o = origin();
    const spot = keepInside(drag.pointerX - o.left - drag.grabX, drag.pointerY - o.top - drag.grabY);
    setSpot(drag.sticker, spot);
    const onText = coversText(spot);
    drag.sticker.classList.toggle('is-blocked', onText); // fades a little to warn you
    if (!onText) drag.lastFree = spot;
  }

  // Near the top or bottom of the window, scroll the page so the rest of it is reachable.
  function edgeScroll() {
    const y = drag.pointerY;
    const h = window.innerHeight;
    const push = y < EDGE ? y - EDGE : y > h - EDGE ? y - (h - EDGE) : 0;
    if (push) {
      window.scrollBy({ top: (push / EDGE) * EDGE_SPEED, behavior: 'instant' });
      follow();
    }
    frame = requestAnimationFrame(edgeScroll);
  }

  const down = (e) => {
    const sticker = e.target.closest('.sticker');
    if (!sticker || e.button !== 0 || e.pointerType !== 'mouse') return;
    justDragged = null;
    const r = sticker.getBoundingClientRect();
    drag = {
      sticker, id: e.pointerId, moved: false,
      startX: e.clientX, startY: e.clientY, pointerX: e.clientX, pointerY: e.clientY,
      grabX: e.clientX - r.left, grabY: e.clientY - r.top, // where on the sticker you grabbed it
      lastFree: spotOf(sticker),
    };
  };

  const move = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag.pointerX = e.clientX;
    drag.pointerY = e.clientY;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_START) return;
      drag.moved = true;
      moved.add(drag.sticker);
      drag.sticker.setPointerCapture(e.pointerId);
      drag.sticker.classList.add('is-dragging');
      drag.sticker.style.zIndex = ++topLayer;
      document.documentElement.classList.add('dragging-sticker'); // stops text getting selected
      frame = requestAnimationFrame(edgeScroll);
    }
    follow();
  };

  const up = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    cancelAnimationFrame(frame);
    if (drag.moved) {
      const { sticker } = drag;
      sticker.classList.remove('is-dragging', 'is-blocked');
      document.documentElement.classList.remove('dragging-sticker');
      if (coversText(spotOf(sticker))) {
        // Dropped on writing: glide back to the last free spot it passed through.
        sticker.classList.add('is-snapping');
        setSpot(sticker, drag.lastFree);
        setTimeout(() => sticker.classList.remove('is-snapping'), 320);
      }
      justDragged = sticker;
    }
    drag = null;
  };

  // Runs before the link's own click, so a finished drag can cancel the navigation.
  const click = (e) => {
    if (justDragged && e.target.closest('.sticker') === justDragged) e.preventDefault();
    justDragged = null;
  };

  // Re-place stickers whenever the page's shape changes (resizing, the orb loading in, fonts arriving).
  let pending = 0;
  const relayout = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(layout);
  };
  const watcher = new ResizeObserver(relayout);
  watcher.observe(footer);
  const about = document.getElementById('about');
  if (about) watcher.observe(about);
  document.fonts?.ready.then(relayout);
  layout();

  layer.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  layer.addEventListener('click', click, true);
  return () => {
    watcher.disconnect();
    cancelAnimationFrame(pending);
    cancelAnimationFrame(frame);
    document.documentElement.classList.remove('dragging-sticker');
    layer.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    layer.removeEventListener('click', click, true);
  };
}
