import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, type User } from '@firebase/auth';
import { onValue, ref } from '@firebase/database';
import { firebaseAuth, firebaseDatabase, firebaseHistory } from '../services/firebase';
import type { HistoryService, Telemetry } from '../services/types';
import { validTelemetry, telemetryStatus } from '../services/quality';
import AccessLanding from './AccessLanding';
import ProjectPortal, { projectIds, type ProjectId } from './ProjectPortal';

type Access = { uid: string; admin: boolean; allowed: ProjectId[] };

export default function FirebaseSession({ children }: { children: (data: Telemetry | null, history: HistoryService, sessionBar: ReactNode) => ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Telemetry | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [resetMessage,setResetMessage]=useState('');
  const [accessError,setAccessError]=useState(false);
  const [now, setNow] = useState(Date.now);
  const [loginError, setLoginError] = useState('');
  const [connected,setConnected]=useState(false);
  useEffect(()=>onValue(ref(firebaseDatabase,'.info/connected'),snapshot=>setConnected(snapshot.val()===true)),[]);
  const [readError, setReadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => {
    setAccess(null);
    setAccessError(false);
    if (!user) return;
    const legacy = () => onValue(ref(firebaseDatabase, 'telemetry/latest'), () => {
      setAccess({ uid: user.uid, admin: false, allowed: ['aguapozo'] });
    }, () => setAccess({ uid: user.uid, admin: false, allowed: [] }), { onlyOnce: true });
    let stopLegacy: (() => void) | undefined;
    const watchAccess = onValue(ref(firebaseDatabase, `portalAccess/${user.uid}`), snapshot => {
      stopLegacy?.();
      const value = snapshot.val();
      if (value === null) { stopLegacy = legacy(); return; }
      const admin = value.admin === true;
      setAccess({ uid: user.uid, admin, allowed: projectIds.filter(id => admin || value.projects?.[id] === true) });
    }, () => { setAccessError(true); stopLegacy = legacy(); });
    return () => { watchAccess(); stopLegacy?.(); };
  }, [user]);
  const opened = !!user && access?.uid === user.uid && access.allowed.includes('aguapozo');
  useEffect(() => {
    setData(null);
    setReadError(false);
    if (!opened) return;
    const unsubscribe = onValue(ref(firebaseDatabase, 'telemetry/latest'), snapshot => {
      const value=snapshot.val();
      setData(validTelemetry(value)?value:null);
      setReadError(value!==null&&!validTelemetry(value));
      setNow(Date.now());
    }, () => {
      setData(null);
      setReadError(true);
    });
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [opened, user]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSubmitting(true);
    setLoginError('');
    try { await signInWithEmailAndPassword(firebaseAuth, String(fields.get('email')), String(fields.get('password'))); }
    catch { setLoginError('No se pudo iniciar sesión. Revisa tus credenciales e inténtalo de nuevo.'); }
    finally { setSubmitting(false); }
  }

  async function resetPassword(form: HTMLFormElement | null) {
    const email=String(new FormData(form ?? undefined).get('email') ?? '').trim();
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){setResetMessage('Escribe tu correo electrónico para recuperar el acceso.');return;}
    setSubmitting(true);
    try {await sendPasswordResetEmail(firebaseAuth,email);setResetMessage('Si el correo tiene una cuenta habilitada, recibirás instrucciones para recuperar el acceso.');}
    catch {setResetMessage('No se pudo solicitar la recuperación. Inténtalo nuevamente más tarde.');}
    finally {setSubmitting(false);}
  }
  const logout = <button type="button" onClick={() => { void signOut(firebaseAuth); }}>Cerrar sesión</button>;
  if (user === undefined) return <AccessLanding><p role="status">Comprobando sesión…</p></AccessLanding>;
  if (!user) return <AccessLanding><form className="firebase-login" onSubmit={login}>
    <h2>Iniciar sesión</h2>
    <p className="access-form-subtitle">Ingresa con tu correo y contraseña</p>
    <label>Correo electrónico<input name="email" type="email" autoComplete="username" required /></label>
    <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
    <button disabled={submitting}>{submitting ? 'Ingresando…' : 'Ingresar'}</button>
    <button className="password-recovery" type="button" disabled={submitting} onClick={e=>void resetPassword(e.currentTarget.form)}>¿Olvidaste tu contraseña?</button>
    {resetMessage && <p role="status">{resetMessage}</p>}
    {loginError && <p role="alert">{loginError}</p>}
  </form></AccessLanding>;

  if (access?.uid !== user.uid) return <AccessLanding>
    <h2>Acceso de operador</h2>
    <p role="status">Cargando tus proyectos…</p>
    {logout}
  </AccessLanding>;

  const status=!connected?'Sin comunicación':telemetryStatus(data,now);
  return <ProjectPortal userId={user.uid} key={user.uid} allowed={access.allowed} role={access.admin ? 'Administrador' : 'Operador'} logout={logout}
    waterData={data} waterStatus={readError?'Error de datos o permisos':status} accessWarning={accessError?'No se pudo leer la asignación de proyectos. Se está usando el acceso anterior a AguaPozo.':''}
    renderWater={back => children(connected?data:null, firebaseHistory, <div className="demo-strip project-session-bar">
      {back}
      <span role="status">{readError ? 'Sin permiso para consultar la telemetría' :
        !data ? 'Esperando la primera lectura en Firebase' :
        status}</span>
      {logout}
    </div>)}/>;
}

