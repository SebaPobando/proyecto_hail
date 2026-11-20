import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { me, project } from '../test/fixtures';
import ProjectPortal, { initials, roleLabel } from './ProjectPortal';
import { readResetLink } from './Session';
import { formatReading } from './GenericHmi';
import { reading } from '../test/fixtures';

const projects = [
  project('aguapozo', { name: 'AguaPozo', hmi_type: 'aguapozo' }),
  project('medidores-electricos', { name: 'Medidores Eléctricos', hmi_type: 'electrical' }),
];

describe('ProjectPortal', () => {
  it('muestra solo los proyectos que entrega la API, con el rol y las iniciales del usuario', () => {
    const html = renderToStaticMarkup(createElement(ProjectPortal, { me: me(), projects: projects.slice(0, 1), logout: null }));
    expect(html).toContain('Centro de operaciones');
    expect(html).toContain('AguaPozo');
    expect(html).not.toContain('Medidores Eléctricos');
    expect(html).toContain('Lector');
    expect(html).toContain('>AP<');
    expect(html).not.toContain('Administración ↗');
  });

  it('el administrador de plataforma ve el enlace a la administración', () => {
    const html = renderToStaticMarkup(createElement(ProjectPortal, { me: me({ is_platform_admin: true }), projects, logout: null }));
    expect(html).toContain('Medidores Eléctricos');
    expect(html).toContain('Administración ↗');
    expect(html).toContain('Administrador de plataforma');
  });

  it('sin proyectos lo dice en vez de mostrar un portal vacío', () => {
    expect(renderToStaticMarkup(createElement(ProjectPortal, { me: me({ organizations: [] }), projects: [], logout: null })))
      .toContain('todavía no tiene proyectos asignados');
  });
});

describe('ayudas del portal', () => {
  it('rol más alto y etiqueta del administrador', () => {
    expect(roleLabel(me({ organizations: [{ slug: 'a', name: 'A', role: 'viewer' }, { slug: 'b', name: 'B', role: 'org_admin' }] }))).toBe('Administrador del cliente');
    expect(roleLabel(me({ is_platform_admin: true }))).toBe('Administrador de plataforma');
  });

  it('iniciales desde el nombre o el correo', () => {
    expect(initials({ full_name: 'Gabriel Andrés Soto', email: 'g@x.cl' })).toBe('GS');
    expect(initials({ full_name: '', email: 'gabo@hail.local' })).toBe('GA');
  });

  it('lee el enlace de recuperación del backend', () => {
    expect(readResetLink('#reset?uid=Mw&token=abc-123')).toEqual({ uid: 'Mw', token: 'abc-123' });
    expect(readResetLink('#project=aguapozo')).toBeNull();
    expect(readResetLink('#reset?uid=Mw')).toBeNull();
  });

  it('formatea lecturas con decimales, unidad o etiqueta de estado', () => {
    expect(formatReading(reading('LT-101', 68.25, { unit: '%', decimals: 1 }))).toBe('68,3 %');
    expect(formatReading(reading('P-101', 1, { state_label: 'En marcha' }))).toBe('En marcha');
    expect(formatReading(reading('X', null))).toBe('—');
  });
});
