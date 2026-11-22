import { Link } from 'react-router-dom';
import { groups, byId } from '../data/projects.js';

// One project card. "Case study" also stretches over the whole card, so clicking anywhere opens
// the project page. A project you can play (SKIP) leads with its Play button instead.
function ProjectCard({ p }) {
  const caseStudy = (
    <Link
      className={`btn case-link${p.primary ? ' ghost' : ''}`}
      to={`/work/${p.id}`}
      aria-label={`${p.name} case study`}
    >
      Case study
    </Link>
  );
  return (
    <article className="project-card">
      <div className="project-card-media">
        <img src={p.cover} alt={p.alt} loading="lazy" width="1140" height="642" />
      </div>
      <div className="project-card-body">
        <div className="project-card-heading">
          <h4>{p.name}</h4>
          <p className="meta">{p.category}</p>
        </div>
        <p className="hook">{p.hook}</p>
        <div className="card-actions">
          {p.primary && (
            <a className="btn" href={p.primary.href} target="_blank" rel="noopener noreferrer">
              {p.primary.label}
            </a>
          )}
          {caseStudy}
          <a className="text-link" href={p.source} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} source code`}>
            Source
          </a>
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  return (
    <section id="work" className="work section" aria-labelledby="work-title">
      <header className="section-head section-inner">
        <h2 id="work-title">Selected work.</h2>
        <p className="section-sub">Six projects, three kinds of thing.</p>
      </header>
      {groups.map((g) => (
        <div className={`pair-group pair-group--${g.id}`} key={g.id}>
          <div className="section-inner">
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
        </div>
      ))}
    </section>
  );
}
