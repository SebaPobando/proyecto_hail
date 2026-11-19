import type { ReactNode } from 'react';
import './accessLanding.css';
import './visualIdentity.css';

export default function AccessLanding({ children }: { children: ReactNode }) {
  return <div className="access-landing">
    <main className="access-layout">
      <section className="access-card" aria-labelledby="access-title">
        <header className="access-brand">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="5" y="5" width="15" height="15" rx="3"/><rect x="28" y="5" width="15" height="15" rx="3"/><rect x="5" y="28" width="15" height="15" rx="3"/><path d="M28 35h15m-7.5-7.5v15"/></svg>
          <h1 id="access-title">Proyectos</h1>
          <p>Supervisión industrial</p>
        </header>
        <div className="access-form-area">{children}</div>
      </section>
    </main>
    <footer className="access-footer">Portal de supervisión de proyectos</footer>
  </div>;
}
