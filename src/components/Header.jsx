import { Link, useLocation } from 'react-router-dom';

const links = [
  ['Work', '/#work'],
  ['About', '/#about'],
  ['Contact', '/#contact'],
];

// The hand-drawn wave from the old MENU button, now the hover underline.
const Wave = () => (
  <svg className="nav-wave" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength="100" d="M2 7 C12 2 20 2 30 7 S48 12 58 7 S76 2 86 7 S104 12 118 6" />
  </svg>
);

export default function Header() {
  const { pathname } = useLocation();
  return (
    <header className={`site-header${pathname === '/' ? ' on-hero' : ''}`}>
      <Link className="wordmark" to="/" aria-label="Leon Jr, home">
        Leon Jr<span>.</span>
      </Link>
      <nav aria-label="Main">
        {links.map(([label, href]) => (
          <Link key={label} to={href} className="nav-link">
            {label}
            <Wave />
          </Link>
        ))}
      </nav>
    </header>
  );
}
