import React, { useState } from 'react';
import { LayoutGrid, Plus, AlertTriangle, CheckCircle2, Info, Building, Trash2, Edit } from 'lucide-react';
import { Establecimiento, SalaInfraestructura, CursoSae } from '../types';
import { evaluarCapacidadSaeYInfraestructura } from '@slep/mineduc-engine';

interface SalasSaeViewProps {
  colegio: Establecimiento | null;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  onGuardarSala: (sala: SalaInfraestructura) => void;
  onEliminarSala: (id: string) => void;
  onGuardarCurso: (curso: CursoSae) => void;
}

export const SalasSaeView: React.FC<SalasSaeViewProps> = ({
  colegio,
  salas,
  cursos,
  onGuardarSala,
  onEliminarSala,
  onGuardarCurso
}) => {
  const [modalSalaOpen, setModalSalaOpen] = useState(false);
  const [editingSala, setEditingSala] = useState<SalaInfraestructura | null>(null);
  const [nombreSala, setNombreSala] = useState('');
  const [pabellon, setPabellon] = useState('');
  const [superficieM2, setSuperficieM2] = useState(45);
  const [tipoSala, setTipoSala] = useState<'REGULAR' | 'PARVULARIA' | 'TALLER'>('REGULAR');

  if (!colegio) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Selecciona un establecimiento en la barra superior para gestionar sus salas e infraestructura.
      </div>
    );
  }

  const abrirModalNueva = () => {
    setEditingSala(null);
    setNombreSala(`Sala ${salas.length + 1}`);
    setPabellon('');
    setSuperficieM2(45);
    setTipoSala('REGULAR');
    setModalSalaOpen(true);
  };

  const abrirModalEditar = (s: SalaInfraestructura) => {
    setEditingSala(s);
    setNombreSala(s.nombreSala);
    setPabellon(s.pabellon || '');
    setSuperficieM2(s.superficieM2);
    setTipoSala(s.tipo);
    setModalSalaOpen(true);
  };

  const handleGuardarSala = (e: React.FormEvent) => {
    e.preventDefault();
    const factor = tipoSala === 'PARVULARIA' ? 1.5 : tipoSala === 'TALLER' ? 1.8 : 1.1;
    const aforo = Math.floor(superficieM2 / factor);
    const nombreFinal = nombreSala.trim() || (editingSala ? editingSala.nombreSala : `Sala ${salas.length + 1}`);

    const salaObj: SalaInfraestructura = {
      id: editingSala ? editingSala.id : `sala-${Date.now()}`,
      rbd: colegio.rbd,
      nombreSala: nombreFinal,
      pabellon: pabellon.trim() || undefined,
      superficieM2: Number(superficieM2) || 45,
      tipo: tipoSala,
      aforoMaximo: editingSala && editingSala.aforoMaximo ? editingSala.aforoMaximo : aforo
    };
    onGuardarSala(salaObj);
    setEditingSala(null);
    setNombreSala('');
    setPabellon('');
    setSuperficieM2(45);
    setModalSalaOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Banner Informativo Decreto 548 */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-orange-400 text-xs font-bold uppercase tracking-wider">
            Normativa de Infraestructura Escolar & SAE
          </span>
          <h2 className="text-xl font-bold text-white mt-0.5">
            Salas, Aforo Normativo (Dec. 548) y Cupos SAE - {colegio.nombre}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Regla de Oro MINEDUC: 1.1 m² por estudiante en aula regular y 1.5 m² en educación parvularia.
            El sistema cruza automáticamente la capacidad física real de la sala con los cupos declarados en el SAE para fijar techos operativos y alertar sobrecupos.
          </p>
        </div>

        <button
          onClick={abrirModalNueva}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Sala / Espacio</span>
        </button>
      </div>

      {/* Grilla Comparativa de Cursos, Salas y Cupos SAE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-orange-600" />
            Matriz de Ocupación por Curso: Sala Física vs. Cupo SAE vs. Matrícula
          </h3>
          <span className="text-xs text-slate-500">
            {cursos.length} cursos registrados en {colegio.nombre}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b text-[11px]">
              <tr>
                <th className="px-4 py-3">Curso</th>
                <th className="px-4 py-3">Sala Asignada</th>
                <th className="px-4 py-3 text-center">Superficie m²</th>
                <th className="px-4 py-3 text-center">Aforo Físico (1.1m²)</th>
                <th className="px-4 py-3 text-center">Cupo SAE Declarado</th>
                <th className="px-4 py-3 text-center">Matrícula Proyectada</th>
                <th className="px-4 py-3 text-center">Estado y Diagnóstico</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {cursos.map(curso => {
                const salaAsoc = salas.find(s => s.id === curso.salaId) || {
                  id: 'sin-sala',
                  rbd: colegio.rbd,
                  nombreSala: 'Sin Sala Asignada',
                  superficieM2: 45,
                  tipo: 'REGULAR' as const,
                  aforoMaximo: 40
                };

                const ev = evaluarCapacidadSaeYInfraestructura(
                  `${curso.nivel} ${curso.letra}`,
                  salaAsoc,
                  curso.cupoSae,
                  curso.matriculaProyectada
                );

                return (
                  <tr key={curso.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {curso.nivel} {curso.letra}
                      <span className="block text-[10px] font-normal text-slate-400">{curso.regimen}</span>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={curso.salaId || ''}
                        onChange={e => {
                          onGuardarCurso({ ...curso, salaId: e.target.value || undefined });
                        }}
                        className="bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                      >
                        <option value="">-- Sin Sala --</option>
                        {salas.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.nombreSala} ({s.superficieM2}m² - Cap: {s.aforoMaximo})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 text-center font-medium">
                      {salaAsoc.superficieM2} m²
                    </td>

                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      {ev.aforoMaximoFisico} alumnos
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={curso.cupoSae}
                        onChange={e => {
                          onGuardarCurso({ ...curso, cupoSae: parseInt(e.target.value) || 0 });
                        }}
                        className="w-16 text-center border rounded px-1.5 py-0.5 font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={curso.matriculaProyectada}
                        onChange={e => {
                          onGuardarCurso({ ...curso, matriculaProyectada: parseInt(e.target.value) || 0 });
                        }}
                        className="w-16 text-center border rounded px-1.5 py-0.5 font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      {ev.estadoAforo === 'ALERTA_SOBRECUPO_FISICO' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          Hacinamiento Físico
                        </span>
                      )}
                      {ev.estadoAforo === 'EXCEDE_SAE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Excede Cupo SAE
                        </span>
                      )}
                      {ev.estadoAforo === 'SUBUTILIZADO' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Info className="w-3 h-3 text-blue-600" />
                          Subutilizado
                        </span>
                      )}
                      {ev.estadoAforo === 'OPTIMO' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Conforme a Norma
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="text-[10px] text-slate-500 max-w-xs text-left">
                        {ev.observaciones[0]}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de Salas Registradas del Colegio */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Building className="w-4 h-4 text-slate-600" />
          Inventario de Salas e Infraestructura Física ({salas.length} salas)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {salas.map(s => (
            <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-start hover:border-slate-300 transition-colors">
              <div>
                <div className="font-bold text-slate-800">{s.nombreSala}</div>
                {s.pabellon && <div className="text-slate-500 text-[10px]">{s.pabellon}</div>}
                <div className="mt-2 text-slate-600 space-y-0.5">
                  <div>Superficie: <span className="font-semibold">{s.superficieM2} m²</span></div>
                  <div>Aforo Normativo: <span className="font-bold text-orange-600">{s.aforoMaximo} alumnos</span></div>
                  <div>Tipo: <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border">{s.tipo}</span></div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => abrirModalEditar(s)}
                  className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-200 transition-colors"
                  title="Editar sala"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar la sala ${s.nombreSala}?`)) onEliminarSala(s.id);
                  }}
                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                  title="Eliminar sala"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Nueva / Editar Sala */}
      {modalSalaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {editingSala ? 'Editar Dependencia o Sala' : 'Registrar Nueva Sala o Espacio Físico'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {editingSala ? `Actualizando datos de ${editingSala.nombreSala}` : 'Ingresa los datos del espacio según Decreto 548.'}
            </p>

            <form onSubmit={handleGuardarSala} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre o Identificador de la Sala</label>
                <input
                  type="text"
                  autoFocus
                  value={nombreSala}
                  onChange={e => setNombreSala(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder={`Ej: Sala ${salas.length + 1}, Laboratorio Ciencias, Taller TP`}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Si lo dejas en blanco, se guardará automáticamente como <strong>"{editingSala ? editingSala.nombreSala : `Sala ${salas.length + 1}`}"</strong>.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pabellón o Ubicación</label>
                <input
                  type="text"
                  value={pabellon}
                  onChange={e => setPabellon(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Ej: Pabellón A (Segundo Piso)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Superficie Útil (m²) *</label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    step="0.5"
                    required
                    value={superficieM2}
                    onChange={e => setSuperficieM2(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Espacio *</label>
                  <select
                    value={tipoSala}
                    onChange={e => setTipoSala(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="REGULAR">Aula Común (1.1 m²)</option>
                    <option value="PARVULARIA">Parvularia (1.5 m²)</option>
                    <option value="TALLER">Taller / Lab (1.8 m²)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg text-amber-800 text-[11px]">
                Aforo físico calculado automáticamente: <strong>{Math.floor(superficieM2 / (tipoSala === 'PARVULARIA' ? 1.5 : tipoSala === 'TALLER' ? 1.8 : 1.1))} estudiantes</strong> (Decreto 548).
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSala(null);
                    setModalSalaOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow transition-colors"
                >
                  {editingSala ? 'Actualizar Sala' : 'Guardar Sala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
