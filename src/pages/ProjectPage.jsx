import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projects, byId } from '../data/projects.js';
import NotFound from './NotFound.jsx';

// Evidence that the project works: a clip, a before-and-after pair, or a few steps in a row.
// Only shown for projects that have `media` in src/data/projects.js.
function Evidence({ media }) {
  return (
    <section className="evidence" aria-labelledby="evidence-title">
      <h2 id="evidence-title">See it working</h2>
      {media.map((m, i) => {
        if (m.kind === 'video') {
          return (
            <figure key={i}>
              <video src={m.src} poster={m.poster} controls muted playsInline loop preload="metadata" />
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          );
        }
        if (m.kind === 'pair') {
          return (
            <div key={i} className="evidence-pair">
              <figure>
                <img src={m.before.src} alt={m.before.alt || ''} loading="lazy" />
                <figcaption>{m.before.caption}</figcaption>
              </figure>
              <span className="arrow" aria-hidden="true">→</span>
              <figure>
                <img src={m.after.src} alt={m.after.alt || ''} loading="lazy" />
                <figcaption>{m.after.caption}</figcaption>
              </figure>
            </div>
          );
        }
        if (m.kind === 'steps') {
          return (
            <div key={i} className="evidence-steps">
              {m.steps.map((step) => (
                <figure key={step.src}>
                  <img src={step.src} alt={step.alt || ''} loading="lazy" />
                  <figcaption>{step.caption}</figcaption>
                </figure>
              ))}
            </div>
          );
        }
        return null;
      })}
    </section>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const p = byId[id];

  useEffect(() => {
    if (p) document.title = `${p.name} · Leon Jr Chua`;
  }, [p]);

  if (!p) return <NotFound />;
  const index = projects.indexOf(p);
  const prev = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];

  // The same actions as the project's card on the homepage.
  const actions = (
    <>
      {p.primary && (
        <a className="btn" href={p.primary.href} target="_blank" rel="noopener noreferrer">
          {p.primary.label} <span aria-hidden="true">↗</span>
        </a>
      )}
      <a className={p.primary ? 'text-link' : 'btn'} href={p.source} target="_blank" rel="noopener noreferrer">
        {p.primary ? 'Source' : 'View the code'} <span aria-hidden="true">↗</span>
      </a>
    </>
  );

  return (
    <main id="main" className="project-page">
      <Link className="back-link" to="/#work">← All work</Link>
      <header className="project-head">
        <p className="kicker">{p.category} · {p.kind}</p>
        <h1>{p.name}</h1>
        <p className="lede">{p.hook}</p>
        <div className="card-actions">{actions}</div>
      </header>

      <img className="project-cover" src={p.cover} alt={p.alt} width="1140" height="642" />

      <div className="project-body">
        <aside className="project-side">
          <h2 className="side-title">Built with</h2>
          <ul className="chips">
            {p.tech.map((t) => <li key={t}>{t}</li>)}
          </ul>
          {p.credits && (
            <>
              <h2 className="side-title">Credits</h2>
              <p>{p.credits}</p>
            </>
          )}
          <h2 className="side-title">Links</h2>
          <div className="side-links">{actions}</div>
        </aside>
        <div className="project-story">
          {p.role && (
            <section>
              <h2>What I did</h2>
              <p>{p.role}</p>
            </section>
          )}
          {p.sections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </section>
          ))}
          {p.result && (
            <section>
              <h2>Result</h2>
              <p>{p.result}</p>
            </section>
          )}
        </div>
      </div>

      {p.media?.length > 0 && <Evidence media={p.media} />}

      {p.images.length > 0 && (
        <div className={`project-gallery${p.portrait ? ' portrait' : ''}`}>
          {p.images.map((img) => (
            <figure key={img.src}>
              <img src={img.src} alt="" loading="lazy" />
              <figcaption>{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <nav className="next-project" aria-label="More projects">
        <Link className="prev" to={`/work/${prev.id}`}>← {prev.name}</Link>
        <Link className="all" to="/#work">All work</Link>
        <Link className="next" to={`/work/${next.id}`}>{next.name} →</Link>
      </nav>
    </main>
  );
}
