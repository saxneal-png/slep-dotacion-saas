import React, { useMemo, useState, useRef } from 'react';
import {
  Search,
  X,
  UserCheck,
  GraduationCap,
  Briefcase,
  School,
  ShieldAlert,
  Eye,
  Users
} from 'lucide-react';
import type {
  DocenteConsolidadoTerritorial,
  AsistenteConsolidadoTerritorial,
  EstamentoAsistente
} from '../types';
import { coincideBusquedaFuncionario } from '../utils/searchUtils';

interface ConsolidadorBuscadorFuncionariosProps {
  docentesConsolidados: DocenteConsolidadoTerritorial[];
  asistentesConsolidados: AsistenteConsolidadoTerritorial[];
  onSelectDocente: (doc: DocenteConsolidadoTerritorial) => void;
  onSelectAsistente: (asis: AsistenteConsolidadoTerritorial) => void;
}

type FiltroTipoGlobal = 'todos' | 'docentes' | 'asistentes';

type ResultadoUnificado =
  | {
      tipo: 'DOCENTE';
      key: string;
      score: number;
      nombreOrden: string;
      docente: DocenteConsolidadoTerritorial;
      resumenFunciones: string;
    }
  | {
      tipo: 'ASISTENTE';
      key: string;
      score: number;
      nombreOrden: string;
      asistente: AsistenteConsolidadoTerritorial;
      resumenFunciones: string;
    };

const ESTAMENTO_ASISTENTE_CORTOS: Record<EstamentoAsistente, string> = {
  PROFESIONAL: 'Profesional',
  TECNICO: 'Técnico',
  ADMINISTRATIVO: 'Administrativo',
  AUXILIAR: 'Auxiliar',
  PARADOCENTE_INSPECTORIA: 'Administrativo'
};

function resumirFuncionesDocente(doc: DocenteConsolidadoTerritorial): {
  textoResumen: string;
  extrasBusqueda: string[];
} {
  const funcionesSet = new Set<string>();
  const asignaturasSet = new Set<string>();

  if (doc.titulo) funcionesSet.add(doc.titulo);

  for (const c of doc.contratos) {
    if (c.docente.cargoInstitucional) funcionesSet.add(c.docente.cargoInstitucional);
    if (c.docente.tipoCoordinacion) funcionesSet.add(`Coord. ${c.docente.tipoCoordinacion}`);
    if ((c.horasDirectivas || 0) > 0) funcionesSet.add(`Dirección (${c.horasDirectivas}h)`);
    if ((c.horasInspectorGeneral || 0) > 0) funcionesSet.add(`Inspectoría Gral (${c.horasInspectorGeneral}h)`);
    if ((c.horasTecnicoPedagogicas || 0) > 0) funcionesSet.add(`UTP (${c.horasTecnicoPedagogicas}h)`);
    if ((c.horasCoordinacion || 0) > 0) funcionesSet.add(`Coordinación (${c.horasCoordinacion}h)`);
    if ((c.horasTallerSep || 0) > 0) funcionesSet.add(`Taller SEP (${c.horasTallerSep}h)`);
    if ((c.horasTrabajoColaborativo || 0) > 0) funcionesSet.add(`PIE / Colab. (${c.horasTrabajoColaborativo}h)`);

    for (const f of c.funcionesNoAula || c.docente.funcionesNoAula || []) {
      const desc = f.nombre ? `${f.tipo.replace(/_/g, ' ')}: ${f.nombre}` : f.tipo.replace(/_/g, ' ');
      funcionesSet.add(desc);
    }

    for (const a of c.asignaciones) {
      if (a.asignatura) asignaturasSet.add(a.asignatura);
    }
  }

  const partesResumen: string[] = [];
  if (funcionesSet.size > 0) {
    partesResumen.push(Array.from(funcionesSet).slice(0, 3).join(' • '));
  }
  if (asignaturasSet.size > 0) {
    const asigs = Array.from(asignaturasSet);
    partesResumen.push(`Aula: ${asigs.slice(0, 3).join(', ')}${asigs.length > 3 ? ` (+${asigs.length - 3})` : ''}`);
  }

  return {
    textoResumen: partesResumen.join(' | ') || doc.estamentoPrincipal.replace(/_/g, ' '),
    extrasBusqueda: [
      ...Array.from(funcionesSet),
      ...Array.from(asignaturasSet),
      ...doc.colegiosNombres,
      doc.estamentoPrincipal.replace(/_/g, ' ')
    ]
  };
}

