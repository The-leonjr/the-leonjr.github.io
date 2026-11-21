import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hasWebGL } from '../hooks.js';

const AsciiOrb = lazy(() => import('../components/AsciiOrb.jsx'));

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Leon Jr Chua';
  }, []);
  return (
    <main id="main" className="not-found">
      {hasWebGL() && (
        <div className="ascii-frame small">
          <Suspense fallback={null}>
            <AsciiOrb dropped label="The homepage orb, rolled out of place" />
          </Suspense>
        </div>
      )}
      <h1>Nothing lives at this address.</h1>
      <p>The link might be old, or the page moved when the site was rebuilt.</p>
      <Link className="btn" to="/">Back to the homepage</Link>
    </main>
  );
}
