import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, onUnauthorized } from '../services/api';
import {
  confirmPasswordReset,
  getMe,
  listProjects,
  login,
  logout,
  requestPasswordReset,
  type Me,
} from '../services/hail';
import { usePolling } from '../services/usePolling';
import AccessLanding from './AccessLanding';
import ProjectPortal from './ProjectPortal';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const message = (error: unknown) => (error instanceof Error ? error.message : 'Ocurrió un error inesperado.');

/** Lee el enlace de recuperación que envía el backend: `#reset?uid=…&token=…`. */
export function readResetLink(hash: string): { uid: string; token: string } | null {
  if (!hash.startsWith('#reset?')) return null;
  const params = new URLSearchParams(hash.slice('#reset?'.length));
  const uid = params.get('uid');
  const token = params.get('token');
  return uid && token ? { uid, token } : null;
}

type View = 'login' | 'forgot';

function LoginForm({ onLogged, onForgot, notice }: { onLogged: (me: Me) => void; onForgot: () => void; notice: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      onLogged(await login(String(fields.get('email')).trim(), String(fields.get('password'))));
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 401
        ? 'Correo o contraseña incorrectos.'
        : message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <form className="access-form" onSubmit={submit}>
    <h2>Iniciar sesión</h2>
    <p className="access-form-subtitle">Ingresa con tu correo y contraseña</p>
    {notice && <p role="status" className="access-notice">{notice}</p>}
    <label>Correo electrónico<input name="email" type="email" autoComplete="username" required autoFocus /></label>
    <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
    <button disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
    <button className="password-recovery" type="button" disabled={busy} onClick={onForgot}>¿Olvidaste tu contraseña?</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    if (!EMAIL.test(email)) {
      setError('Escribe un correo electrónico válido.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setSent((await requestPasswordReset(email)).detail);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <form className="access-form" onSubmit={submit}>
    <h2>Recuperar acceso</h2>
    <p className="access-form-subtitle">Te enviaremos un enlace para crear una contraseña nueva.</p>
    {sent ? <p role="status">{sent}</p> : <>
      <label>Correo electrónico<input name="email" type="email" autoComplete="username" required autoFocus /></label>
      <button disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
    </>}
    <button className="password-recovery" type="button" onClick={onBack}>Volver a iniciar sesión</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function ResetForm({ uid, token, onDone }: { uid: string; token: string; onDone: (notice: string) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password'));
    if (password !== String(fields.get('confirm'))) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await confirmPasswordReset(uid, token, password);
      onDone('Contraseña actualizada. Ya puedes iniciar sesión.');
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <form className="access-form" onSubmit={submit}>
    <h2>Nueva contraseña</h2>
    <p className="access-form-subtitle">Usa al menos 8 caracteres, que no sean solo números ni una contraseña común.</p>
    <label>Contraseña nueva<input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus /></label>
    <label>Repite la contraseña<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
    <button disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
    <button className="password-recovery" type="button" onClick={() => onDone('')}>Volver a iniciar sesión</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function Portal({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const projects = usePolling(listProjects, 0, `projects:${me.id}`);
  const [leaving, setLeaving] = useState(false);
  const logoutButton = <button type="button" disabled={leaving} onClick={() => {
    setLeaving(true);
    logout().catch(() => undefined).finally(onLogout);
  }}>{leaving ? 'Cerrando…' : 'Cerrar sesión'}</button>;

  if (!projects.data) {
    return <AccessLanding>
      {projects.error
        ? <><p role="alert">No se pudieron cargar tus proyectos. {projects.error.message}</p><button type="button" onClick={projects.refresh}>Reintentar</button></>
        : <p role="status">Cargando tus proyectos…</p>}
      {logoutButton}
    </AccessLanding>;
  }
  return <ProjectPortal key={me.id} me={me} projects={projects.data} logout={logoutButton} />;
}

/** Puerta de entrada: comprueba la sesión de Django y muestra el acceso o el portal. */
export default function Session() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [checkError, setCheckError] = useState('');
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<View>('login');
  const [notice, setNotice] = useState('');
  const [reset, setReset] = useState(() => readResetLink(window.location.hash));

  useEffect(() => {
    const controller = new AbortController();
    setCheckError('');
    getMe(controller.signal)
      .then(setMe)
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setMe(null);
        else setCheckError(message(error));
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => onUnauthorized(() => {
    setMe(current => {
      if (current) setNotice('Tu sesión expiró. Vuelve a ingresar.');
      return null;
    });
  }), []);

  useEffect(() => {
    const update = () => setReset(readResetLink(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  if (reset) {
    return <AccessLanding><ResetForm uid={reset.uid} token={reset.token} onDone={text => {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setReset(null);
      setView('login');
      setNotice(text);
    }} /></AccessLanding>;
  }
  if (checkError) {
    return <AccessLanding>
      <p role="alert">No se pudo contactar al servidor de Hail. {checkError}</p>
      <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button>
    </AccessLanding>;
  }
  if (me === undefined) return <AccessLanding><p role="status">Comprobando sesión…</p></AccessLanding>;
  if (me === null) {
    return <AccessLanding>{view === 'forgot'
      ? <ForgotForm onBack={() => setView('login')} />
      : <LoginForm notice={notice} onForgot={() => { setNotice(''); setView('forgot'); }} onLogged={user => { setNotice(''); setMe(user); }} />}
    </AccessLanding>;
  }
  return <Portal me={me} onLogout={() => { setNotice('Sesión cerrada.'); setMe(null); }} />;
}
