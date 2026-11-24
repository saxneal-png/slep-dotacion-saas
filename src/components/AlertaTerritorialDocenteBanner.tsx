import React from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import { EvaluacionTopeTerritorialDocente } from '../services/auditoriaDocenteService';

interface AlertaTerritorialDocenteBannerProps {
  evaluacion: EvaluacionTopeTerritorialDocente | null | undefined;
  compact?: boolean;
  onAjustarAlMargen?: (margen: number) => void;
}

/**
 * Muestra una alerta normativa SLEP cuando un docente con múltiples colegios
 * supera el tope legal de 44 horas semanales con el mismo sostenedor (DFL 1)
 * o presenta sobreasignación horaria en otro establecimiento.
 */
export const AlertaTerritorialDocenteBanner: React.FC<AlertaTerritorialDocenteBannerProps> = ({
  evaluacion,
  compact = false,
  onAjustarAlMargen,
}) => {
  if (!evaluacion || !evaluacion.esMultiEscuela) return null;

  const {
    excedeLimite44h,
    horasTotalesSlep,
    horasOtrasEscuelas,
    excesoHoras,
    margenDisponibleEnSlep,
    otrasEscuelas,
    tieneSobreasignacionEnOtraEscuela,
  } = evaluacion;

  if (!excedeLimite44h && !tieneSobreasignacionEnOtraEscuela && compact) {
    return null;
  }

  const esCritica = excedeLimite44h;
  const esAdvertencia = !excedeLimite44h && tieneSobreasignacionEnOtraEscuela;

  const containerClass = esCritica
    ? 'bg-rose-50 border-rose-300 text-rose-900'
    : esAdvertencia
    ? 'bg-amber-50 border-amber-300 text-amber-900'
    : 'bg-indigo-50/70 border-indigo-200 text-indigo-900';

  const iconClass = esCritica
    ? 'text-rose-600'
    : esAdvertencia
    ? 'text-amber-600'
    : 'text-indigo-600';

  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-xs space-y-1.5 ${containerClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {esCritica || esAdvertencia ? (
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
          ) : (
            <Building2 className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
          )}
          <div className="space-y-0.5">
            {esCritica ? (
              <div className="font-extrabold">
                Infracción Tope Legal SLEP (&gt;44h): suma {horasTotalesSlep}h en el territorio (+{excesoHoras}h sobre el máximo permitido)
              </div>
            ) : esAdvertencia ? (
              <div className="font-extrabold">
                Alerta Multi-Escuela ({horasTotalesSlep}h / 44h en SLEP): presenta sobreasignación horaria en otro establecimiento
              </div>
            ) : (
              <div className="font-bold">
                Docente Multi-Escuela en SLEP: {horasOtrasEscuelas}h en otros colegios · Total territorial {horasTotalesSlep}h / 44h (margen disponible aquí: {margenDisponibleEnSlep}h)
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
              {otrasEscuelas.map((otra) => (
                <span
                  key={otra.rbd}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${
                    otra.esSobreasignadoLocal
                      ? 'bg-rose-100/80 border-rose-300 text-rose-900'
                      : 'bg-white/80 border-slate-200 text-slate-700'
                  }`}
                >
                  <Building2 className="w-3 h-3 opacity-70" />
                  {otra.nombreColegio}: <strong>{otra.horasContrato}h</strong>
                  {otra.esSobreasignadoLocal && ' (Sobreasignado)'}
                </span>
              ))}
            </div>

            {esCritica && (
              <p className="text-[11px] opacity-90 pt-0.5">
                Aunque este establecimiento muestre horas locales sin asignar, <strong>no debe asignarse ni contratarse carga adicional</strong> mientras la suma territorial supere las 44h semanales con el mismo sostenedor.
              </p>
            )}
          </div>
        </div>

        {esCritica && onAjustarAlMargen && (
          <button
            type="button"
            onClick={() => onAjustarAlMargen(margenDisponibleEnSlep)}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
          >
            Ajustar a {margenDisponibleEnSlep}h máx.
          </button>
        )}
      </div>
    </div>
  );
};
