import React from 'react';
import { Sparkles, AlertCircle, CheckCircle, Users, Clock, ShieldCheck } from 'lucide-react';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, AsistenteEducacion } from '../types';
import {
  calcularDemandaNormativaPieCurso,
  autoAsignarHorasPieCursos,
  esModalidadAdultos
} from '@slep/mineduc-engine';

interface PieAuditorViewProps {
  colegio: Establecimiento | null;
  cursos: CursoSae[];
  docentes: Docente[];
  asistentes?: AsistenteEducacion[];
  asignaciones?: AsignacionHoraria[];
  onGuardarCurso: (curso: CursoSae) => void;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

export const PieAuditorView: React.FC<PieAuditorViewProps> = ({
  colegio,
  cursos,
  docentes,
  asistentes = [],
  asignaciones = [],
  onGuardarCurso,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  if (!colegio) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Selecciona un establecimiento en la barra superior.
      </div>
    );
  }

  // Demandas calculadas por curso
  const demandasCursos = cursos.map(c => {
    const isJec = c.regimen === 'JEC';
    const esEpja = esModalidadAdultos(c.nivel) || ((c as any).nombre ? esModalidadAdultos((c as any).nombre) : false);
    const dem = esEpja
      ? {
          horasTotalCronologicas: 0,
          horasDiferencialDecimal: 0,
          horasDiferencialHHMM: "00:00",
          horasPaeDecimal: 0,
          horasPaeHHMM: "00:00",
          horasTrabajoColaborativoCronologicas: 0,
          neetCount: c.alumnosNeet,
          neepCount: c.alumnosNeep,
          isJec,
          cumpleAforo: true,
          observacionNormativa: "EPJA no elegible para Programa de Integración Escolar (PIE)."
        }
      : calcularDemandaNormativaPieCurso(c.alumnosNeet, c.alumnosNeep, isJec);

    const asigsCurso = asignaciones.filter(a => a.cursoId === c.id);
    const asigsPie = asigsCurso.filter(a => {
      if (a.esTallerSep || (a.tipoApoyo && /sep/i.test(a.tipoApoyo))) return false;
      const doc = docentes.find(d => d.id === a.docenteId || d.id === a.coDocenteId);
      const esDocPie = doc && (doc.estamento === 'DOCENTE_DIFERENCIAL' || doc.estamento === 'PROFESIONAL_PAE');
      return Boolean(
        esDocPie ||
        (a.tipoApoyo && /pie|decreto 170|recurso|pae/i.test(a.tipoApoyo)) ||
        (a.asignatura && /pie|decreto 170|recurso/i.test(a.asignatura))
      );
    });
    const horasPieAsignadasCurso = asigsPie.reduce((s, a) => s + (a.horasCronologicasPie || a.horasPedagogicasAula * 0.75), 0);
    return { curso: c, demanda: dem, asigsPie, horasPieAsignadasCurso, esEpja };
  });

  const totalDemandaEdDiferencial = demandasCursos.reduce((sum, d) => sum + d.demanda.horasDiferencialDecimal, 0);
  const totalDemandaPae = demandasCursos.reduce((sum, d) => sum + d.demanda.horasPaeDecimal, 0);
  const totalDemandaColab = demandasCursos.reduce((sum, d) => sum + d.demanda.horasTrabajoColaborativoCronologicas, 0);
  const totalHorasPieGeneral = totalDemandaEdDiferencial + totalDemandaPae;
  const totalHorasPieAsignadas = demandasCursos.reduce((sum, d) => sum + d.horasPieAsignadasCurso, 0);

  // Docentes PIE disponibles en el establecimiento (Docentes Diferenciales)
  // Descuenta horas de coordinación PIE si estuviesen comprometidas en gestión no-aula
  const docentesDiferenciales = docentes
    .filter(d => d.estamento === 'DOCENTE_DIFERENCIAL')
    .map(d => {
      const hPie = (d.horasPieTitular || 0) + (d.horasPieContrata || 0);
      const horasTotal = hPie > 0 ? hPie : d.horasContrato;
      const horasCoord = d.horasCoordinacionPie || 0;
      const horasDirectasDisponibles = Math.max(0, horasTotal - horasCoord);
      return {
        ...d,
        horasTotal,
        horasCoord,
        horasDirectasDisponibles
      };
    });

  const horasContratadasDiferencial = docentesDiferenciales.reduce((s, d) => s + d.horasDirectasDisponibles, 0);
  const horasContratadasDiferencialBrutas = docentesDiferenciales.reduce((s, d) => s + d.horasTotal, 0);
  const horasCoordinacionDiferencial = docentesDiferenciales.reduce((s, d) => s + d.horasCoord, 0);

