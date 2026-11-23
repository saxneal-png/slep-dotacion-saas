import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import {
  AsignacionHoraria,
  AsistenteEducacion,
  CursoSae,
  Docente,
  Establecimiento
} from '../types';
import { AuthSession } from '../types/authTypes';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';
import { listarSolicitudesMovimientoDotacion } from '../services/solicitudesDotacionService';
import { BandejaSolicitudesGdpPanel } from './consolidacion/BandejaSolicitudesGdpPanel';
import { ConsolidadorMasterView } from './ConsolidadorMasterView';
import { MesaMovilidadView } from './MesaMovilidadView';

export type SubModuloConsolidacion = 'solicitudes_gdp' | 'mesa_movilidad' | 'cierre_dep';

export interface ConsolidacionTerritorialViewProps {
  establecimientos: Establecimiento[];
  docentes: Docente[];
  asistentes?: AsistenteEducacion[];
  cursos?: CursoSae[];
  diagnosticos: DiagnosticoColegioCompleto[];
  asignaciones?: AsignacionHoraria[];
  periodoActivo: number;
  usuarioActual: AuthSession['usuario'];
  mostrarMesaMovilidad?: boolean;
  initialSubModulo?: SubModuloConsolidacion;
  onImportarCarteraSlep: (file: File) => void;
  onExportarExcel: () => void;
  onRecargarDatos?: () => Promise<void> | void;
  onGuardarColegio?: (est: Establecimiento) => Promise<void>;
}

export const ConsolidacionTerritorialView: React.FC<ConsolidacionTerritorialViewProps> = ({
  establecimientos,
  docentes,
  asistentes = [],
  cursos = [],
  diagnosticos,
  asignaciones = [],
  periodoActivo,
  usuarioActual,
  mostrarMesaMovilidad = false,
  initialSubModulo = 'solicitudes_gdp',
  onImportarCarteraSlep,
  onExportarExcel,
  onRecargarDatos,
  onGuardarColegio
}) => {
  const [subModulo, setSubModulo] = useState<SubModuloConsolidacion>(
    initialSubModulo === 'mesa_movilidad' && !mostrarMesaMovilidad
      ? 'solicitudes_gdp'
      : initialSubModulo
  );
  const [pendientesCount, setPendientesCount] = useState(0);

  useEffect(() => {
    if (initialSubModulo === 'mesa_movilidad' && mostrarMesaMovilidad) {
      setSubModulo('mesa_movilidad');
    } else if (initialSubModulo && initialSubModulo !== 'mesa_movilidad') {
      setSubModulo(initialSubModulo);
    }
  }, [initialSubModulo, mostrarMesaMovilidad]);

  const refrescarContadorPendientes = async () => {
    try {
      const lista = await listarSolicitudesMovimientoDotacion({ periodo: periodoActivo });
      const abiertas = lista.filter(s =>
        ['PENDIENTE', 'EN_REVISION_UATP', 'VISADO_UATP'].includes(s.estadoRevision)
      ).length;
      setPendientesCount(abiertas);
    } catch {
      // Silencioso en caso de carga inicial
    }
  };

  useEffect(() => {
    void refrescarContadorPendientes();
  }, [periodoActivo, docentes.length, asistentes.length]);

  const handleDatosActualizados = async () => {
    await refrescarContadorPendientes();
    if (onRecargarDatos) {
      await onRecargarDatos();
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera del Módulo Mayor + Navegación de Submódulos */}
      <div className="card-elevated p-4 sm:p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Consolidación de Dotación SLEP {periodoActivo}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Módulo Operativo Central
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Revisión y aprobación de movimientos GDP / Art. 69, Mesa de Movilidad Territorial y Cierre Oficial DEP (PAL &amp; GDP).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSubModulo('solicitudes_gdp')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                subModulo === 'solicitudes_gdp'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Solicitudes &amp; Sanción GDP</span>
              {pendientesCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    subModulo === 'solicitudes_gdp'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {pendientesCount}
                </span>
              )}
            </button>

            {mostrarMesaMovilidad && (
              <button
                type="button"
                onClick={() => setSubModulo('mesa_movilidad')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  subModulo === 'mesa_movilidad'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Mesa de Movilidad</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubModulo('cierre_dep')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                subModulo === 'cierre_dep'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Cierre Oficial DEP (PAL &amp; GDP)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido del Submódulo Activo */}
      {subModulo === 'solicitudes_gdp' && (
        <BandejaSolicitudesGdpPanel
          periodoActivo={periodoActivo}
          establecimientos={establecimientos}
          usuarioActual={usuarioActual}
          onDatosActualizados={handleDatosActualizados}
          onIrAMesaMovilidad={mostrarMesaMovilidad ? () => setSubModulo('mesa_movilidad') : undefined}
        />
      )}

      {subModulo === 'mesa_movilidad' && mostrarMesaMovilidad && (
        <MesaMovilidadView
          colegios={establecimientos}
          docentesTerritorio={docentes}
          asignacionesTerritorio={asignaciones}
          asistentesTerritorio={asistentes}
          cursosTerritorio={cursos}
          periodoActivo={periodoActivo}
          usuarioActual={usuarioActual}
          onDatosActualizados={handleDatosActualizados}
        />
      )}

      {subModulo === 'cierre_dep' && (
        <div className="space-y-4">
          {pendientesCount > 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Atención: Existen <strong>{pendientesCount}</strong> solicitud(es) de movimiento GDP / Art. 69 aún pendientes de sanción definitiva. Las planillas exportadas reflejarán su estado actual (&ldquo;Pendiente&rdquo;).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubModulo('solicitudes_gdp')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0"
              >
                Revisar Pendientes
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Sin solicitudes pendientes de sanción en este periodo. Listo para emisión de Planillas Oficiales PAL 2027 y GDP.</span>
            </div>
          )}

          <ConsolidadorMasterView
            establecimientos={establecimientos}
            docentes={docentes}
            asistentes={asistentes}
            cursos={cursos}
            diagnosticos={diagnosticos}
            asignaciones={asignaciones}
            onImportarCarteraSlep={onImportarCarteraSlep}
            onExportarExcel={onExportarExcel}
            onRecargarDatos={handleDatosActualizados}
            onGuardarColegio={onGuardarColegio}
            modoVista="cierre_dep"
          />
        </div>
      )}
    </div>
  );
};
