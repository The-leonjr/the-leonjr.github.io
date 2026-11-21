import { useState } from 'react';
import { site } from '../data/projects.js';

export default function SayHi() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blocked: the address is still on screen to select. */
    }
  };

  return (
    <section id="contact" className="sayhi section" aria-labelledby="contact-title">
      <h2 id="contact-title">
        Say hi<span className="star" aria-hidden="true">✳</span>
      </h2>
      <div className="contact-list">
        <div className="contact-row">
          <span className="label">Email</span>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <button type="button" className="text-link" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="contact-row">
          <span className="label">LinkedIn</span>
          <a href={site.linkedin} target="_blank" rel="noopener noreferrer">Leon Jr Chua ↗</a>
        </div>
        <div className="contact-row">
          <span className="label">GitHub</span>
          <a href={site.github} target="_blank" rel="noopener noreferrer">{site.githubHandle} ↗</a>
        </div>
        {site.resume && (
          <div className="contact-row">
            <span className="label">Resume</span>
            <a href={site.resume} target="_blank" rel="noopener noreferrer">Download PDF ↗</a>
          </div>
        )}
      </div>
    </section>
  );
}
