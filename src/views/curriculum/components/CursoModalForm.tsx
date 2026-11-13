import React, { useState, useEffect } from 'react';
import { Plus, X, Layers, School, BookOpen, AlertTriangle, CheckCircle2, Wrench, HeartHandshake, Briefcase, Baby } from 'lucide-react';
import { CursoSae, Establecimiento } from '../../../types';
import { resolvePerfilEstablecimiento } from '../../../utils/establishmentTypeHelpers';
import {
  NIVELES_REGULARES,
  NIVELES_TP_ESPECIALIDADES,
  NIVELES_MULTIGRADO_PRESETS,
  NIVELES_EPJA_OFICIALES,
  NIVELES_ESPECIAL_OFICIALES,
  NIVELES_LABORAL_OFICIALES,
  GRADOS_COMBINABLES,
  GRADOS_BASICA_ESPECIAL,
  PRESETS_BASICA_ESPECIAL_COMBINADA
} from '../types';
import { extraerGradosDeCurso } from '../../../services/combinacionCursosService';

const NIVELES_PARVULARIA_VTF_PRESETS = [
  { label: 'Sala Cuna Menor', edadMin: 3, edadMax: 11, cupoDefault: 20, esSalaCuna: true },
  { label: 'Sala Cuna Mayor', edadMin: 12, edadMax: 23, cupoDefault: 20, esSalaCuna: true },
  { label: 'Sala Cuna Heterogénea', edadMin: 3, edadMax: 23, cupoDefault: 20, esSalaCuna: true },
  { label: 'Nivel Medio Menor', edadMin: 24, edadMax: 35, cupoDefault: 28, esSalaCuna: false },
  { label: 'Nivel Medio Mayor', edadMin: 36, edadMax: 47, cupoDefault: 32, esSalaCuna: false },
  { label: 'Nivel Medio Mixto', edadMin: 24, edadMax: 47, cupoDefault: 30, esSalaCuna: false },
];

