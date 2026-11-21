import { site } from '../data/projects.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 {site.name}</span>
      <span className="hand">Built by hand, with a little curiosity.</span>
      <a href={site.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
    </footer>
  );
}
