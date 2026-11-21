import { Link } from 'react-router-dom';
import { groups, byId } from '../data/projects.js';

function ProjectCard({ p }) {
  return (
    <article className="project-card">
      <img src={p.cover} alt={p.alt} loading="lazy" width="1140" height="642" />
      <div className="project-card-body">
        <p className="meta">{p.category}</p>
        <h4>
          <Link className="card-link" to={`/work/${p.id}`}>{p.name}</Link>
        </h4>
        <p className="hook">{p.hook}</p>
        <div className="card-actions">
          {p.primary ? (
            <a className="btn" href={p.primary.href} target="_blank" rel="noopener noreferrer">
              {p.primary.label} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="read-more" aria-hidden="true">Read how it works →</span>
          )}
          <a className="text-link" href={p.source} target="_blank" rel="noopener noreferrer">
            Source <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  return (
    <section id="work" className="work section" aria-labelledby="work-title">
      <header className="section-head">
        <p className="kicker">Selected work</p>
        <h2 id="work-title">Six projects, three kinds of thing.</h2>
      </header>
      {groups.map((g) => (
        <div className="pair-group" key={g.id}>
          <div className="pair-intro">
            <h3>{g.title}</h3>
            <p>{g.note}</p>
          </div>
          <div className="pair">
            {g.projects.map((id) => (
              <ProjectCard key={id} p={byId[id]} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
