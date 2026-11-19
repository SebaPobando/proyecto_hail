# Despliegue de prueba

El entorno publica la HMI y la API en un dominio HTTPS con autenticación
HTTP básica. Caddy protege tanto la web como las consultas a la API. El
broker y la API quedan dentro de la red de Compose y SQLite usa un volumen
persistente. El publicador proporciona datos simulados.

En un servidor Linux con Docker Compose, apunta el dominio al servidor y
permite tráfico entrante en 80 y 443. Copia `deploy/env.example` a `.env`.
Genera el hash bcrypt con `docker run --rm -it caddy:2 caddy hash-password`
e introduce la contraseña cuando se solicite. Guarda el hash entre comillas
simples en `.env`. Usa una contraseña única y guarda el archivo de forma privada.

Desde la raíz del proyecto en el servidor:

```sh
docker compose build backend web
docker compose up -d --wait
docker compose ps
```

Abre `https://TU_DOMINIO/?source=mqtt` e inicia sesión. Verifica Proceso
y Tendencias desde datos móviles. Comprueba que `/api/telemetry/latest`
responde con 401 sin credenciales. Para probar el corte ejecuta
`docker compose stop publisher`, espera 30 segundos desde la última
muestra y comprueba el aviso. Restablece con `docker compose start publisher`.

El broker incluido recibe datos del publicador interno. Para incorporar
la CBOX, configura un broker con el transporte y la autenticación que
admita el equipo, captura un mensaje de LT-101 y adapta el decodificador
del backend al tópico y formato observados.
