# ADR 0002 · Modelo multitenant

- Estado: aceptada
- Fecha: 2026-11-19

## Decisión

Una sola base de datos y un solo esquema. Cada proyecto pertenece a una `Organization`. Los usuarios acceden mediante `Membership` (usuario ↔ organización + rol). El usuario *staff* es el administrador global.

Todo acceso desde la API pasa por `Project.objects.for_user(user)`. Un recurso ajeno responde 404.

## Alternativas consideradas

- **Esquema por cliente (django-tenants)**: aislamiento fuerte, pero complica la vista transversal del administrador global y los agregados entre proyectos.
- **Base por cliente**: máximo aislamiento, costo operativo alto para el tamaño actual.

## Consecuencias

- El aislamiento depende de que ningún endpoint omita `for_user`; lo protegen las pruebas de `tests/test_isolation.py`.
- Row Level Security de PostgreSQL queda disponible como segunda capa si el número de clientes o el riesgo lo justifican.
- Una membresía da acceso a todos los proyectos de la organización. Si un cliente necesitara restringir proyectos por usuario, se agrega una asignación por proyecto sin cambiar el resto.
