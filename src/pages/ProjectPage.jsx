import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projects, byId } from '../data/projects.js';
import NotFound from './NotFound.jsx';

export default function ProjectPage() {
  const { id } = useParams();
  const p = byId[id];

  useEffect(() => {
    if (p) document.title = `${p.name} · Leon Jr Chua`;
  }, [p]);

  if (!p) return <NotFound />;
  const next = projects[(projects.indexOf(p) + 1) % projects.length];

  return (
    <main id="main" className="project-page">
      <Link className="back-link" to="/#work">← All work</Link>
      <header className="project-head">
        <p className="kicker">{p.category} · {p.kind}</p>
        <h1>{p.name}</h1>
        <p className="lede">{p.hook}</p>
        <div className="card-actions">
          {p.primary && (
            <a className="btn" href={p.primary.href} target="_blank" rel="noopener noreferrer">
              {p.primary.label} <span aria-hidden="true">↗</span>
            </a>
          )}
          <a className={p.primary ? 'btn ghost' : 'btn'} href={p.source} target="_blank" rel="noopener noreferrer">
            View the code <span aria-hidden="true">↗</span>
          </a>
        </div>
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

      <nav className="next-project" aria-label="Next project">
        <Link to="/#work">← All work</Link>
        <Link to={`/work/${next.id}`}>Next: {next.name} →</Link>
      </nav>
    </main>
  );
}
