# Guía para probar Hail en tu computador

Esta guía es para levantar Hail en un computador con Windows **sin saber programar**. No hay que escribir código: se instalan tres programas, se descarga el proyecto y se usan dos archivos con doble clic.

- **Tiempo:** unos 30 minutos la primera vez (casi todo es esperar descargas). Después, abrir Hail toma menos de un minuto.
- **Qué necesitas:** Windows 10 u 11, conexión a internet y acceso al repositorio de GitHub (pídeselo a Seba).
- **Qué no se toca:** Hail queda funcionando solo en tu computador. No se conecta a ninguna planta ni a equipos reales; los datos son simulados.

## Qué vas a tener al final

- **Las pantallas de Hail** en el navegador, con inicio de sesión: el portal con los tres proyectos de ejemplo (AguaPozo, Medidores ULagos y Nutrial).
- **La administración**: donde se ven y editan los clientes, proyectos, equipos de campo, señales y las lecturas que van llegando.
- **Un simulador** que inventa lecturas cada 10 segundos, como si hubiera equipos enviando datos.

## Paso 1 · Instalar tres programas (una sola vez)

Instálalos en este orden. En todos puedes aceptar las opciones que vienen marcadas, salvo lo que se indica.

1. **Git** (sirve para descargar el proyecto y sus actualizaciones)
   Descarga: https://git-scm.com/download/win → "Click here to download". Instala con **Next** en todas las pantallas.

2. **Python** (el lenguaje del backend)
   Descarga: https://www.python.org/downloads/ → botón amarillo "Download Python 3.x".
   **Importante:** en la primera pantalla del instalador marca la casilla **"Add python.exe to PATH"** (abajo) y luego **"Install Now"**. Si no marcas esa casilla, el instalador de Hail no lo va a encontrar.

3. **Node.js** (el que arma las pantallas)
   Descarga: https://nodejs.org/ → botón de la versión **LTS**. Instala con **Next** en todas las pantallas.

**Después de instalar los tres, reinicia el computador** (o al menos cierra sesión y vuelve a entrar) para que Windows los reconozca.

## Paso 2 · Descargar el proyecto (una sola vez)

1. Abre **PowerShell**: presiona la tecla Windows, escribe `PowerShell` y presiona Enter. Se abre una ventana azul o negra con texto; ahí se escriben comandos.
2. Copia esta línea, pégala en PowerShell (clic derecho pega) y presiona Enter:

   ```powershell
   cd $HOME; git clone https://github.com/SebaPobando/proyecto_hail.git
   ```

   Si aparece una ventana de GitHub pidiendo iniciar sesión, entra con tu cuenta (la que Seba agregó al proyecto). Cuando termine dirá algo como `Resolving deltas: 100%, done.`

3. Para abrir la carpeta descargada, pega esto y presiona Enter:

   ```powershell
   explorer $HOME\proyecto_hail
   ```

   El proyecto quedó en `C:\Users\<tu usuario>\proyecto_hail`. Ya puedes cerrar PowerShell.

> **Por qué no en Documentos:** muchas veces la carpeta Documentos está sincronizada con OneDrive, y OneDrive se pone muy lento con los miles de archivos pequeños que descarga el proyecto.

## Paso 3 · Instalar Hail (una sola vez)

En la carpeta `proyecto_hail`, haz **doble clic en `instalar.cmd`**.

Se abre una ventana que avanza por 6 pasos. Va a:

1. Comprobar que Python y Node.js estén instalados.
2. Descargar las librerías que usa Hail (es lo que más tarda: 5 a 10 minutos).
3. Crear la base de datos con los tres proyectos de ejemplo.
4. **Pedirte un correo y una contraseña** para tu cuenta de administrador. Es solo para este computador; puede ser tu correo real. **Mientras escribes la contraseña no se ve nada en pantalla: es normal**, escríbela y presiona Enter.

Cuando termine dirá en verde **"Listo. Ahora haz doble clic en iniciar.cmd"**. Presiona cualquier tecla para cerrar la ventana.

