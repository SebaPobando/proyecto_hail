# ADR 0004 · Design system con la paleta de PROYEC

- Estado: aceptada
- Fecha: 2026-11-19

## Contexto

Hail se construye para PROYEC (proyectos y asesorías eléctricas). El frontend tenía colores repetidos a mano en cada archivo CSS y una identidad genérica ("SP", acento verde lima).

## Decisión

- El producto se llama **Hail** y usa la **paleta de PROYEC**: azul `#005CBD` con degradado a `#000E8B`, acento naranja `#FA3D15` → `#F78C1E`. El logo de PROYEC no aparece en las pantallas.
- Tokens únicos en `frontend/src/design-system/tokens.css`, con un espejo en `tokens.ts` para gráficos. Un script verifica que coincidan.
- Componentes base (`Button`, `StatusBadge`, `Alert`, `Field`, `Kpi`, `HailLogo`) con prefijo `ds-` para convivir con las HMI existentes.
- Tipografía: Inter para interfaz y datos; Saira para títulos y cifras, autoalojadas (OFL).
- El naranja es solo acento de marca. Los estados de proceso usan su propia escala (verde, gris, ámbar, rojo), y los datos simulados o vencidos tienen tonos propios.
- En pantallas de proceso se sigue el criterio ISA-101: el color se reserva para estados anormales.
- Contraste mínimo 4.5:1 para todo texto.

## Consecuencias

- Las pantallas existentes ya usan los tokens en lugar de colores fijos. La HMI oscura de AguaPozo mantiene su paleta propia por ser una pantalla de proceso.
- La referencia navegable vive en un design system publicado; si cambia un token en el código, se actualiza allá.
