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
}

export interface CambioRemotoNotificacion {
  tabla: 'docentes' | 'asistentes_educacion' | 'cursos_sae' | 'salas_infraestructura' | 'asignaciones_horarias' | 'establecimientos';
  evento: 'INSERT' | 'UPDATE' | 'DELETE';
  apartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general';
  rbd: string;
  timestamp: number;
}

/**
 * Hook de colaboración concurrente en tiempo real para un establecimiento escolar.
 * Permite:
 * 1. Monitorear presencia activa de otros usuarios en el mismo colegio y en qué apartado están trabajando.
 * 2. Recibir notificaciones inmediatas vía Supabase Realtime si otro usuario guardó cambios en algún apartado.
 * 3. Notificar al usuario para refrescar selectivamente sin sobrescribir su propio trabajo en curso.
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

  const cleanRbd = rbd ? rbd.trim() : '';

  useEffect(() => {
    if (!isSupabaseEnabled() || !cleanRbd || !usuarioActual) {
      setUsuariosEnColegio([]);
      return;
    }

    const channelName = `colegio_colaboracion_${cleanRbd}_${periodo}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: usuarioActual.id
        }
      }
    });
    channelRef.current = channel;

    // 1. Escuchar cambios de presencia
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const lista: PresenciaUsuario[] = [];
      Object.entries(state).forEach(([key, items]) => {
        if (key === usuarioActual.id) return; // excluir a uno mismo
        (items as any[]).forEach(item => {
          lista.push({
            usuarioId: item.usuarioId || key,
            nombreCompleto: item.nombreCompleto || 'Usuario',
            email: item.email,
            role: item.role || 'funcionario',
            apartadoActivo: item.apartadoActivo || 'general',
            rbd: item.rbd || cleanRbd,
            timestamp: item.timestamp || Date.now()
          });
        });
      });
      setUsuariosEnColegio(lista);
    });

    // 2. Escuchar cambios remotos en las tablas de este colegio
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
          const evento = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          if (onCambioRemotoDetectado) {
            onCambioRemotoDetectado({
              tabla,
              evento,
              apartado,
              rbd: cleanRbd,
              timestamp: Date.now()
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
