import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseEnabled } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenciaUsuario {
  usuarioId: string;
  nombreCompleto: string;
  email?: string;
  role: string;
  apartadoActivo: 'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas' | string;
  rbd: string;
  timestamp: number;
  esMismoPerfil?: boolean;
}

export interface CambioRemotoNotificacion {
  tabla: 'docentes' | 'asistentes_educacion' | 'cursos_sae' | 'salas_infraestructura' | 'asignaciones_horarias' | 'establecimientos';
  evento: 'INSERT' | 'UPDATE' | 'DELETE';
  apartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general';
  rbd: string;
  timestamp: number;
}

// Ventana de gracia para suprimir ecos locales (mutaciones emitidas por la sesión actual)
const ultimasMutacionesLocales: Record<string, number> = {};

export function notificarMutacionLocalEmitida(apartado: string) {
  const now = Date.now();
  ultimasMutacionesLocales[apartado] = now;
  ultimasMutacionesLocales['general'] = now;
}

function getClientSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let sid = sessionStorage.getItem('slep_client_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem('slep_client_session_id', sid);
    }
    return sid;
  } catch {
    return 'session_' + Math.random().toString(36).substring(2, 9);
  }
}

/**
 * Hook de colaboración concurrente en tiempo real para un establecimiento escolar.
 * Permite:
 * 1. Monitorear presencia activa de otros usuarios (o de la misma cuenta en otro dispositivo/pestaña) y en qué apartado están trabajando.
 * 2. Recibir notificaciones inmediatas vía Supabase Realtime si otro dispositivo guardó cambios en algún apartado.
 * 3. Suprimir auto-ecos locales generados por las acciones del propio dispositivo.
 * 4. Notificar al usuario para refrescar selectivamente sin sobrescribir su propio trabajo en curso.
 */
