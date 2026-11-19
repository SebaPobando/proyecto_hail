import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { endAt, get, getDatabase, orderByChild, query, ref, startAt } from '@firebase/database';
import type { HistoryPoint, HistoryService } from './types';

// Configuración pública del SDK web. El acceso se controla mediante Auth y reglas.
const app = initializeApp({
  apiKey: 'AIzaSyAj-rXB6oxjk_laSF96Di8pZp5sZy18TEw',
  authDomain: 'aguapozo-df56a.firebaseapp.com',
  databaseURL: 'https://aguapozo-df56a-default-rtdb.firebaseio.com',
  projectId: 'aguapozo-df56a',
  messagingSenderId: '360553176078',
  appId: '1:360553176078:web:e92524afe9a4803a1bb05f',
});

export const firebaseAuth = getAuth(app);
export const firebaseDatabase = getDatabase(app);

export const firebaseHistory: HistoryService = {
  async queryHistory({ from, to, maxPoints = 241 }) {
    const snapshot = await get(query(ref(firebaseDatabase, 'telemetry/history'),
      orderByChild('timestamp'), startAt(from), endAt(to)));
    const points: HistoryPoint[] = [];
    snapshot.forEach(child => { points.push(child.val() as HistoryPoint); });
    if (points.length <= maxPoints) return points;
    if (maxPoints < 2) return points.slice(-1);
    return Array.from({ length: maxPoints }, (_, index) =>
      points[Math.round(index * (points.length - 1) / (maxPoints - 1))]);
  },
};

