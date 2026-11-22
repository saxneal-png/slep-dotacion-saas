import { describe, it, expect, beforeEach, vi } from 'vitest';

const ctl = vi.hoisted(() => ({
  enabled: true,
  fail: true,
  rpcError: null as any
}));

vi.mock('../src/services/supabaseClient', () => {
  const crearBuilder = () => {
    const builder: any = {
      upsert: () => builder,
      update: () => builder,
      delete: () => builder,
      eq: () => builder,
      in: () => builder,
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () =>
        Promise.resolve({
          data: null,
          error: ctl.fail ? { message: 'offline' } : null
        }),
      then: (resolve: (val: any) => any, reject?: (err: any) => any) =>
        Promise.resolve({
          data: [],
          error: ctl.fail ? { message: 'offline' } : null
        }).then(resolve, reject)
    };
    return builder;
  };

  return {
    SUPABASE_URL: 'https://mock.supabase.co',
    SUPABASE_ANON_KEY: 'mock-anon-key',
    SUPABASE_PUBLISHABLE_KEY: 'mock-publishable-key',
    isSupabaseEnabled: () => ctl.enabled,
    supabase: {
      from: () => crearBuilder(),
      rpc: () => Promise.resolve({ data: null, error: ctl.rpcError })
    }
  };
});

vi.mock('../src/services/supabaseDotacionService', () => ({
  SupabaseDotacionService: new Proxy(
    {},
    {
      get: (_target, _prop) => () => Promise.resolve(undefined)
    }
  )
}));

import {
  guardarEstablecimiento,
  guardarDocente,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  syncSupabaseMovilidad,
  contarSyncPendientesMovilidad,
  reintentarSyncPendientesMovilidad,
  crearEscenarioCalce,
  agregarPropuestaCalce,
  consolidarEscenarioAprobado,
  listarEscenariosCalce
} from '../src/services/movilidadTerritorialService';
import { Docente, Establecimiento } from '../src/types';

const PERIODO = 2027;
const RBD_A = '88201';
const RBD_B = '88202';

describe('Mesa de Movilidad - Outbox de Sincronización y Bloqueo RPC (T2 y T3)', () => {
  beforeEach(async () => {
    ctl.enabled = false;
    ctl.fail = false;
    ctl.rpcError = null;
    await reiniciarTodaLaBaseDatos();
  });

  it('T2: registra fallo en sync_pendientes_movilidad y lo vacía al reintentar con éxito', async () => {
    ctl.enabled = true;
    ctl.fail = true;

    const okFallo = await syncSupabaseMovilidad(
      {
        tabla: 'solicitudes_movilidad',
        operacion: 'upsert',
        payload: { id: 'x' },
        onConflict: 'id'
      },
      'test'
    );

    expect(okFallo).toBe(false);
    expect(await contarSyncPendientesMovilidad()).toBe(1);

    ctl.fail = false;
    const resReintento = await reintentarSyncPendientesMovilidad('super_usuario');
    expect(resReintento).toEqual({ ok: 1, fallidos: 0 });
    expect(await contarSyncPendientesMovilidad()).toBe(0);
  });

  it('T3: bloquea consolidación si Supabase está activo y la RPC no está desplegada', async () => {
    const estA: Establecimiento = {
      id: `est_${RBD_A}`,
      rbd: RBD_A,
      nombre: 'ESCUELA A OUTBOX',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 70
    };
    const estB: Establecimiento = {
      id: `est_${RBD_B}`,
      rbd: RBD_B,
      nombre: 'ESCUELA B OUTBOX',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 70
    };
    await guardarEstablecimiento(estA);
    await guardarEstablecimiento(estB);

    const docOrigen: Docente = {
      id: 'doc_t3_orig',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '15.222.333-4',
      nombres: 'JUANA',
      apellidos: 'PEREZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 14,
      horasSubvencionGeneralTitular: 14,
      asignaturaPrincipal: 'Lenguaje',
      situacionFinalGdp: 'Vigente'
    };
    const vacDest: Docente = {
      id: 'vac_t3_dest',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-9001`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'LENGUAJE',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 14,
      horasSubvencionGeneralContrata: 14,
      asignaturaPrincipal: 'Lenguaje',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };
    await guardarDocente(docOrigen);
    await guardarDocente(vacDest);

    const esc = await crearEscenarioCalce(
      { periodo: PERIODO, nombre: 'Escenario T3 RPC Ausente' },
      'super_usuario'
    );
    const prop = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: docOrigen.id,
        vacanteDestinoId: vacDest.id,
        esTrasladoCompleto: false
      },
      'super_usuario'
    );
    expect(prop.bloqueaConsolidacion).toBe(false);

    ctl.enabled = true;
    ctl.fail = false;
    ctl.rpcError = { code: 'PGRST202', message: 'Could not find the function' };

    await expect(
      consolidarEscenarioAprobado({
        escenarioId: esc.id,
        rolActor: 'super_usuario',
        usuarioActor: 't'
      })
    ).rejects.toThrow(/no está desplegada/);

    const escenariosPost = await listarEscenariosCalce(PERIODO, 'super_usuario');
    const escPost = escenariosPost.find(e => e.id === esc.id);
    expect(escPost?.estado).toBe('BORRADOR');
  });
});