function resumirFuncionesAsistente(asis: AsistenteConsolidadoTerritorial): {
  textoResumen: string;
  extrasBusqueda: string[];
} {
  const descripciones: string[] = [];
  for (const c of asis.contratos) {
    if (c.asistente.descripcionFuncionGdp) descripciones.push(c.asistente.descripcionFuncionGdp);
    if (c.asistente.accionPmeSep) descripciones.push(c.asistente.accionPmeSep);
    if (c.asistente.accionPme) descripciones.push(c.asistente.accionPme);
  }

  const cargos = asis.cargosPrincipales.join(' • ') || 'Asistente de la Educación';
  const descPreview = descripciones[0] ? ` — ${descripciones[0].slice(0, 80)}${descripciones[0].length > 80 ? '...' : ''}` : '';

  return {
    textoResumen: `${cargos}${descPreview}`,
    extrasBusqueda: [
      ...asis.cargosPrincipales,
      ...descripciones,
      ...asis.colegiosNombres,
      ESTAMENTO_ASISTENTE_CORTOS[asis.estamentoPrincipal] || asis.estamentoPrincipal
    ]
  };
}

export const ConsolidadorBuscadorFuncionarios: React.FC<ConsolidadorBuscadorFuncionariosProps> = ({
  docentesConsolidados,
  asistentesConsolidados,
  onSelectDocente,
  onSelectAsistente
}) => {
  const [query, setQuery] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipoGlobal>('todos');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const docentesIndexados = useMemo(() => {
    return docentesConsolidados.map((d) => {
      const { textoResumen, extrasBusqueda } = resumirFuncionesDocente(d);
      return { docente: d, textoResumen, extrasBusqueda };
    });
  }, [docentesConsolidados]);

  const asistentesIndexados = useMemo(() => {
    return asistentesConsolidados.map((a) => {
      const { textoResumen, extrasBusqueda } = resumirFuncionesAsistente(a);
      return { asistente: a, textoResumen, extrasBusqueda };
    });
  }, [asistentesConsolidados]);

  const { resultadosVisibles, totalCoincidencias } = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return { resultadosVisibles: [] as ResultadoUnificado[], totalCoincidencias: 0 };
    }

    const matches: ResultadoUnificado[] = [];

    if (tipoFiltro === 'todos' || tipoFiltro === 'docentes') {
      for (const item of docentesIndexados) {
        const res = coincideBusquedaFuncionario(q, {
          run: item.docente.run,
          nombres: item.docente.nombres,
          apellidos: item.docente.apellidos,
          extras: item.extrasBusqueda
        });
        if (res.match) {
          matches.push({
            tipo: 'DOCENTE',
            key: `doc-${item.docente.run}-${item.docente.apellidos}`,
            score: res.score,
            nombreOrden: `${item.docente.apellidos} ${item.docente.nombres}`,
            docente: item.docente,
            resumenFunciones: item.textoResumen
          });
        }
      }
    }

    if (tipoFiltro === 'todos' || tipoFiltro === 'asistentes') {
      for (const item of asistentesIndexados) {
        const res = coincideBusquedaFuncionario(q, {
          run: item.asistente.run,
          nombres: item.asistente.nombres,
          apellidos: item.asistente.apellidos,
          extras: item.extrasBusqueda
        });
        if (res.match) {
          matches.push({
            tipo: 'ASISTENTE',
            key: `asis-${item.asistente.idKey}`,
            score: res.score,
            nombreOrden: `${item.asistente.apellidos} ${item.asistente.nombres}`,
            asistente: item.asistente,
            resumenFunciones: item.textoResumen
          });
        }
      }
    }

    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.nombreOrden.localeCompare(b.nombreOrden);
    });

    return {
      resultadosVisibles: matches.slice(0, 20),
      totalCoincidencias: matches.length
    };
  }, [query, tipoFiltro, docentesIndexados, asistentesIndexados]);

  const abrirResultado = (item: ResultadoUnificado) => {
    if (item.tipo === 'DOCENTE') {
      onSelectDocente(item.docente);
    } else {
      onSelectAsistente(item.asistente);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!query.trim()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setSelectedIndex(0);
    } else if (e.key === 'ArrowDown' && resultadosVisibles.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % resultadosVisibles.length);
    } else if (e.key === 'ArrowUp' && resultadosVisibles.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + resultadosVisibles.length) % resultadosVisibles.length);
    } else if (e.key === 'Enter' && resultadosVisibles[selectedIndex]) {
      e.preventDefault();
      abrirResultado(resultadosVisibles[selectedIndex]);
    }
  };

  const totalPersonal = docentesConsolidados.length + asistentesConsolidados.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Cabecera y Campo de Búsqueda Global */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#002B49] text-white">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Buscador Territorial de Funcionarios (Ficha y Funciones 360°)
              </h3>
              <p className="text-[11px] text-slate-500">
                Busca por nombre completo, apellidos, RUN (con o sin puntos/guion), cargo o establecimiento entre {totalPersonal} funcionarios del territorio.
              </p>
            </div>
          </div>

          {/* Selector de Estamento */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                setTipoFiltro('todos');
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                tipoFiltro === 'todos'
                  ? 'bg-white text-[#002B49] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Todos ({totalPersonal})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoFiltro('docentes');
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                tipoFiltro === 'docentes'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3 h-3" />
              <span>Docentes ({docentesConsolidados.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoFiltro('asistentes');
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                tipoFiltro === 'asistentes'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>Asistentes ({asistentesConsolidados.length})</span>
            </button>
          </div>
        </div>

        {/* Input Principal */}
        <div className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-xl border-2 border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Buscar docente o asistente de la educación por nombre o RUN"
            placeholder="Ej: María González, 15.234.567-8, 152345678, Psicólogo, UTP..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-colors"
              title="Limpiar búsqueda (ESC)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Panel de Resultados Instantáneos */}
      {query.trim().length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/50">
          <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              {totalCoincidencias === 0
                ? 'Sin coincidencias para tu búsqueda'
                : totalCoincidencias > resultadosVisibles.length
                ? `Mostrando los ${resultadosVisibles.length} resultados más relevantes de ${totalCoincidencias} coincidencias`
                : `${totalCoincidencias} ${totalCoincidencias === 1 ? 'funcionario encontrado' : 'funcionarios encontrados'}`}
            </span>
            {resultadosVisibles.length > 0 && (
              <span className="hidden sm:inline text-slate-400 font-mono">
                ↑↓ navegar • Enter abrir ficha • ESC limpiar
              </span>
            )}
          </div>

          {resultadosVisibles.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No se encontraron docentes ni asistentes de la educación que coincidan con <strong>&ldquo;{query}&rdquo;</strong>.
              Verifica la ortografía del nombre o prueba buscando solo los dígitos del RUN.
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80 max-h-[380px] overflow-y-auto">
              {resultadosVisibles.map((item, idx) => {
                const isSelected = idx === selectedIndex;

                if (item.tipo === 'DOCENTE') {
                  const d = item.docente;
                  return (
                    <div
                      key={item.key}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => abrirResultado(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          abrirResultado(item);
                        }
                      }}
                      className={`px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/90' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            <GraduationCap className="w-3 h-3" />
                            DOCENTE
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            {d.nombres} {d.apellidos}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            RUN: {d.run}
                          </span>
                          {d.excedeLimiteSlep && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                              <ShieldAlert className="w-3 h-3" /> Exceso &gt;44h (+{d.excesoHorasSlep}h)
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 truncate">
                          <span className="font-semibold text-slate-700">Funciones / Asignaturas:</span>{' '}
                          {item.resumenFunciones}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {d.contratos.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200"
                            >
                              <School className="w-3 h-3 text-slate-400" />
                              <span className="font-medium">{c.colegio.nombre}</span>
                              <strong className="font-mono text-blue-700">{c.docente.horasContrato}h</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                        <div className="text-right">
                          <span className={`text-sm font-black font-mono ${d.excedeLimiteSlep ? 'text-red-600' : 'text-slate-900'}`}>
                            {d.horasTotalesSlep} hrs
                          </span>
                          <span className="block text-[10px] text-slate-400">Total SLEP</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirResultado(item);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha y Funciones</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                const a = item.asistente;
                return (
                  <div
                    key={item.key}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => abrirResultado(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirResultado(item);
                      }
                    }}
                    className={`px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-50/90' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                          <UserCheck className="w-3 h-3" />
                          ASISTENTE • {ESTAMENTO_ASISTENTE_CORTOS[a.estamentoPrincipal] || a.estamentoPrincipal}
                        </span>
                        <span className="font-bold text-sm text-slate-900">
                          {a.nombres} {a.apellidos}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          RUN: {a.run}
                        </span>
                        {a.excedeLimiteSlep && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            <ShieldAlert className="w-3 h-3" /> Exceso &gt;44h (+{a.excesoHorasSlep}h)
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 truncate">
                        <span className="font-semibold text-slate-700">Cargo / Función:</span>{' '}
                        {item.resumenFunciones}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {a.contratos.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200"
                          >
                            <School className="w-3 h-3 text-slate-400" />
                            <span className="font-medium">{c.colegio.nombre}</span>
                            <strong className="font-mono text-amber-700">{c.horasContrato}h</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                      <div className="text-right">
                        <span className={`text-sm font-black font-mono ${a.excedeLimiteSlep ? 'text-red-600' : 'text-slate-900'}`}>
                          {a.horasTotalesSlep} hrs
                        </span>
                        <span className="block text-[10px] text-slate-400">Total SLEP</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirResultado(item);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Ficha y Funciones</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
