# Publicación GitHub → Vercel

Configuración lista: React/Vite, npm run build, salida dist. La navegación usa fragmentos (#), por lo que no requiere reescritura de rutas.

1. Crear o seleccionar el repositorio GitHub del propietario y subir el código, revisando antes los archivos incluidos. Preferir privado.
2. En Vercel importar ese repositorio mediante la integración de GitHub, seleccionar Vite y confirmar dist como salida.
3. Usar el dominio resultante en Firebase Authentication → Configuración → Dominios autorizados.
4. Verificar inicio de sesión, recuperación, permisos y apertura de cada proyecto en pestaña independiente.

La web usa la configuración pública de Firebase. Nunca añadir credenciales Admin SDK ni tokens al frontend o a variables VITE_. Las reglas de Firebase se publican separadamente; este despliegue no las cambia.

Vercel publica la web; no mantiene el proceso MQTT de server/firebaseBridge.ts. El puente necesita su propio entorno persistente. Las vistas de demostración siguen identificadas como tales.

Estado de esta preparación: la carpeta original no tenía repositorio Git ni remoto. La publicación requiere identificar el repositorio GitHub y disponer de la integración autorizada con Vercel. No hay URL de producción confirmada.
