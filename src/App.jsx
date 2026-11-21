import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import NotFound from './pages/NotFound.jsx';
import TunePanel from './components/TunePanel.jsx';

// Scroll to #work / #about / #contact when the URL has one, otherwise to the top.
function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        return;
      }
    }
    // A new page starts at the top straight away, without gliding up the old one.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash, key]);
  return null;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ScrollManager />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/work/:id" element={<ProjectPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <TunePanel />
    </>
  );
}
