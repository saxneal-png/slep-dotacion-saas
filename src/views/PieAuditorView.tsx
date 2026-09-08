import React from 'react';
import { Sparkles, AlertCircle, CheckCircle, Users, Clock, ShieldCheck } from 'lucide-react';
import { Establecimiento, CursoSae, Docente } from '../types';
import {
  calcularDemandaNormativaPieCurso,
  autoAsignarHorasPieCursos
} from '@slep/mineduc-engine';

interface PieAuditorViewProps {
  colegio: Establecimiento | null;
  cursos: CursoSae[];
  docentes: Docente[];
  onGuardarCurso: (curso: CursoSae) => void;
}

export const PieAuditorView: React.FC<PieAuditorViewProps> = ({
  colegio,
  cursos,
  docentes,
  onGuardarCurso
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
    const dem = calcularDemandaNormativaPieCurso(c.alumnosNeet, c.alumnosNeep, isJec);
    return { curso: c, demanda: dem };
  });

  const totalDemandaEdDiferencial = demandasCursos.reduce((sum, d) => sum + d.demanda.horasDiferencialDecimal, 0);
  const totalDemandaPae = demandasCursos.reduce((sum, d) => sum + d.demanda.horasPaeDecimal, 0);
  const totalDemandaColab = demandasCursos.reduce((sum, d) => sum + d.demanda.horasTrabajoColaborativoCronologicas, 0);
  const totalHorasPieGeneral = totalDemandaEdDiferencial + totalDemandaPae;

  // Docentes PIE disponibles en el establecimiento
  const docentesDiferenciales = docentes.filter(d => d.estamento === 'DOCENTE_DIFERENCIAL');
  const profesionalesPae = docentes.filter(d => d.estamento === 'PROFESIONAL_PAE');

  const horasContratadasDiferencial = docentesDiferenciales.reduce((s, d) => s + d.horasContrato, 0);
  const horasContratadasPae = profesionalesPae.reduce((s, d) => s + d.horasContrato, 0);

  const balanceDiferencial = horasContratadasDiferencial - totalDemandaEdDiferencial;
  const balancePae = horasContratadasPae - totalDemandaPae;

  return (
    <div className="space-y-6">
      {/* Banner Decreto 170 y Ordinario 2398 */}
      <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-600/30 border border-orange-500/40 text-orange-400 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Normativa Oficial Decreto 170/2009 & Ordinario N° 2398 MINEDUC
            </div>
            <h2 className="text-xl font-bold text-white mt-2">
              Auditoría y Cuadre de Horas PIE - {colegio.nombre}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Cálculo normativo exacto de demanda de Educadores Diferenciales, Profesionales Asistentes PAE
              (fonoaudiología, psicología, terapia ocupacional) y las 3.0 horas obligatorias de Trabajo Colaborativo / Co-docencia (Art. 86).
            </p>
          </div>

          <div className="flex gap-3">
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-center min-w-[120px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Demanda Diferencial</div>
              <div className="text-lg font-black text-orange-400">{totalDemandaEdDiferencial.toFixed(1)}h</div>
              <div className={`text-[10px] font-bold ${balanceDiferencial >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {balanceDiferencial >= 0 ? `+${balanceDiferencial.toFixed(1)}h Superávit` : `${balanceDiferencial.toFixed(1)}h Déficit`}
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-center min-w-[120px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Demanda PAE</div>
              <div className="text-lg font-black text-blue-400">{totalDemandaPae.toFixed(1)}h</div>
              <div className={`text-[10px] font-bold ${balancePae >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {balancePae >= 0 ? `+${balancePae.toFixed(1)}h Superávit` : `${balancePae.toFixed(1)}h Déficit`}
              </div>
            </div>
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
                <th className="px-4 py-3">Cumplimiento Aforo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {demandasCursos.map(({ curso, demanda }) => (
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
                      max="5"
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
                    3.0 hrs
                  </td>

                  <td className="px-4 py-3 text-center font-black text-[#002B49]">
                    {demanda.horasTotalCronologicas} hrs
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ficha de Docentes PIE Disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
            <span>Docentes Educación Diferencial ({docentesDiferenciales.length})</span>
            <span className="text-xs text-orange-600 font-bold">{horasContratadasDiferencial} hrs contratadas</span>
          </h3>

          <div className="space-y-2 text-xs">
            {docentesDiferenciales.length === 0 ? (
              <p className="text-slate-400 italic">No hay educadores diferenciales registrados.</p>
            ) : (
              docentesDiferenciales.map(d => (
                <div key={d.id} className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">{d.nombres} {d.apellidos}</div>
                    <div className="text-[10px] text-slate-500">RUN: {d.run} • {d.calidadJuridica}</div>
                  </div>
                  <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border">
                    {d.horasContrato} hrs
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
              profesionalesPae.map(d => (
                <div key={d.id} className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">{d.nombres} {d.apellidos}</div>
                    <div className="text-[10px] text-slate-500">RUN: {d.run} • {d.titulo || d.estamento}</div>
                  </div>
                  <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border">
                    {d.horasContrato} hrs
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
