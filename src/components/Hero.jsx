import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { site, byId, sphereOrder, featured } from '../data/projects.js';
import { useReducedMotion, hasWebGL } from '../hooks.js';
import SafeBoundary from './SafeBoundary.jsx';

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
  const lead = byId[featured];

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

      {/* The featured project, as a normal card: visible straight away, on phones and without 3D. */}
      <article className="featured-card">
        <Link to={`/work/${lead.id}`} className="featured-image" aria-label={`${lead.name}, read how it was made`}>
          <img src={lead.cover} alt={lead.alt} width="1140" height="642" />
        </Link>
        <div className="featured-meta">
          <Link to={`/work/${lead.id}`} className="featured-name">{lead.name}</Link>
          {lead.primary && (
            <a href={lead.primary.href} target="_blank" rel="noopener noreferrer" className="featured-play">
              Play the game <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </article>

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

      {webgl && (
        <p className={`orb-hint${turned ? ' gone' : ''}`} aria-hidden="true">
          turn the orb <span>↺</span>
        </p>
      )}
    </section>
  );
}