Si aparece un texto en rojo que dice **ERROR**, mira [Si algo falla](#si-algo-falla).

## Paso 4 · Abrir Hail (cada vez que lo quieras usar)

En la carpeta `proyecto_hail`, haz **doble clic en `iniciar.cmd`**.

1. Se abren **tres ventanas nuevas**: "Hail - Backend", "Hail - Simulador de datos" y "Hail - Pantallas". Son las partes de Hail funcionando. **No las cierres mientras lo uses** (puedes minimizarlas).
2. Cuando todo responda, se abre sola una pestaña del navegador con la pantalla de **inicio de sesión** de Hail. Entra con el correo y la contraseña del paso 3.
3. La primera ventana (la de `iniciar.cmd`) ya se puede cerrar.

Si Windows pregunta si permites el acceso de Python o Node.js en el firewall, puedes darle **Cancelar**: Hail funciona solo dentro de tu computador.

**Para apagar Hail**, cierra las tres ventanas "Hail - …". La próxima vez, doble clic en `iniciar.cmd` otra vez. Los datos quedan guardados.

## Paso 5 · Qué mirar

### Las pantallas — http://127.0.0.1:5173/

Entra con tu cuenta de administrador: ves los tres proyectos. Recorre cada uno:

- **AguaPozo**: HMI de un pozo con estanque, bomba y dosificación de cloro. Los valores cambian cada pocos segundos (vienen del simulador). En **Tendencias** se ve el historial guardado.
- **Medidores Eléctricos**: resumen de los cinco medidores. Tres están "en línea" y dos "sin comunicación", a propósito. Pincha un medidor para ver su historial y en **Reportes** genera un resumen del día.
- **Nutrial**: el esquema del proceso todavía es una simulación del navegador (su PLC no está conectado). En **Equipos y señales** está la lista de E/S real, que viene de la base de datos.
- **Conectividad** (menú izquierdo): qué equipos están enviando datos y cuándo llegó lo último.

### Alarmas

Al abrir Hail con `iniciar.cmd`, el simulador provoca una **falla de la dosificación de cloro** en AguaPozo. En uno o dos minutos aparecen dos alarmas: "Falla en la dosificación" y "Cloro residual bajo 0,2 mg/L". Después, cada media hora más o menos, el simulador provoca otra falla al azar (de bomba o de dosificación) y el proceso se recupera solo a los pocos minutos.

- En el menú izquierdo, **Alarmas** muestra las abiertas, con un contador rojo de las que nadie ha reconocido.
- **Reconocer** deja constancia de quién vio la alarma y se hace cargo; se puede agregar un comentario. Una alarma queda abierta hasta que se reconoce, aunque el proceso ya se haya normalizado.
- **Crear seguimiento** abre una tarea en la bitácora (menú **Seguimiento**), donde el equipo anota lo que se hizo.
- **Historial** muestra todas las alarmas, también las cerradas.

Prueba los roles: `cliente-aguapozo@hail.local` es **operador** y puede reconocer; `cliente-ulagos@hail.local` y `cliente-nutrial@hail.local` son **lectores**: ven, pero no reconocen ni escriben.

> Por ahora los avisos son **solo en pantalla**: Hail no envía correos ni mensajes.

**Prueba el aislamiento entre clientes.** Cierra sesión (arriba a la derecha) y entra como un cliente, por ejemplo `cliente-aguapozo@hail.local` con la contraseña `hail-demo-2026`. Ese usuario solo ve AguaPozo: los otros proyectos no aparecen ni escribiendo su dirección. Los otros clientes de prueba son `cliente-ulagos@hail.local` y `cliente-nutrial@hail.local` (misma contraseña).

### La administración — botón "Administración" arriba a la derecha (o http://127.0.0.1:5173/admin/)

Usa la misma sesión de las pantallas: si ya entraste como administrador, no vuelve a pedir la contraseña. Lo más interesante:

| Sección | Qué hay |
| --- | --- |
| **Organizaciones (clientes)** | Los clientes (cada uno solo verá su proyecto). |
| **Proyectos** | AguaPozo, Medidores ULagos y Nutrial. |
| **Dispositivos** | Los equipos de campo de cada proyecto (PLC, medidores, gateway), con su modelo y su usuario MQTT. |
| **Señales** | Cada variable que mide un equipo: tag, nombre, unidad, rango, si es analógica o digital. **Aquí es donde más sirve tu revisión.** |
| **Reglas de alarma** | Cuándo se activa cada alarma: señal, condición (alto, bajo o estado), umbral, banda muerta, prioridad y mensaje. Puedes crear, cambiar o deshabilitar reglas, y se aplican con la siguiente lectura. |
| **Alarmas** y **Seguimientos** | El registro completo de alarmas y la bitácora, de solo consulta. |
| **Lecturas actuales** | El último valor de cada señal. Con el simulador corriendo, si recargas la página (F5) cada 10 segundos ves cómo cambian. |
| **Estado de los workers** | Si el servicio que recibe datos por MQTT está vivo (en esta prueba no se usa). |

### Dónde aporta tu revisión

Lo más útil es revisar con ojo de electrónico lo que es de terreno:

- **Señales** de cada equipo: ¿los tags, unidades y rangos tienen sentido? ¿Falta alguna señal importante? ¿Algún estado digital está mal nombrado?
- **Reglas de alarma**: las de demostración usan la NCh409 para el cloro (0,2 a 2,0 mg/L) y la IEEE 519 para el THD (8 %). ¿Qué umbrales, bandas muertas y prioridades corresponden en cada instalación real? ¿Faltan alarmas importantes?
- **[Protocolo MQTT](PROTOCOLO_MQTT.md)**: cómo tiene que enviar los datos un equipo de campo, y qué falta saber de la CBOX Haiwell para conectarla.

Anota lo que veas (una captura con una nota sirve) y se lo mandas a Seba.

## Paso 6 · Actualizar cuando Seba avise

Cuando haya cambios nuevos:

1. Cierra las tres ventanas de Hail si estaban abiertas.
2. Abre PowerShell y pega:

   ```powershell
   cd $HOME\proyecto_hail; git pull
   ```

3. Haz doble clic en `instalar.cmd` otra vez (no borra nada ni vuelve a pedir la cuenta; solo instala lo nuevo).
4. Doble clic en `iniciar.cmd`.

## Si algo falla

Lo primero: **una captura de la ventana con el error se la mandas a Seba**. Antes de eso, revisa si es alguno de estos:

| Qué pasa | Qué hacer |
| --- | --- |
| "no encontré Python 3.12 o superior" | Reinstala Python marcando **"Add python.exe to PATH"** (ver paso 1) y reinicia el computador. Si al escribir `python` en PowerShell se abre la Microsoft Store, es el mismo problema. |
| "no encontré Node.js" | Instala Node.js (versión LTS) y reinicia el computador. |
| `git` no se reconoce como comando | Falta instalar Git o reiniciar después de instalarlo. |
| Al hacer `git clone` dice `Repository not found` o pide permisos | Tu cuenta de GitHub todavía no tiene acceso: pídele a Seba que te agregue al repositorio. |
| "no se pudo instalar las librerías…" | Casi siempre es internet. Revisa la conexión y vuelve a hacer doble clic en `instalar.cmd`; continúa donde quedó. |
| "Hail no está instalado todavía" | Falta el paso 3: doble clic en `instalar.cmd`. |
| "el backend no partió" | Mira la ventana "Hail - Backend". Si dice `That port is already in use`, hay otra copia de Hail abierta: cierra todas las ventanas "Hail - …" y vuelve a abrir con `iniciar.cmd`. Si no, reinicia el computador y prueba de nuevo. |
| "las pantallas no partieron" | Mira la ventana "Hail - Pantallas". Si dice que el puerto 5173 está ocupado, cierra todas las ventanas "Hail - …" y vuelve a abrir. |
| Windows muestra "Windows protegió su PC" al abrir un `.cmd` | Pasa si el proyecto se descargó como ZIP. Clic en **Más información → Ejecutar de todas formas**. |
| La pantalla de Hail dice "No se pudo contactar al servidor de Hail" | La ventana "Hail - Backend" está cerrada o tuvo un error. Cierra las ventanas de Hail y vuelve a abrir con `iniciar.cmd`. |
| "Correo o contraseña incorrectos" con un usuario `cliente-…` | Esos usuarios se crean con la contraseña `hail-demo-2026`. Si alguien la cambió, en la administración (Usuarios) se puede poner otra. |
| La página dice "No se puede acceder a este sitio" | Las ventanas de Hail están cerradas o todavía partiendo. Espera unos segundos y recarga, o vuelve a abrir con `iniciar.cmd`. |
| Olvidaste la contraseña de administrador | Pídele a Seba el comando para cambiarla (`python manage.py changepassword tu@correo`). |

## Para curiosos: qué es cada parte

- **Backend**: el "cerebro". Guarda clientes, proyectos, equipos, señales y lecturas en una base de datos, y decide quién puede ver qué. Es la ventana "Hail - Backend".
- **Simulador de datos**: hace de equipo de campo falso y escribe lecturas cada 10 segundos. En una planta real este lugar lo ocupan los PLC o la CBOX enviando por MQTT.
- **Pantallas** (frontend): lo que ve el cliente en el navegador. Es la ventana "Hail - Pantallas".
- **Base de datos**: en esta prueba es un solo archivo, `backend\db.sqlite3`. Si algún día quieres partir de cero, cierra Hail, borra ese archivo y vuelve a hacer doble clic en `instalar.cmd`.
