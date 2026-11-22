import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { site, byId, sphereOrder } from '../data/projects.js';
import { useReducedMotion, hasWebGL } from '../hooks.js';
import SafeBoundary from './SafeBoundary.jsx';
import { params, onTune } from '../tune.js';

// three.js, ShaderGradient and the card sphere load after the text is on screen.
const WaterBackground = lazy(() => import('./WaterBackground.jsx'));
const CardSphere = lazy(() => import('./CardSphere.jsx'));

// Shown instead of the 3D sphere when the browser has no WebGL.
function StaticFan() {
  return (
    <div className="static-fan" aria-hidden="true">
      {sphereOrder.slice(0, 3).map((id, i) => (
        <img key={id} src={byId[id].cover} alt="" style={{ '--i': i - 1 }} />
      ))}
    </div>
  );
}

export default function Hero() {
  const reduced = useReducedMotion();
  const webgl = hasWebGL();
  const [active, setActive] = useState(null);
  const [turned, setTurned] = useState(false);
  // The hint note's style can be switched live from the ?tune panel.
  const [hintStyle, setHintStyle] = useState(params.hintStyle);
  useEffect(() => onTune(() => setHintStyle(params.hintStyle)), []);

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-wash" aria-hidden="true" />
      {webgl && (
        <SafeBoundary>
          <Suspense fallback={null}>
            <WaterBackground reduced={reduced} />
          </Suspense>
        </SafeBoundary>
      )}
      <div className="hero-grid" aria-hidden="true" />

      {webgl ? (
        <SafeBoundary fallback={<StaticFan />}>
          <Suspense fallback={null}>
            <CardSphere reduced={reduced} active={active} onTurn={() => setTurned(true)} />
          </Suspense>
        </SafeBoundary>
      ) : (
        <StaticFan />
      )}

      <div className="hero-copy">
        <h1 id="hero-title">
          {site.name}
          <span className="star" aria-hidden="true">✳</span>
        </h1>
        <p className="fact">{site.fact}</p>
        <p className="pitch">{site.pitch}</p>
        <Link className="btn hero-cta" to="/#work">
          See the work <span aria-hidden="true">↓</span>
        </Link>
      </div>


      {/* Keyboard and screen-reader route into the orb's ring. Focusing a link opens the ring and turns
          that card to the front. */}
      <nav className="sphere-keys" aria-label="Projects in the sphere">
        {sphereOrder.map((id) => (
          <Link
            key={id}
            to={`/work/${id}`}
            onFocus={() => setActive(id)}
            onBlur={() => setActive(null)}
          >
            {byId[id].name}
          </Link>
        ))}
      </nav>

      {webgl && (
        <p className={`orb-hint ${hintStyle >= 2 ? 'tag' : 'ink'}${turned ? ' gone' : ''}`} aria-hidden="true">
          turn the orb <span>↺</span>
        </p>
      )}
    </section>
  );
}
