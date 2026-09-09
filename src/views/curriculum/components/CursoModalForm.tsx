import React, { useState } from 'react';
import { Plus, X, Layers, School, BookOpen } from 'lucide-react';
import { CursoSae } from '../../../types';
import {
  NIVELES_REGULARES,
  NIVELES_MULTIGRADO_PRESETS,
  NIVELES_EPJA_OFICIALES,
  GRADOS_COMBINABLES
} from '../types';

interface CursoModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  rbd: string;
  periodoActivo: number;
  onGuardarCurso: (curso: CursoSae) => void;
  onCursoCreado: (cursoId: string) => void;
}

export const CursoModalForm: React.FC<CursoModalFormProps> = ({
  isOpen,
  onClose,
  rbd,
  periodoActivo,
  onGuardarCurso,
  onCursoCreado
}) => {
  const [categoria, setCategoria] = useState<'REGULAR' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA'>('REGULAR');
  const [nivel, setNivel] = useState('1° Básico');
  const [gradosCombinados, setGradosCombinados] = useState<string[]>(['1° Básico', '2° Básico']);
  const [nombreCombinado, setNombreCombinado] = useState('');
  const [letra, setLetra] = useState('A');
  const [regimen, setRegimen] = useState<'JEC' | 'No JEC'>('JEC');
  const [regimenProporcion, setRegimenProporcion] = useState<'65_35' | '60_40'>('65_35');
  const [cupoSae, setCupoSae] = useState(38);
  const [matriculaProyectada, setMatriculaProyectada] = useState(35);
  const [alumnosNeet, setAlumnosNeet] = useState(5);
  const [alumnosNeep, setAlumnosNeep] = useState(2);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let nivelFinal = nivel;
    let esMulti = false;
    let esComb = false;
    let tipoMod: 'REGULAR' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA_BASICA' | 'EPJA_MEDIA_HC' | 'EPJA_MEDIA_TP' | 'ESPECIAL' = 'REGULAR';

    if (categoria === 'MULTIGRADO') {
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
      gradosCombinados: categoria === 'COMBINADO' ? gradosCombinados : undefined
    };

    onGuardarCurso(nuevo);
    onCursoCreado(nuevo.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-600" />
              Agregar Nuevo Curso o Combinación
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura cursos regulares, multigrado rural, combinados o educación de personas jóvenes y adultas (EPJA).
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas Selectoras de Tipo de Curso */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setCategoria('REGULAR');
              setNivel('1° Básico');
            }}
            className={`py-2 px-1.5 rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
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
              setCategoria('MULTIGRADO');
              setNivel('Multigrado 1°-2° Básico');
            }}
            className={`py-2 px-1.5 rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
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
            className={`py-2 px-1.5 rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
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
              setNivel('EPJA Básica - 1° Nivel Básico (1° a 4° Básico)');
              setRegimen('No JEC');
            }}
            className={`py-2 px-1.5 rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
              categoria === 'EPJA'
                ? 'bg-white text-amber-900 shadow-sm font-bold border border-amber-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>EPJA</span>
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
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Nombre Descriptivo del Curso Combinado</label>
                <input
                  type="text"
                  placeholder="Ej. Combinado Parvularia y 1° Básico"
                  value={nombreCombinado}
                  onChange={e => setNombreCombinado(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-indigo-950 font-medium"
                />
              </div>
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
            </div>
          )}

          {categoria === 'EPJA' && (
            <div className="space-y-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200/70">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">Nivel Oficial EPJA (Decretos 584 / 239)</label>
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
