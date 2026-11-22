import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { toolkit } from '../data/projects.js';
import { hasWebGL } from '../hooks.js';
import SafeBoundary from './SafeBoundary.jsx';

const AsciiOrb = lazy(() => import('./AsciiOrb.jsx'));

export default function About() {
  return (
    <section id="about" className="about section" aria-labelledby="about-title">
      <div className="about-text">
        <h2 id="about-title">Hi, I'm Leon Jr.</h2>
        <p>
          I'm studying Applied AI at Temasek Polytechnic in Singapore. I like making things people can try for themselves.
          Most of my projects start with a small, slightly silly question, like whether
          {' '}<Link to="/work/analysets">a phone tap can run my stock watchlist for me</Link>.
        </p>
        <dl className="toolkit">
          {toolkit.map(([area, tools]) => (
            <div key={area}>
              <dt>{area}</dt>
              <dd>{tools}</dd>
            </div>
          ))}
        </dl>
      </div>
      {hasWebGL() && (
        <SafeBoundary>
          <Suspense fallback={null}>
            <div className="ascii-frame">
              <AsciiOrb label="The orb from the homepage, drawn in text characters" />
            </div>
          </Suspense>
        </SafeBoundary>
      )}
    </section>
  );
}
