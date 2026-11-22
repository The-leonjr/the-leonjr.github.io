import { useEffect } from 'react';
import Hero from '../components/Hero.jsx';
import Work from '../components/Work.jsx';
import About from '../components/About.jsx';

export default function Home() {
  useEffect(() => {
    document.title = 'Leon Jr Chua · Portfolio';
  }, []);
  return (
    <main id="main">
      <Hero />
      <Work />
      <About />
    </main>
  );
}
