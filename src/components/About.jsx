import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { toolkit, hackathons } from '../data/projects.js';
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
      {/* Below the text only (not under the orb), so the orb and the stickers around it stay put. */}
      <section className="hackathons" aria-labelledby="hackathons-title">
        <h3 id="hackathons-title">Hackathons</h3>
        <ol>
          {hackathons.map((h) => (
            <li key={h.event}>
              <span className="hack-date">{h.date}</span>
              <div>
                <p className="hack-name">
                  {h.event} <span className="hack-by">{h.by}</span>
                </p>
                {h.result && <p className="hack-result">{h.result}</p>}
                <p className="hack-line">
                  {h.line}{' '}
                  {h.link.to ? (
                    <Link to={h.link.to}>{h.link.label}</Link>
                  ) : (
                    <a href={h.link.href} target="_blank" rel="noopener noreferrer">{h.link.label} ↗</a>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
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
