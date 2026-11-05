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
