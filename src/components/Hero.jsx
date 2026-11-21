import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { site, byId, sphereOrder } from '../data/projects.js';
import { useReducedMotion, hasWebGL } from '../hooks.js';

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

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-wash" aria-hidden="true" />
      {webgl && (
        <Suspense fallback={null}>
          <WaterBackground reduced={reduced} />
        </Suspense>
      )}
      <div className="hero-grid" aria-hidden="true" />

      {webgl ? (
        <Suspense fallback={null}>
          <CardSphere reduced={reduced} active={active} />
        </Suspense>
      ) : (
        <StaticFan />
      )}

      <div className="hero-copy">
        <h1 id="hero-title">
          {site.name}
          <span className="star" aria-hidden="true">✳</span>
        </h1>
        <p className="pitch">{site.pitch}</p>
        <p className="fact">{site.fact}</p>
      </div>

      {/* Keyboard and screen-reader route into the sphere. Focusing a link brings its card forward. */}
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

      <Link className="hero-cue" to="/#work">
        six projects below <span aria-hidden="true">↓</span>
      </Link>
    </section>
  );
}
