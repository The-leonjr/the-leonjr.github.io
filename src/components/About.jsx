import { lazy, Suspense } from 'react';
import { toolkit } from '../data/projects.js';
import { hasWebGL } from '../hooks.js';

const AsciiKnot = lazy(() => import('./AsciiKnot.jsx'));

export default function About() {
  return (
    <section id="about" className="about section" aria-labelledby="about-title">
      <div className="ascii-frame">
        {hasWebGL() ? (
          <Suspense fallback={null}>
            <AsciiKnot label="The knot from the homepage, drawn in text characters" />
          </Suspense>
        ) : null}
        <span className="hand ascii-note">the same knot, in text</span>
      </div>
      <div className="about-text">
        <p className="kicker">About</p>
        <h2 id="about-title">Hi, I'm Leon Jr.</h2>
        <p>
          I'm studying Applied AI at Temasek Polytechnic in Singapore. So far I've built web and mobile apps,
          a machine learning model, an automation robot and a game for a game jam.
        </p>
        <p>
          I like making things people can try for themselves. Most of my projects start with a small,
          slightly silly question, like whether a phone tap can run my stock watchlist for me.
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
    </section>
  );
}
