/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite reenvía la API y la administración de Django (runserver en :8000).
// Así el navegador ve un solo origen: la cookie de sesión y el CSRF funcionan sin CORS,
// y una sola sesión sirve para las pantallas y para /admin/.
const backend = process.env.HAIL_BACKEND_URL ?? 'http://127.0.0.1:8000';
const proxy = { '/api': backend, '/admin': backend, '/static': backend };

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 4173, proxy },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