export function useColaboracionColegio({
  rbd,
  periodo,
  usuarioActual,
  apartadoActual,
  onCambioRemotoDetectado
}: {
  rbd: string | null | undefined;
  periodo: number;
  usuarioActual: {
    id: string;
    nombreCompleto: string;
    email?: string;
    role: string;
  } | null | undefined;
  apartadoActual: string;
  onCambioRemotoDetectado?: (notif: CambioRemotoNotificacion) => void;
}) {
  const [usuariosEnColegio, setUsuariosEnColegio] = useState<PresenciaUsuario[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const ultimoTrackRef = useRef<{ apartado: string; rbd: string; usuarioId: string } | null>(null);
  const timerDebounceRef = useRef<any>(null);
  const clientSessionIdRef = useRef<string>(getClientSessionId());

  const cleanRbd = rbd ? rbd.trim() : '';

  useEffect(() => {
    if (!isSupabaseEnabled() || !cleanRbd || !usuarioActual) {
      setUsuariosEnColegio([]);
      return;
    }

    const sessionId = clientSessionIdRef.current;
    const presenceKey = `${usuarioActual.id}__${sessionId}`;
    const channelName = `colegio_colaboracion_${cleanRbd}_${periodo}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: presenceKey
        }
      }
    });
    channelRef.current = channel;

    // 1. Escuchar cambios de presencia
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const lista: PresenciaUsuario[] = [];
      Object.entries(state).forEach(([key, items]) => {
        if (key === presenceKey) return; // excluir únicamente a ESTA pestaña/dispositivo
        (items as any[]).forEach(item => {
          if (item.sessionId === sessionId) return;
          const esMismoPerfil = item.usuarioId === usuarioActual.id;
          const nombreAMostrar = esMismoPerfil
            ? `${item.nombreCompleto || 'Usuario'} (Otro equipo/ventana)`
            : (item.nombreCompleto || 'Usuario');

          lista.push({
            usuarioId: item.usuarioId || key,
            nombreCompleto: nombreAMostrar,
            email: item.email,
            role: item.role || 'funcionario',
            apartadoActivo: item.apartadoActivo || 'general',
            rbd: item.rbd || cleanRbd,
            timestamp: item.timestamp || Date.now(),
            esMismoPerfil
          });
        });
      });
      setUsuariosEnColegio(lista);
    });

    // 2. Escuchar cambios remotos en las tablas de este colegio suprimiendo auto-ecos locales
    const registrarListener = (
      tabla: 'docentes' | 'asistentes_educacion' | 'cursos_sae' | 'salas_infraestructura' | 'asignaciones_horarias' | 'establecimientos',
      apartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general'
    ) => {
      channel.on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: tabla,
          filter: `rbd=eq.${cleanRbd}`
        },
        (payload: any) => {
          const now = Date.now();
          // Suprimir si la acción provino de este mismo cliente hace menos de 3.5 segundos
          const ultimaMutacion = Math.max(
            ultimasMutacionesLocales[apartado] || 0,
            ultimasMutacionesLocales['general'] || 0
          );
          if (now - ultimaMutacion < 3500) {
            return;
          }

          const evento = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          if (onCambioRemotoDetectado) {
            onCambioRemotoDetectado({
              tabla,
              evento,
              apartado,
              rbd: cleanRbd,
              timestamp: now
            });
          }
        }
      );
    };

    registrarListener('docentes', 'docentes');
    registrarListener('asistentes_educacion', 'asistentes');
    registrarListener('cursos_sae', 'cursos');
    registrarListener('asignaciones_horarias', 'docentes');
    registrarListener('salas_infraestructura', 'salas');

    // 3. Suscribirse y publicar presencia inicial
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        ultimoTrackRef.current = {
          apartado: apartadoActual,
          rbd: cleanRbd,
          usuarioId: usuarioActual.id
        };
        await channel.track({
          sessionId,
          usuarioId: usuarioActual.id,
          nombreCompleto: usuarioActual.nombreCompleto,
          email: usuarioActual.email,
          role: usuarioActual.role,
          apartadoActivo: apartadoActual,
          rbd: cleanRbd,
          timestamp: Date.now()
        }).catch(() => {});
      }
    });

    return () => {
      if (timerDebounceRef.current) {
        clearTimeout(timerDebounceRef.current);
      }
      channel.unsubscribe();
      channelRef.current = null;
      ultimoTrackRef.current = null;
    };
  }, [cleanRbd, periodo, usuarioActual?.id]);

  // Actualizar el apartado en el que está trabajando actualmente (con debounce y comparación para evitar rate limit)
  useEffect(() => {
    if (!channelRef.current || !usuarioActual || !cleanRbd) return;

    // Si ya enviamos el track para este mismo apartado, rbd y usuario, omitir
    const prev = ultimoTrackRef.current;
    if (prev && prev.apartado === apartadoActual && prev.rbd === cleanRbd && prev.usuarioId === usuarioActual.id) {
      return;
    }

    if (timerDebounceRef.current) {
      clearTimeout(timerDebounceRef.current);
    }

    // Debounce de 300ms para evitar spam al navegar o cambiar tabs rápidamente
    timerDebounceRef.current = setTimeout(() => {
      if (channelRef.current) {
        ultimoTrackRef.current = {
          apartado: apartadoActual,
          rbd: cleanRbd,
          usuarioId: usuarioActual.id
        };
        channelRef.current.track({
          sessionId: clientSessionIdRef.current,
          usuarioId: usuarioActual.id,
          nombreCompleto: usuarioActual.nombreCompleto,
          email: usuarioActual.email,
          role: usuarioActual.role,
          apartadoActivo: apartadoActual,
          rbd: cleanRbd,
          timestamp: Date.now()
        }).catch(() => {});
      }
    }, 300);

    return () => {
      if (timerDebounceRef.current) {
        clearTimeout(timerDebounceRef.current);
      }
    };
  }, [apartadoActual, cleanRbd, usuarioActual?.id, usuarioActual?.nombreCompleto, usuarioActual?.role]);

  return {
    usuariosEnColegio,
    hayOtrosUsuarios: usuariosEnColegio.length > 0
  };
}

export interface PresenciaGlobalUsuario {
  sessionId: string;
  usuarioId: string;
  nombreCompleto: string;
  email?: string;
  role: string;
  cargo?: string;
  rbd: string | null;
  nombreEstablecimiento: string | null;
  comuna: string | null;
  vistaActiva: string;
  apartadoActivo: string | null;
  periodo: number;
  conectadoDesde: number;
  ultimaActividad: number;
  estado: 'activo' | 'ausente';
  esSesionActual?: boolean;
}

export interface GrupoPresenciaEstablecimiento {
  rbd: string;
  nombreEstablecimiento: string;
  comuna: string;
  usuarios: PresenciaGlobalUsuario[];
  activosCount: number;
}

export const CHANNEL_PRESENCIA_GLOBAL = 'slep_presencia_global';

/**
 * Filtra las sesiones activas según el alcance territorial del observador.
 * - `global`: ve todas las sesiones (escuelas y vistas globales).
 * - `cartera` / `equipo`: ve sesiones que están trabajando en alguno de los RBDs permitidos.
 * - `establecimiento`: no tiene acceso al monitor territorial.
 */
export function filtrarPresenciaPorAlcance(
  sesiones: PresenciaGlobalUsuario[],
  rbdsPermitidos: Set<string>,
  alcance: 'global' | 'equipo' | 'cartera' | 'establecimiento' | null
): PresenciaGlobalUsuario[] {
  if (!alcance || alcance === 'establecimiento') return [];
  if (alcance === 'global') return sesiones;
  return sesiones.filter(s => s.rbd !== null && rbdsPermitidos.has(s.rbd));
}

/**
 * Agrupa sesiones activas por establecimiento (RBD) y separa aquellas en vistas globales.
 */
export function agruparPresenciaPorEstablecimiento(sesiones: PresenciaGlobalUsuario[]): {
  porEstablecimiento: GrupoPresenciaEstablecimiento[];
  enVistasGlobales: PresenciaGlobalUsuario[];
} {
  const mapa = new Map<string, GrupoPresenciaEstablecimiento>();
  const enVistasGlobales: PresenciaGlobalUsuario[] = [];

  for (const s of sesiones) {
    if (!s.rbd) {
      enVistasGlobales.push(s);
      continue;
    }
    const existente = mapa.get(s.rbd);
    if (existente) {
      existente.usuarios.push(s);
      if (s.estado === 'activo') existente.activosCount += 1;
    } else {
      mapa.set(s.rbd, {
        rbd: s.rbd,
        nombreEstablecimiento: s.nombreEstablecimiento || `RBD ${s.rbd}`,
        comuna: s.comuna || '',
        usuarios: [s],
        activosCount: s.estado === 'activo' ? 1 : 0
      });
    }
  }

  const porEstablecimiento = Array.from(mapa.values()).sort((a, b) => {
    if (b.usuarios.length !== a.usuarios.length) return b.usuarios.length - a.usuarios.length;
    return a.nombreEstablecimiento.localeCompare(b.nombreEstablecimiento, 'es');
  });

  enVistasGlobales.sort((a, b) => b.ultimaActividad - a.ultimaActividad);

  return { porEstablecimiento, enVistasGlobales };
}

/**
 * Hook de presencia global en tiempo real para la plataforma SLEP.
 * Todos los usuarios autenticados publican su estado (escuela, vista y pestaña actual).
 * Solo quienes tengan `puedeVerMonitor = true` consumen y renderizan el mapa de sesiones activas.
 */
export function usePresenciaGlobal({
  usuarioActual,
  colegioActivo,
  vistaActiva,
  apartadoActivo,
  periodo,
  puedeVerMonitor
}: {
  usuarioActual: {
    id: string;
    nombreCompleto: string;
    email?: string;
    role: string;
    cargo?: string;
  } | null | undefined;
  colegioActivo: { rbd: string; nombre: string; comuna?: string } | null;
  vistaActiva: string;
  apartadoActivo: string | null;
  periodo: number;
  puedeVerMonitor: boolean;
}) {
  const [sesionesActivas, setSesionesActivas] = useState<PresenciaGlobalUsuario[]>([]);
  const [estadoConexion, setEstadoConexion] = useState<'conectado' | 'conectando' | 'offline'>(() =>
    isSupabaseEnabled() ? 'conectando' : 'offline'
  );

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientSessionIdRef = useRef<string>(getClientSessionId());
  const conectadoDesdeRef = useRef<number>(Date.now());
  const ultimaActividadRef = useRef<number>(Date.now());
  const ultimoHeartbeatTrackRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rbdActual = colegioActivo?.rbd?.trim() || null;
  const nombreEstablecimientoActual = colegioActivo?.nombre || null;
  const comunaActual = colegioActivo?.comuna || null;
  const apartadoEfectivo = vistaActiva === 'workflow' ? apartadoActivo : null;

  const construirPayload = useCallback((): PresenciaGlobalUsuario | null => {
    if (!usuarioActual) return null;
    const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    return {
      sessionId: clientSessionIdRef.current,
      usuarioId: usuarioActual.id,
      nombreCompleto: usuarioActual.nombreCompleto,
      email: usuarioActual.email,
      role: usuarioActual.role,
      cargo: usuarioActual.cargo,
      rbd: rbdActual,
      nombreEstablecimiento: nombreEstablecimientoActual,
      comuna: comunaActual,
      vistaActiva,
      apartadoActivo: apartadoEfectivo,
      periodo,
      conectadoDesde: conectadoDesdeRef.current,
      ultimaActividad: ultimaActividadRef.current,
      estado: isHidden ? 'ausente' : 'activo'
    };
  }, [
    usuarioActual?.id,
    usuarioActual?.nombreCompleto,
    usuarioActual?.email,
    usuarioActual?.role,
    usuarioActual?.cargo,
    rbdActual,
    nombreEstablecimientoActual,
    comunaActual,
    vistaActiva,
    apartadoEfectivo,
    periodo
  ]);

  const payloadRef = useRef<PresenciaGlobalUsuario | null>(null);
  payloadRef.current = construirPayload();

  // Suscripción única al canal global mientras haya usuario autenticado
  useEffect(() => {
    if (!isSupabaseEnabled() || !usuarioActual) {
      setSesionesActivas([]);
      setEstadoConexion(isSupabaseEnabled() ? 'conectando' : 'offline');
      return;
    }

    conectadoDesdeRef.current = Date.now();
    ultimaActividadRef.current = Date.now();
    setEstadoConexion('conectando');

    const sessionId = clientSessionIdRef.current;
    const presenceKey = `${usuarioActual.id}__${sessionId}`;
    const channel = supabase.channel(CHANNEL_PRESENCIA_GLOBAL, {
      config: {
        presence: { key: presenceKey }
      }
    });
    channelRef.current = channel;

    if (puedeVerMonitor) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const lista: PresenciaGlobalUsuario[] = [];
        Object.entries(state).forEach(([, items]) => {
          (items as any[]).forEach(item => {
            if (!item || !item.usuarioId) return;
            lista.push({
              sessionId: item.sessionId || '',
              usuarioId: item.usuarioId,
              nombreCompleto: item.nombreCompleto || 'Usuario',
              email: item.email,
              role: item.role || 'funcionario',
              cargo: item.cargo,
              rbd: item.rbd || null,
              nombreEstablecimiento: item.nombreEstablecimiento || null,
              comuna: item.comuna || null,
              vistaActiva: item.vistaActiva || 'colegios_asesorados',
              apartadoActivo: item.apartadoActivo || null,
              periodo: Number(item.periodo) || periodo,
              conectadoDesde: Number(item.conectadoDesde) || Date.now(),
              ultimaActividad: Number(item.ultimaActividad) || Date.now(),
              estado: item.estado === 'ausente' ? 'ausente' : 'activo',
              esSesionActual: item.sessionId === sessionId
            });
          });
        });
        setSesionesActivas(lista);
      });
    } else {
      setSesionesActivas([]);
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setEstadoConexion('conectado');
        if (payloadRef.current) {
          ultimoHeartbeatTrackRef.current = Date.now();
          await channel.track(payloadRef.current).catch(() => {});
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setEstadoConexion('offline');
      }
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [usuarioActual?.id, puedeVerMonitor]);

  // Publicar actualización cuando cambia colegio, vista, pestaña o periodo (debounce 400ms)
  useEffect(() => {
    if (!channelRef.current || !payloadRef.current) return;
    ultimaActividadRef.current = Date.now();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (channelRef.current && payloadRef.current) {
        ultimoHeartbeatTrackRef.current = Date.now();
        channelRef.current.track(payloadRef.current).catch(() => {});
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [rbdActual, vistaActiva, apartadoEfectivo, periodo, usuarioActual?.nombreCompleto, usuarioActual?.role]);

  // Detectar actividad del usuario y cambios de visibilidad de pestaña/ventana
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !usuarioActual) return;

    const marcarActividad = () => {
      const now = Date.now();
      if (now - ultimaActividadRef.current > 25000) {
        ultimaActividadRef.current = now;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ultimaActividadRef.current = Date.now();
      }
      if (channelRef.current && payloadRef.current) {
        ultimoHeartbeatTrackRef.current = Date.now();
        channelRef.current.track(payloadRef.current).catch(() => {});
      }
    };

    window.addEventListener('pointerdown', marcarActividad, { passive: true });
    window.addEventListener('keydown', marcarActividad, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      const now = Date.now();
      // Solo re-publicar heartbeat si hubo actividad reciente y pasaron >= 60s
      if (
        channelRef.current &&
        payloadRef.current &&
        now - ultimoHeartbeatTrackRef.current >= 60000 &&
        ultimaActividadRef.current > ultimoHeartbeatTrackRef.current
      ) {
        ultimoHeartbeatTrackRef.current = now;
        channelRef.current.track(payloadRef.current).catch(() => {});
      }
    }, 30000);

    return () => {
      window.removeEventListener('pointerdown', marcarActividad);
      window.removeEventListener('keydown', marcarActividad);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [usuarioActual?.id]);

  return {
    sesionesActivas,
    estadoConexion
  };
}