  // Profesionales PAE (Consolidación Oficial Decreto 170: Docentes PROFESIONAL_PAE + Asistentes PAE)
  // Imputa estrictamente las horas financiadas por Subvención PIE (no infla con horas SEP o Subv. General)
  const docentesPae = docentes
    .filter(d => d.estamento === 'PROFESIONAL_PAE')
    .map(d => {
      const hPie = (d.horasPieTitular || 0) + (d.horasPieContrata || 0);
      const horasPae = hPie > 0 ? hPie : d.horasContrato;
      return {
        id: d.id,
        run: d.run,
        nombre: `${d.nombres} ${d.apellidos}`,
        cargo: d.titulo || 'Profesional Asistente PAE',
        horasPae,
        horasContratoTotal: d.horasContrato,
        origen: 'Docentes'
      };
    });

  const asistentesPae = asistentes
    .filter(a => a.activo !== false && (a.esEquipoPie || (a.horasPieIndefinido || 0) + (a.horasPiePlazoFijo || 0) > 0))
    .map(a => {
      const hPie = (a.horasPieIndefinido || 0) + (a.horasPiePlazoFijo || 0);
      const horasPae = hPie > 0 ? hPie : a.horasContrato;
      return {
        id: a.id,
        run: a.run,
        nombre: `${a.nombres} ${a.apellidos}`,
        cargo: a.cargoFuncion || 'Profesional Asistente PAE',
        horasPae,
        horasContratoTotal: a.horasContrato,
        origen: 'Asistentes'
      };
    });

  const profesionalesPae = [...docentesPae, ...asistentesPae];
  const horasContratadasPae = profesionalesPae.reduce((s, p) => s + p.horasPae, 0);

  const balanceDiferencial = horasContratadasDiferencial - totalDemandaEdDiferencial;
  const balancePae = horasContratadasPae - totalDemandaPae;

