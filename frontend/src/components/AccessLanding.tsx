import type { ReactNode } from 'react';
import './accessLanding.css';
import './visualIdentity.css';
import { AccentRule, HailLogo } from '../design-system';

export default function AccessLanding({ children }: { children: ReactNode }) {
  return <div className="access-landing">
    <main className="access-layout">
      <section className="access-card" aria-labelledby="access-title">
        <header className="access-brand">
          <h1 id="access-title"><HailLogo height={52} title="Hail" /></h1>
          <p>Supervisión de procesos</p>
          <AccentRule />
        </header>
        <div className="access-form-area">{children}</div>
      </section>
    </main>
    <footer className="access-footer">Hail · Supervisión industrial IoT</footer>
  </div>;
}
