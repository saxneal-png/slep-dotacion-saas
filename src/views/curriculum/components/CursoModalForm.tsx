import React, { useState, useEffect } from 'react';
import { Plus, X, Layers, School, BookOpen, AlertTriangle, CheckCircle2, Wrench, HeartHandshake, Briefcase } from 'lucide-react';
import { CursoSae } from '../../../types';
import {
  NIVELES_REGULARES,
  NIVELES_TP_ESPECIALIDADES,
  NIVELES_MULTIGRADO_PRESETS,
  NIVELES_EPJA_OFICIALES,
  NIVELES_ESPECIAL_OFICIALES,
  NIVELES_LABORAL_OFICIALES,
  GRADOS_COMBINABLES
} from '../types';
import { extraerGradosDeCurso } from '../../../services/combinacionCursosService';

interface CursoModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  rbd: string;
  periodoActivo: number;
  cursosExistentes?: CursoSae[];
  onGuardarCurso: (curso: CursoSae) => void;
  onCombinarCursos?: (cursosIds: string[], nuevoCurso: CursoSae) => Promise<void> | void;
  onCursoCreado: (cursoId: string) => void;
}

export const CursoModalForm: React.FC<CursoModalFormProps> = ({
  isOpen,
  onClose,
  rbd,
  periodoActivo,
  cursosExistentes = [],
  onGuardarCurso,
  onCombinarCursos,
  onCursoCreado
}) => {
  const [categoria, setCategoria] = useState<'REGULAR' | 'TP' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA' | 'ESPECIAL' | 'LABORAL'>('REGULAR');
  const [nivel, setNivel] = useState('1° Básico');
  const [gradosCombinados, setGradosCombinados] = useState<string[]>(['1° Básico', '2° Básico']);
  const [cursosExistentesSeleccionados, setCursosExistentesSeleccionados] = useState<string[]>([]);
  const [modoCombinado, setModoCombinado] = useState<'EXISTENTES' | 'NUEVO'>('EXISTENTES');
  const [nombreCombinado, setNombreCombinado] = useState('');
  const [letra, setLetra] = useState('A');
  const [regimen, setRegimen] = useState<'JEC' | 'No JEC'>('JEC');
  const [regimenProporcion, setRegimenProporcion] = useState<'65_35' | '60_40'>('65_35');
  const [cupoSae, setCupoSae] = useState(38);
  const [matriculaProyectada, setMatriculaProyectada] = useState(35);
  const [alumnosNeet, setAlumnosNeet] = useState(5);
  const [alumnosNeep, setAlumnosNeep] = useState(2);

  // Cuando se seleccionan cursos existentes a combinar, calcular sumatorias automáticamente
  useEffect(() => {
    if (categoria === 'COMBINADO' && modoCombinado === 'EXISTENTES' && cursosExistentesSeleccionados.length > 0) {
      const seleccionados = cursosExistentes.filter(c => cursosExistentesSeleccionados.includes(c.id));
      const totMat = seleccionados.reduce((s, c) => s + (c.matriculaProyectada || 0), 0);
      const totCupo = seleccionados.reduce((s, c) => s + (c.cupoSae || 0), 0);
      const totNeet = seleccionados.reduce((s, c) => s + (c.alumnosNeet || 0), 0);
      const totNeep = seleccionados.reduce((s, c) => s + (c.alumnosNeep || 0), 0);
      
      const todosGrados: string[] = [];
      for (const c of seleccionados) {
        for (const g of extraerGradosDeCurso(c)) {
          if (!todosGrados.includes(g)) todosGrados.push(g);
        }
      }

      setMatriculaProyectada(totMat);
      setCupoSae(totCupo);
      setAlumnosNeet(totNeet);
      setAlumnosNeep(totNeep);
      setGradosCombinados(todosGrados);
      setLetra('U');
      if (seleccionados.some(c => c.regimen === 'JEC')) setRegimen('JEC');
      if (!nombreCombinado) {
        setNombreCombinado(todosGrados.length <= 3 ? `Curso Combinado (${todosGrados.join(' - ')})` : `Multigrado (${todosGrados[0]} a ${todosGrados[todosGrados.length - 1]})`);
      }
    }
  }, [cursosExistentesSeleccionados, categoria, modoCombinado]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let nivelFinal = nivel;
    let esMulti = false;
    let esComb = false;
    let tipoMod: 'REGULAR' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA_BASICA' | 'EPJA_MEDIA_HC' | 'EPJA_MEDIA_TP' | 'ESPECIAL' | 'LABORAL' = 'REGULAR';

    if (categoria === 'TP') {
      esMulti = false;
      tipoMod = 'REGULAR';
      nivelFinal = nivel;
    } else if (categoria === 'MULTIGRADO') {
      esMulti = true;
      tipoMod = 'MULTIGRADO';
      nivelFinal = nivel;
    } else if (categoria === 'COMBINADO') {
      esComb = true;
      tipoMod = 'COMBINADO';
      nivelFinal = nombreCombinado.trim() || `Curso Combinado (${gradosCombinados.join(' - ')})`;
    } else if (categoria === 'EPJA') {
      esMulti = false;
      nivelFinal = nivel;
      if (nivel.includes('Media TP')) tipoMod = 'EPJA_MEDIA_TP';
      else if (nivel.includes('Media HC')) tipoMod = 'EPJA_MEDIA_HC';
      else tipoMod = 'EPJA_BASICA';
    } else if (categoria === 'ESPECIAL') {
      esMulti = false;
      tipoMod = 'ESPECIAL';
      nivelFinal = nivel;
    } else if (categoria === 'LABORAL') {
      esMulti = false;
      tipoMod = 'LABORAL';
      nivelFinal = nivel;
    }

    const nuevo: CursoSae = {
      id: `curso-${Date.now()}`,
      rbd,
      periodo: periodoActivo,
      nivel: nivelFinal,
      letra: letra.trim().toUpperCase() || 'U',
      regimen,
      regimenProporcion,
      cupoSae: Number(cupoSae),
      matriculaProyectada: Number(matriculaProyectada),
      alumnosNeet: Number(alumnosNeet),
      alumnosNeep: Number(alumnosNeep),
      esMultigrado: esMulti,
      esCombinado: esComb,
      tipoModalidad: tipoMod,
      gradosCombinados: categoria === 'COMBINADO' ? gradosCombinados : undefined,
      especialidadTp: categoria === 'TP' ? nivelFinal : undefined
    };

    if (categoria === 'COMBINADO' && modoCombinado === 'EXISTENTES' && cursosExistentesSeleccionados.length >= 2 && onCombinarCursos) {
      if (confirm(`¿Confirmas combinar los ${cursosExistentesSeleccionados.length} cursos seleccionados en "${nuevo.nivel} ${nuevo.letra}"? Los cursos de origen se fusionarán.`)) {
        await onCombinarCursos(cursosExistentesSeleccionados, nuevo);
      } else {
        return;
      }
    } else {
      onGuardarCurso(nuevo);
      onCursoCreado(nuevo.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-600" />
              Agregar Nuevo Curso o Modalidad
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura cursos regulares, TP, multigrado rural, EPJA o educación especial / laboral (Ord. 1470 & Dec. 83/87).
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas Selectoras de Tipo de Curso */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setCategoria('REGULAR');
              setNivel('1° Básico');
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'REGULAR'
                ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <School className="w-3.5 h-3.5 text-blue-600" />
            <span>Regular</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoria('TP');
              setNivel(NIVELES_TP_ESPECIALIDADES[1]);
              setRegimen('JEC');
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'TP'
                ? 'bg-white text-orange-950 shadow-sm font-bold border border-orange-300 ring-1 ring-orange-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-orange-600" />
            <span>Técnico TP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoria('MULTIGRADO');
              setNivel('Multigrado 1°-2° Básico');
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'MULTIGRADO'
                ? 'bg-white text-purple-900 shadow-sm font-bold border border-purple-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Multigrado</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoria('COMBINADO');
              setGradosCombinados(['1° Básico', '2° Básico']);
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'COMBINADO'
                ? 'bg-white text-indigo-900 shadow-sm font-bold border border-indigo-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Combinado</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoria('EPJA');
              setNivel(NIVELES_EPJA_OFICIALES[0].id);
              setRegimen('No JEC');
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'EPJA'
                ? 'bg-white text-amber-900 shadow-sm font-bold border border-amber-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>EPJA</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoria('ESPECIAL');
              setNivel(NIVELES_ESPECIAL_OFICIALES[1].id);
              setRegimen('JEC');
              setCupoSae(15);
              setMatriculaProyectada(12);
              setAlumnosNeep(8);
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'ESPECIAL'
                ? 'bg-white text-teal-900 shadow-sm font-bold border border-teal-300 ring-1 ring-teal-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />
            <span>Especial</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoria('LABORAL');
              setNivel(NIVELES_LABORAL_OFICIALES[0].id);
              setRegimen('JEC');
              setCupoSae(15);
              setMatriculaProyectada(12);
              setAlumnosNeep(10);
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'LABORAL'
                ? 'bg-white text-emerald-900 shadow-sm font-bold border border-emerald-300 ring-1 ring-emerald-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
            <span>Laboral</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {categoria === 'REGULAR' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nivel Educativo Regular</label>
              <select
                value={nivel}
                onChange={e => setNivel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-500 font-medium"
              >
                {NIVELES_REGULARES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          {categoria === 'TP' && (
            <div className="space-y-3 p-3 bg-orange-50/70 rounded-xl border border-orange-200/80">
              <div>
                <label className="block text-xs font-bold text-orange-950 mb-1">
                  Especialidad Técnico-Profesional (Decreto 0954/2015 & 452/2013)
                </label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-orange-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500"
                >
                  {NIVELES_TP_ESPECIALIDADES.map(tp => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
                <span className="text-[10px] text-orange-800 font-medium block mt-1">
                  Incluye módulos diferenciados de especialidad (22 HA) + Formación General (14 HA) + Libre Disposición (6 HA).
                </span>
              </div>
            </div>
          )}

          {categoria === 'MULTIGRADO' && (
            <div className="space-y-3 p-3 bg-purple-50/60 rounded-xl border border-purple-200/70">
              <div>
                <label className="block text-xs font-bold text-purple-900 mb-1">Plantilla de Multigrado (Escuelas Rurales)</label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs font-semibold text-purple-950 focus:ring-1 focus:ring-purple-500"
                >
                  {NIVELES_MULTIGRADO_PRESETS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          )}

          {categoria === 'COMBINADO' && (
            <div className="space-y-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70">
              {cursosExistentes.length >= 2 && (
                <div className="flex rounded-lg bg-indigo-100/70 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setModoCombinado('EXISTENTES')}
                    className={`flex-1 py-1 px-2 rounded-md transition-all ${
                      modoCombinado === 'EXISTENTES'
                        ? 'bg-white text-indigo-950 shadow-xs'
                        : 'text-indigo-700 hover:text-indigo-900'
                    }`}
                  >
                    Combinar Cursos Creados ({cursosExistentes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCombinado('NUEVO')}
                    className={`flex-1 py-1 px-2 rounded-md transition-all ${
                      modoCombinado === 'NUEVO'
                        ? 'bg-white text-indigo-950 shadow-xs'
                        : 'text-indigo-700 hover:text-indigo-900'
                    }`}
                  >
                    Crear Nuevo desde Cero
                  </button>
                </div>
              )}

              {modoCombinado === 'EXISTENTES' && cursosExistentes.length >= 2 ? (
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1.5">
                    Selecciona los cursos existentes a fusionar ({cursosExistentesSeleccionados.length} seleccionados):
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto bg-white p-2 rounded-lg border border-indigo-100 text-xs">
                    {cursosExistentes.map(c => {
                      const checked = cursosExistentesSeleccionados.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                            checked ? 'bg-indigo-50 font-bold text-indigo-950 border border-indigo-200' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                if (e.target.checked) setCursosExistentesSeleccionados(prev => [...prev, c.id]);
                                else setCursosExistentesSeleccionados(prev => prev.filter(id => id !== c.id));
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span>{c.nivel} {c.letra}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {c.matriculaProyectada} est. • {c.regimen}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {cursosExistentesSeleccionados.length >= 2 && (
                    <div className="mt-2 p-2 bg-indigo-100/60 rounded-md text-[11px] text-indigo-950 font-medium">
                      ✓ Fusionará <strong>{cursosExistentesSeleccionados.length} cursos</strong> sumando <strong>{matriculaProyectada} estudiantes</strong> y <strong>{alumnosNeet}T / {alumnosNeep}P</strong> PIE.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1.5">Selecciona los Grados a Combinar en la Misma Aula:</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto bg-white p-2.5 rounded-lg border border-indigo-100 text-xs">
                    {GRADOS_COMBINABLES.map(g => {
                      const checked = gradosCombinados.includes(g);
                      return (
                        <label key={g} className={`flex items-center gap-1.5 p-1 rounded cursor-pointer ${checked ? 'bg-indigo-50 font-semibold text-indigo-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) setGradosCombinados(prev => [...prev, g]);
                              else setGradosCombinados(prev => prev.filter(x => x !== g));
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{g}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Nombre Descriptivo del Curso Combinado</label>
                <input
                  type="text"
                  placeholder="Ej. Curso Combinado (1° Básico - 2° Básico)"
                  value={nombreCombinado}
                  onChange={e => setNombreCombinado(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-indigo-950 font-medium"
                />
              </div>
            </div>
          )}

          {categoria === 'EPJA' && (
            <div className="space-y-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200/70">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">Nivel Oficial EPJA (Bases Curriculares Decreto Supremo N° 10/2022)</label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-amber-950 focus:ring-1 focus:ring-amber-500"
                >
                  {NIVELES_EPJA_OFICIALES.map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {categoria === 'ESPECIAL' && (
            <div className="space-y-3 p-3 bg-teal-50/70 rounded-xl border border-teal-200/80">
              <div>
                <label className="block text-xs font-bold text-teal-950 mb-1">
                  Educación Especial (Ordinario N° 05/1470 & Decreto N° 83/2015)
                </label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
                >
                  {NIVELES_ESPECIAL_OFICIALES.map(esp => (
                    <option key={esp.id} value={esp.id}>{esp.label}</option>
                  ))}
                </select>
                <span className="text-[10px] text-teal-800 font-medium block mt-1">
                  Malla curricular bajo Decreto 83 con Plan Específico de Apoyo Especializado y adaptación curricular.
                </span>
              </div>
            </div>
          )}

          {categoria === 'LABORAL' && (
            <div className="space-y-3 p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
              <div>
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Nivel Laboral de Educación Especial (Decreto N° 87/1990 & Ord. 1470)
                </label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                >
                  {NIVELES_LABORAL_OFICIALES.map(lab => (
                    <option key={lab.id} value={lab.id}>{lab.label}</option>
                  ))}
                </select>
                <span className="text-[10px] text-emerald-800 font-medium block mt-1">
                  Formación en oficios y capacitación para la vida activa (38 HA JEC / 30 HA No JEC).
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Letra / Identificador</label>
              <input
                type="text"
                value={letra}
                onChange={e => setLetra(e.target.value.toUpperCase())}
                placeholder="A, B, U..."
                maxLength={4}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Régimen Horario</label>
              <select
                value={regimen}
                onChange={e => setRegimen(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="JEC">Jornada Escolar Completa (JEC)</option>
                <option value="No JEC">Media Jornada (Sin JEC)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cupo SAE</label>
              <input
                type="number"
                min={1}
                max={60}
                value={cupoSae}
                onChange={e => setCupoSae(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Matrícula Proyectada</label>
              <input
                type="number"
                min={1}
                max={60}
                value={matriculaProyectada}
                onChange={e => setMatriculaProyectada(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Alumnos NEET (Transitorios)</label>
              <input
                type="number"
                min={0}
                max={15}
                value={alumnosNeet}
                onChange={e => setAlumnosNeet(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Alumnos NEEP (Permanentes)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={alumnosNeep}
                onChange={e => setAlumnosNeep(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm"
            >
              Guardar Curso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