interface CursoModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  rbd: string;
  colegio?: Establecimiento;
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
  colegio,
  periodoActivo,
  cursosExistentes = [],
  onGuardarCurso,
  onCombinarCursos,
  onCursoCreado
}) => {
  const [categoria, setCategoria] = useState<'REGULAR' | 'TP' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA' | 'ESPECIAL' | 'LABORAL' | 'PARVULARIA_VTF'>('REGULAR');
  const [nivel, setNivel] = useState('1° Básico');
  const [edadMesesMinima, setEdadMesesMinima] = useState(24);
  const [edadMesesMaxima, setEdadMesesMaxima] = useState(35);
  const [tieneExtensionHoraria, setTieneExtensionHoraria] = useState(true);
  const [matriculaExtension, setMatriculaExtension] = useState(12);
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
  const [subTipoEspecial, setSubTipoEspecial] = useState<'PARVULARIA' | 'BASICA_COMBINADA'>('BASICA_COMBINADA');
  const [modoCombinadoEspecial, setModoCombinadoEspecial] = useState<'PRESET' | 'LIBRE'>('PRESET');
  const [presetEspecialSeleccionado, setPresetEspecialSeleccionado] = useState('1-2');
  const [gradosEspecialSeleccionados, setGradosEspecialSeleccionados] = useState<string[]>(['1° Básico Especial', '2° Básico Especial']);
  const [nombrePersonalizadoEspecial, setNombrePersonalizadoEspecial] = useState('');

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

  // Adaptar categoría inicial según perfil del establecimiento cuando abre el modal
  useEffect(() => {
    if (!isOpen || !colegio) return;
    const perfil = resolvePerfilEstablecimiento(colegio);
    if (perfil === 'JARDIN_SALA_CUNA') {
      const def = NIVELES_PARVULARIA_VTF_PRESETS[3];
      setCategoria('PARVULARIA_VTF');
      setNivel(def.label);
      setEdadMesesMinima(def.edadMin);
      setEdadMesesMaxima(def.edadMax);
      setCupoSae(def.cupoDefault);
      setMatriculaProyectada(24);
      setLetra('A');
      setRegimen('JEC');
      setTieneExtensionHoraria(true);
      setMatriculaExtension(10);
      setAlumnosNeet(0);
      setAlumnosNeep(0);
    } else if (perfil === 'LICEO_TP') {
      setCategoria('TP');
      setNivel(NIVELES_TP_ESPECIALIDADES[1]);
      setRegimen('JEC');
    } else if (perfil === 'ESCUELA_ESPECIAL') {
      setCategoria('ESPECIAL');
      setNivel('1° y 2° Básico Especial');
      setCupoSae(15);
      setMatriculaProyectada(15);
      setAlumnosNeep(15);
      setAlumnosNeet(0);
    } else if (perfil === 'EPJA') {
      setCategoria('EPJA');
      setNivel(NIVELES_EPJA_OFICIALES[0].id);
      setRegimen('No JEC');
    }
  }, [isOpen, colegio?.rbd]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let nivelFinal = nivel;
    let esMulti = false;
    let esComb = false;
    let tipoMod: NonNullable<CursoSae['tipoModalidad']> = 'REGULAR';

    if (categoria === 'PARVULARIA_VTF') {
      esMulti = false;
      esComb = false;
      nivelFinal = nivel;
      tipoMod = nivel.toLowerCase().includes('sala cuna') ? 'SALA_CUNA' : 'PARVULARIA_VTF';
    } else if (categoria === 'TP') {
      esMulti = false;
      tipoMod = 'MEDIA_TP';
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
      tipoMod = 'ESPECIAL';
      if (subTipoEspecial === 'PARVULARIA') {
        esMulti = false;
        esComb = false;
        nivelFinal = 'Educación Parvularia Especial (Decreto 83 / Decretos Supremos)';
      } else {
        esComb = gradosEspecialSeleccionados.length >= 2;
        esMulti = false;
        if (nombrePersonalizadoEspecial.trim()) {
          nivelFinal = nombrePersonalizadoEspecial.trim();
        } else if (modoCombinadoEspecial === 'PRESET') {
          const p = PRESETS_BASICA_ESPECIAL_COMBINADA.find(x => x.id === presetEspecialSeleccionado);
          nivelFinal = p ? p.label : `Básica Especial (${gradosEspecialSeleccionados.join(' - ')})`;
        } else {
          nivelFinal = gradosEspecialSeleccionados.length > 0
            ? `Básica Especial (${gradosEspecialSeleccionados.map(g => g.replace(' Especial', '')).join(' - ')})`
            : 'Educación Básica Especial (Decreto 83)';
        }
      }
    } else if (categoria === 'LABORAL') {
      esMulti = false;
      tipoMod = 'LABORAL';
      nivelFinal = nivel;
    }

    const nuevo: CursoSae = {
      id: `curso-${Date.now()}`,
      rbd,
      periodo: periodoActivo || 2027,
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
      gradosCombinados: categoria === 'COMBINADO' ? gradosCombinados : (categoria === 'ESPECIAL' && subTipoEspecial === 'BASICA_COMBINADA' && gradosEspecialSeleccionados.length >= 2 ? gradosEspecialSeleccionados : undefined),
      especialidadTp: categoria === 'TP' ? nivelFinal : undefined,
      edadMesesMinima: categoria === 'PARVULARIA_VTF' ? Number(edadMesesMinima) : undefined,
      edadMesesMaxima: categoria === 'PARVULARIA_VTF' ? Number(edadMesesMaxima) : undefined,
      tieneExtensionHoraria: categoria === 'PARVULARIA_VTF' ? tieneExtensionHoraria : undefined,
      matriculaExtension: categoria === 'PARVULARIA_VTF' && tieneExtensionHoraria ? Number(matriculaExtension) : undefined,
      horarioJornada: categoria === 'PARVULARIA_VTF' ? (tieneExtensionHoraria ? '08:30-19:30' : '08:30-16:30') : undefined
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
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => {
              const def = NIVELES_PARVULARIA_VTF_PRESETS[3];
              setCategoria('PARVULARIA_VTF');
              setNivel(def.label);
              setEdadMesesMinima(def.edadMin);
              setEdadMesesMaxima(def.edadMax);
              setCupoSae(def.cupoDefault);
              setMatriculaProyectada(24);
              setLetra('A');
              setRegimen('JEC');
              setAlumnosNeet(0);
              setAlumnosNeep(0);
            }}
            className={`py-1.5 px-1 rounded-lg transition-all text-center flex flex-col items-center gap-0.5 ${
              categoria === 'PARVULARIA_VTF'
                ? 'bg-white text-pink-950 shadow-sm font-bold border border-pink-300 ring-1 ring-pink-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Baby className="w-3.5 h-3.5 text-pink-600" />
            <span>Jardín VTF</span>
          </button>
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
              setSubTipoEspecial('BASICA_COMBINADA');
              setNivel('1° y 2° Básico Especial');
              setGradosEspecialSeleccionados(['1° Básico Especial', '2° Básico Especial']);
              setPresetEspecialSeleccionado('1-2');
              setNombrePersonalizadoEspecial('1° y 2° Básico Especial');
              setRegimen('JEC');
              setCupoSae(15);
              setMatriculaProyectada(15);
              setAlumnosNeep(15);
              setAlumnosNeet(0);
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
              setMatriculaProyectada(15);
              setAlumnosNeep(15);
              setAlumnosNeet(0);
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
          {categoria === 'PARVULARIA_VTF' && (
            <div className="space-y-3 p-3 bg-pink-50/70 rounded-xl border border-pink-200/80">
              <div>
                <label className="block text-xs font-bold text-pink-950 mb-1">
                  Nivel Parvulario BCEP 2018 (D.S. 115/2012)
                </label>
                <select
                  value={nivel}
                  onChange={e => {
                    const selected = NIVELES_PARVULARIA_VTF_PRESETS.find(p => p.label === e.target.value);
                    setNivel(e.target.value);
                    if (selected) {
                      setEdadMesesMinima(selected.edadMin);
                      setEdadMesesMaxima(selected.edadMax);
                      setCupoSae(selected.cupoDefault);
                      setMatriculaProyectada(Math.min(matriculaProyectada, selected.cupoDefault));
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-pink-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-pink-500"
                >
                  {NIVELES_PARVULARIA_VTF_PRESETS.map(p => (
                    <option key={p.label} value={p.label}>
                      {p.label} ({p.edadMin}–{p.edadMax} meses | Máx {p.cupoDefault})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-pink-900 mb-1">Edad Mínima (meses)</label>
                  <input
                    type="number"
                    min={0}
                    max={72}
                    value={edadMesesMinima}
                    onChange={e => setEdadMesesMinima(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pink-900 mb-1">Edad Máxima (meses)</label>
                  <input
                    type="number"
                    min={0}
                    max={72}
                    value={edadMesesMaxima}
                    onChange={e => setEdadMesesMaxima(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-pink-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tieneExtensionHoraria}
                    onChange={e => setTieneExtensionHoraria(e.target.checked)}
                    className="rounded text-pink-600 focus:ring-pink-500"
                  />
                  <span>Extensión Horaria (16:30–19:30)</span>
                </label>
                {tieneExtensionHoraria && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-pink-900">Matrícula Ext.:</span>
                    <input
                      type="number"
                      min={0}
                      max={32}
                      value={matriculaExtension}
                      onChange={e => setMatriculaExtension(Number(e.target.value))}
                      className="w-16 px-2 py-1 bg-white border border-pink-200 rounded text-xs font-mono font-bold text-center"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

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
            <div className="space-y-3 p-3.5 bg-teal-50/80 rounded-xl border border-teal-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-teal-950">
                  Educación Especial (Ordinario N° 05/1470 & Decreto N° 83/2015)
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-teal-100 text-teal-800 border border-teal-300">
                  Decreto 83 / 170
                </span>
              </div>

              {/* Selector de Subtipo de Educación Especial: Parvularia vs Básica */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-teal-100/60 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setSubTipoEspecial('BASICA_COMBINADA');
                    const p = PRESETS_BASICA_ESPECIAL_COMBINADA[0];
                    setPresetEspecialSeleccionado(p.id);
                    setGradosEspecialSeleccionados(p.grados);
                    setNombrePersonalizadoEspecial(p.label);
                    setNivel(p.label);
                    setCupoSae(15);
                    setMatriculaProyectada(15);
                    setAlumnosNeep(15);
                    setAlumnosNeet(0);
                  }}
                  className={`py-1.5 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1.5 ${
                    subTipoEspecial === 'BASICA_COMBINADA'
                      ? 'bg-white text-teal-950 shadow-xs'
                      : 'text-teal-700 hover:text-teal-900'
                  }`}
                >
                  <span>Básica Especial (Combinable)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubTipoEspecial('PARVULARIA');
                    setNivel('Educación Parvularia Especial (Decreto 83 / Decretos Supremos)');
                    setCupoSae(15);
                    setMatriculaProyectada(15);
                    setAlumnosNeep(15);
                    setAlumnosNeet(0);
                  }}
                  className={`py-1.5 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1.5 ${
                    subTipoEspecial === 'PARVULARIA'
                      ? 'bg-white text-teal-950 shadow-xs'
                      : 'text-teal-700 hover:text-teal-900'
                  }`}
                >
                  <span>Parvularia Especial</span>
                </button>
              </div>

              {subTipoEspecial === 'PARVULARIA' ? (
                <div className="p-2.5 bg-white rounded-lg border border-teal-200 text-xs">
                  <div className="font-bold text-teal-900 mb-0.5">Parvularia Especial (Atención Temprana / NT1 / NT2)</div>
                  <p className="text-[11px] text-slate-500">
                    Cubre estimulación temprana, medio menor, medio mayor, NT1 y NT2 con adecuación Decreto 83 (28 HA JEC / 22 HA No JEC).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Selector de Modo: Presets por Ciclo vs Selección Libre */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-teal-900">Configuración de Grados de Básica Especial:</span>
                    <div className="flex rounded bg-teal-100/70 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setModoCombinadoEspecial('PRESET')}
                        className={`px-2 py-0.5 rounded transition-all ${
                          modoCombinadoEspecial === 'PRESET' ? 'bg-white text-teal-950 shadow-2xs' : 'text-teal-700'
                        }`}
                      >
                        Por Ciclos Oficiales
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoCombinadoEspecial('LIBRE')}
                        className={`px-2 py-0.5 rounded transition-all ${
                          modoCombinadoEspecial === 'LIBRE' ? 'bg-white text-teal-950 shadow-2xs' : 'text-teal-700'
                        }`}
                      >
                        Selección Libre (Checkboxes)
                      </button>
                    </div>
                  </div>

                  {modoCombinadoEspecial === 'PRESET' ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-teal-950 mb-1">
                        Selecciona Ciclo o Combinación Típica de Básica Especial:
                      </label>
                      <select
                        value={presetEspecialSeleccionado}
                        onChange={e => {
                          const val = e.target.value;
                          setPresetEspecialSeleccionado(val);
                          const p = PRESETS_BASICA_ESPECIAL_COMBINADA.find(x => x.id === val);
                          if (p) {
                            setGradosEspecialSeleccionados(p.grados);
                            setNombrePersonalizadoEspecial(p.label);
                            setNivel(p.label);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
                      >
                        {PRESETS_BASICA_ESPECIAL_COMBINADA.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.label} ({p.grados.length} grados)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1.5">
                        Selecciona los Grados Especiales a Combinar en la Misma Aula ({gradosEspecialSeleccionados.length} seleccionados):
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto bg-white p-2.5 rounded-lg border border-teal-200 text-xs">
                        {GRADOS_BASICA_ESPECIAL.map(g => {
                          const checked = gradosEspecialSeleccionados.includes(g);
                          return (
                            <label
                              key={g}
                              className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer transition-colors ${
                                checked ? 'bg-teal-50 font-bold text-teal-950 border border-teal-200' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  let updated: string[];
                                  if (e.target.checked) {
                                    updated = [...gradosEspecialSeleccionados, g];
                                  } else {
                                    updated = gradosEspecialSeleccionados.filter(x => x !== g);
                                  }
                                  // Ordenar según el orden de GRADOS_BASICA_ESPECIAL
                                  updated.sort((a, b) => GRADOS_BASICA_ESPECIAL.indexOf(a) - GRADOS_BASICA_ESPECIAL.indexOf(b));
                                  setGradosEspecialSeleccionados(updated);
                                  const autoNombre = updated.length > 0
                                    ? `Básica Especial (${updated.map(x => x.replace(' Especial', '')).join(' - ')})`
                                    : 'Educación Básica Especial';
                                  setNombrePersonalizadoEspecial(autoNombre);
                                  setNivel(autoNombre);
                                }}
                                className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                              />
                              <span className="truncate">{g}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nombre descriptivo del curso especial resultante */}
                  <div>
                    <label className="block text-[11px] font-bold text-teal-950 mb-1">
                      Nombre Descriptivo del Curso Especial (Plan Decreto 83):
                    </label>
                    <input
                      type="text"
                      value={nombrePersonalizadoEspecial}
                      onChange={e => {
                        setNombrePersonalizadoEspecial(e.target.value);
                        setNivel(e.target.value);
                      }}
                      placeholder="Ej. 1° y 2° Básico Especial"
                      className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-bold text-teal-950 focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="flex items-center justify-between mt-1 text-[10px] text-teal-800">
                      <span>✓ Aplica Plan Oficial Básica Especial (38 HA JEC / 30 HA No JEC)</span>
                      <span>{gradosEspecialSeleccionados.length} grados combinados</span>
                    </div>
                  </div>
                </div>
              )}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <option value="JEC">JEC (Completa)</option>
                <option value="No JEC">Media Jornada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Proporción Ley 20.903</label>
              <select
                value={regimenProporcion}
                onChange={e => setRegimenProporcion(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="65_35">65/35 (General)</option>
                <option value="60_40">60/40 (Vulnerable &ge;80%)</option>
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

          {categoria === 'PARVULARIA_VTF' ? (
            <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-200 text-[11px] text-pink-900">
              <strong>Coeficiente Normativo D.S. 115/2012:</strong>{' '}
              {nivel.toLowerCase().includes('sala cuna')
                ? '1 Educadora cada 42 lactantes + 1 Técnico cada 7 lactantes.'
                : '1 Educadora cada 32 párvulos + 1 Técnico cada 25–32 párvulos.'}{' '}
              Además, la jornada completa de funcionamiento (08:30–19:30) considera cobertura de turnos en la pestaña Gestión Jardín.
            </div>
          ) : (categoria === 'ESPECIAL' || categoria === 'LABORAL') ? (
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-teal-950 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-teal-600" />
                  {categoria === 'LABORAL' ? 'Distribución Estudiantes Nivel Laboral (Decreto 87 / 170)' : 'Distribución Estudiantes Educación Especial (Decreto 83 / 170)'}
                </span>
                <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                  100% Permanentes (NEEP)
                </span>
              </div>
              <p className="text-[11px] text-teal-900 leading-relaxed">
                {categoria === 'LABORAL'
                  ? <>Los talleres laborales de educación especial no contemplan estudiantes transitorios (NEET). Su capacidad normativa oficial es de <strong>15 estudiantes permanentes (NEEP)</strong>.</>
                  : <>Los cursos de educación especial exclusiva no matriculan estudiantes transitorios (NEET). Su capacidad normativa es de <strong>15 estudiantes permanentes (NEEP)</strong>.</>}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/80 p-2.5 rounded-lg border border-teal-200/60">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Transitorios (NEET)</label>
                  <div className="text-sm font-extrabold text-slate-400 mt-0.5">0 estudiantes</div>
                  <span className="text-[9px] text-slate-400">No aplica en cursos especiales</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-teal-300 shadow-2xs">
                  <label className="block text-[10px] font-bold text-teal-950 uppercase">Permanentes (NEEP)</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={alumnosNeep}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setAlumnosNeep(val);
                        setMatriculaProyectada(val);
                      }}
                      className="w-16 px-2 py-0.5 bg-teal-50 border border-teal-300 rounded text-xs font-black text-teal-950 text-center"
                    />
                    <span className="text-[11px] font-bold text-teal-900">estudiantes</span>
                  </div>
                  <span className="text-[9px] text-teal-700 font-medium">Matrícula completa del curso</span>
                </div>
              </div>
            </div>
          ) : (
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
          )}

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
