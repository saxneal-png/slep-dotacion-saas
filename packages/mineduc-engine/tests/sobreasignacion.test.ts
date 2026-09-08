import { describe, it, expect } from 'vitest';
import { validarSobreasignacionDocente } from '../src/sobreasignacion';

describe('Motor Core MINEDUC - Control de Sobreasignación Docente (Ley 20.903)', () => {
  it('un docente de 44 hrs con 38 HA asignadas (100% legal) en 65/35 NO debe estar sobreasignado', () => {
    const res = validarSobreasignacionDocente(44, 38, '65/35');
    expect(res.estaSobreasignado).toBe(false);
    expect(res.excesoHoras).toBe(0);
    expect(res.horasMaxLectivasPermitidas).toBe(38);
    expect(res.horasAsignadas).toBe(38);
    expect(res.mensaje).toContain('conforme a la normativa vigente');
  });

  it('un docente de 44 hrs con 39 HA asignadas en 65/35 DEBE estar sobreasignado (+1 HA)', () => {
    const res = validarSobreasignacionDocente(44, 39, '65/35');
    expect(res.estaSobreasignado).toBe(true);
    expect(res.excesoHoras).toBe(1);
    expect(res.horasMaxLectivasPermitidas).toBe(38);
    expect(res.mensaje).toContain('Infracción Ley 20.903');
    expect(res.mensaje).toContain('+1 HA de exceso');
  });

  it('un docente de 30 hrs con 26 HA asignadas en régimen 65/35 NO debe estar sobreasignado', () => {
    const res = validarSobreasignacionDocente(30, 26, '65/35');
    expect(res.estaSobreasignado).toBe(false);
    expect(res.excesoHoras).toBe(0);
    expect(res.horasMaxLectivasPermitidas).toBe(26);
  });

  it('un docente de 44 hrs en régimen 60/40 (SEP vulnerable) tiene un tope de 35 HA según tabla oficial', () => {
    const resCumple = validarSobreasignacionDocente(44, 35, '60/40');
    expect(resCumple.estaSobreasignado).toBe(false);
    expect(resCumple.horasMaxLectivasPermitidas).toBe(35);

    const resExcede = validarSobreasignacionDocente(44, 36, '60/40');
    expect(resExcede.estaSobreasignado).toBe(true);
    expect(resExcede.excesoHoras).toBe(1);
  });
});