  return (
    <div className="space-y-6">
      {/* Header Slim Dec. 170 (Tema adaptativo + KPIs compactos) */}
      <div className="card-elevated px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            Dec. 170 & Ord. 2398
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
            Auditoría y Cuadre PIE · {colegio.nombre}
          </h2>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold cursor-help"
            title="Cálculo normativo de demanda Ed. Diferencial, Profesionales PAE y 3.0h obligatorias de Trabajo Colaborativo / Co-docencia (Art. 86)."
          >
            ?
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Diferencial</span>
            <span className="text-sm font-black font-mono tabular-nums text-orange-600 dark:text-orange-400">{totalDemandaEdDiferencial.toFixed(1)}h</span>
            <span className={`text-[10px] font-bold font-mono tabular-nums ${balanceDiferencial >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {balanceDiferencial >= 0 ? `+${balanceDiferencial.toFixed(1)}h` : `${balanceDiferencial.toFixed(1)}h`}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">PAE</span>
            <span className="text-sm font-black font-mono tabular-nums text-blue-600 dark:text-blue-400">{totalDemandaPae.toFixed(1)}h</span>
            <span className={`text-[10px] font-bold font-mono tabular-nums ${balancePae >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {balancePae >= 0 ? `+${balancePae.toFixed(1)}h` : `${balancePae.toFixed(1)}h`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabla de Demanda PIE por Curso */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-600" />
            Matriz de Diagnóstico y Demanda PIE por Curso
          </h3>
          <span className="text-xs text-slate-500">
            {cursos.length} cursos integrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
              <tr>
                <th className="px-4 py-3">Curso</th>
                <th className="px-4 py-3 text-center">Jornada</th>
                <th className="px-4 py-3 text-center">Alumnos NEET (Máx 5)</th>
                <th className="px-4 py-3 text-center">Alumnos NEEP (Máx 2)</th>
                <th className="px-4 py-3 text-center bg-orange-50/50 text-orange-950 font-bold">Ed. Diferencial</th>
                <th className="px-4 py-3 text-center bg-blue-50/50 text-blue-950 font-bold">Asistente PAE</th>
                <th className="px-4 py-3 text-center">Trabajo Colab. (Art. 86)</th>
                <th className="px-4 py-3 text-center font-bold">Total Cronológico</th>
                <th className="px-4 py-3 text-center bg-emerald-50/50 text-emerald-950 font-bold">Horas Asignadas</th>
                <th className="px-4 py-3 text-center">Cobertura</th>
                <th className="px-4 py-3">Cumplimiento Aforo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {demandasCursos.map(({ curso, demanda, horasPieAsignadasCurso, asigsPie }) => {
                const diff = horasPieAsignadasCurso - demanda.horasTotalCronologicas;
                const porcentaje = demanda.horasTotalCronologicas > 0 
                  ? Math.round((horasPieAsignadasCurso / demanda.horasTotalCronologicas) * 100) 
                  : 100;

                return (
                  <tr key={curso.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {curso.nivel} {curso.letra}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                        {curso.regimen}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={curso.alumnosNeet}
                        onChange={e => {
                          onGuardarCurso({ ...curso, alumnosNeet: parseInt(e.target.value) || 0 });
                        }}
                        className={`w-14 text-center border rounded px-1.5 py-0.5 font-bold ${
                          curso.alumnosNeet > 5 ? 'border-red-500 bg-red-50 text-red-700' : 'text-slate-800'
                        }`}
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={curso.alumnosNeep}
                        onChange={e => {
                          onGuardarCurso({ ...curso, alumnosNeep: parseInt(e.target.value) || 0 });
                        }}
                        className={`w-14 text-center border rounded px-1.5 py-0.5 font-bold ${
                          curso.alumnosNeep > 2 ? 'border-red-500 bg-red-50 text-red-700' : 'text-slate-800'
                        }`}
                      />
                    </td>

                    <td className="px-4 py-3 text-center font-bold text-orange-700 bg-orange-50/30">
                      {demanda.horasDiferencialHHMM} hrs ({demanda.horasDiferencialDecimal}h)
                    </td>

                    <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/30">
                      {demanda.horasPaeHHMM} hrs ({demanda.horasPaeDecimal}h)
                    </td>

                    <td className="px-4 py-3 text-center font-semibold text-slate-700">
                      {demanda.horasTrabajoColaborativoCronologicas > 0 ? (
                        `${demanda.horasTrabajoColaborativoCronologicas.toFixed(1)} hrs`
                      ) : (
                        <span className="text-slate-400 font-normal">0.0 hrs</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center font-black text-[#002B49]">
                      {demanda.horasTotalCronologicas} hrs
                    </td>

                    <td className="px-4 py-3 text-center font-bold text-emerald-800 bg-emerald-50/30">
                      {horasPieAsignadasCurso > 0 ? `${horasPieAsignadasCurso.toFixed(1)} hrs` : <span className="text-slate-400 font-normal italic">0.0 hrs</span>}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {demanda.horasTotalCronologicas === 0 ? (
                        <span className="text-[10px] text-slate-400">Sin demanda</span>
                      ) : porcentaje >= 100 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {porcentaje}% Cubierto
                        </span>
                      ) : porcentaje > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {porcentaje}% Parcial
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          0% Sin Asignar
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {demanda.cumpleAforo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Aforo Decreto 170 OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 text-[11px] font-bold">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                          Aforo Excedido (Requiere Ord.)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ficha de Docentes PIE Disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
            <span>Docentes Educación Diferencial ({docentesDiferenciales.length})</span>
            <span className="text-xs text-orange-600 font-bold">
              {horasContratadasDiferencial} hrs disp. aula {horasCoordinacionDiferencial > 0 ? `(${horasContratadasDiferencialBrutas}h total)` : ''}
            </span>
          </h3>

          <div className="space-y-2 text-xs">
            {docentesDiferenciales.length === 0 ? (
              <p className="text-slate-400 italic">No hay educadores diferenciales registrados.</p>
            ) : (
              docentesDiferenciales.map(d => (
                <div key={d.id} className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">{d.nombres} {d.apellidos}</div>
                    <div className="text-[10px] text-slate-500">
                      RUN: {d.run} • {d.calidadJuridica}
                      {d.horasCoord > 0 ? ` • ${d.horasCoord}h Coordinación PIE` : ''}
                    </div>
                  </div>
                  <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border">
                    {d.horasDirectasDisponibles} hrs aula {d.horasCoord > 0 ? `(${d.horasTotal}h total)` : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
            <span>Profesionales Asistentes PAE ({profesionalesPae.length})</span>
            <span className="text-xs text-blue-600 font-bold">{horasContratadasPae} hrs contratadas</span>
          </h3>

          <div className="space-y-2 text-xs">
            {profesionalesPae.length === 0 ? (
              <p className="text-slate-400 italic">No hay profesionales asistentes registrados.</p>
            ) : (
              profesionalesPae.map(p => (
                <div key={p.id} className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">{p.nombre}</div>
                    <div className="text-[10px] text-slate-500">
                      RUN: {p.run} • {p.cargo} • <span className="font-medium text-slate-600">{p.origen}</span>
                      {p.horasContratoTotal > p.horasPae ? ` (Contrato: ${p.horasContratoTotal}h)` : ''}
                    </div>
                  </div>
                  <span className="font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {p.horasPae} hrs PIE
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
