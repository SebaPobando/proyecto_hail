# Design system de Hail

Identidad visual de Hail, construida con la paleta de **PROYEC** (proyec.cl). Hail es el producto; PROYEC aporta los colores y el estilo.

```
design-system/
├── tokens.css        colores, tipografía, espacios, bordes, sombras (fuente única)
├── tokens.ts         espejo de tokens para gráficos y SVG (verificado por script)
├── base.css          fuentes, foco visible, logo, acento naranja, rótulos
├── components.css    clases ds-* (botón, tarjeta, insignia, aviso, campo, tabla, pestañas)
├── components/       componentes React tipados que usan esas clases
├── HailLogo.tsx      logo completo e isotipo
└── index.ts          importa los estilos y exporta todo
```

Se carga una vez en `main.tsx` con `import './design-system'`. Uso:

```tsx
import { Button, StatusBadge, Alert, Kpi, Field, Card, HailLogo, tokens } from '../design-system';

<Button variant="primary">Guardar</Button>
<StatusBadge tone="ok">En línea</StatusBadge>
<Kpi label="Caudal" value="12.4" unit="m³/h" caption="FT-101" />
<Line stroke={tokens.color.blue500} />   // en Recharts
```

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--hail-blue-500` | `#005CBD` | Azul PROYEC: marca, acción principal, enlaces |
| `--hail-blue-700` | `#003F85` | Títulos, texto de énfasis |
| `--hail-royal` → `--hail-navy` | `#0031A1` → `#000E8B` | Degradado de marca (encabezado, acceso) |
| `--hail-orange-600` → `-400` | `#FA3D15` → `#F78C1E` | Degradado del isotipo y línea de acento |
| `--hail-orange-500` | `#F86419` | Acento: línea bajo el encabezado, indicador activo, foco |
| `--hail-ink` | `#0B1F3A` | Texto principal |
| `--hail-gray-*` | `#F1F5FA` … `#0B1F3A` | Fondos, bordes y texto secundario (`gray-500` `#56708B`, 4.7:1 sobre el fondo) |

## Reglas

1. **Azul = marca y acción.** Botones principales, enlaces, elemento activo del menú.
2. **Naranja = solo acento de marca.** Líneas, foco del teclado, indicador del menú. **Nunca** para un estado de proceso: en una planta el naranja se lee como advertencia.
3. **En pantallas de proceso el color es información** (criterio ISA-101 de HMI de alto desempeño): fondo neutro, equipos en gris, y color solo para estados anormales y alarmas.
4. **El color nunca va solo.** Todo estado lleva texto o forma (`StatusBadge` siempre tiene etiqueta).
5. **Los datos simulados se ven distintos** (`tone="simulated"`, violeta) y los vencidos también (`tone="stale"`, borde punteado). Nunca se presenta un dato simulado o antiguo como real y actual.
6. **Contraste mínimo 4.5:1** para todo texto (verificado para cada par de tokens de texto y fondo). `gray-400` es solo decorativo.
7. **Números tabulares** en tablas y lecturas (`font-variant-numeric: tabular-nums` o `.ds-tabular`).

## Estados

| Tono | Indicador | Significado |
| --- | --- | --- |
| `ok` | `#78BD39` | En marcha, en línea, valor válido |
| `stopped` | `#9AADB9` | Detenido, inactivo |
| `warning` | `#FFB819` | Advertencia |
| `critical` | `#ED353B` | Falla, alarma crítica |
| `info` | azul | Información |
| `simulated` | `#5B3FB0` | Dato simulado |
| `stale` | gris punteado | Dato vencido o sin datos |

## Tipografía

- **Inter** para interfaz y datos (legible en tamaños chicos, números tabulares).
- **Saira** para títulos, cifras grandes, rótulos en mayúscula y el lema; su forma recta y geométrica conversa con el logotipo de PROYEC.
- Ambas se sirven desde `public/fonts/` (licencia OFL), sin depender de servicios externos.

## Logo

`<HailLogo />` muestra el isotipo (una "H" cuyo travesaño es un pulso de señal, sobre el degradado naranja) y la palabra HAIL en letras rectas con sombra desplazada. `tone="dark"` para fondos de marca, `variant="mark"` para espacios reducidos.

## Verificación

```powershell
npm.cmd test -- tokens   # tokens.css y tokens.ts coinciden (src/design-system/tokens.test.ts)
```
