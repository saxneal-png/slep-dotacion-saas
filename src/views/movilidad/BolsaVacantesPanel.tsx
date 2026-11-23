import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Eye,
  GraduationCap,
  Search,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react';
import {
  CursoSae,
  Docente,
  Establecimiento,
  TipoRequerimientoVacante,
  TipoVacanteDocente
} from '../../types';
import { esVacanteCargoDocente } from '../../services/movilidadTerritorialService';
import {
  sugerirHomologacionCurricularTpGemini,
  SugerenciaHomologacionTpResult
} from '../../services/movilidadGeminiService';
import {
  ETIQUETAS_TIPO_VACANTE,
  OrigenSeleccionado,
  ResumenAsignaturasVacante,
  inferirFuenteVacante
} from './movilidadHelpers';

export interface BolsaVacantesPanelProps {
  vacantesFiltradas: Docente[];
  filtroNaturalezaVacante?: 'TODAS' | TipoRequerimientoVacante;
  onChangeFiltroNaturalezaVacante?: (val: 'TODAS' | TipoRequerimientoVacante) => void;
  filtroTipoVacante: 'TODAS' | TipoVacanteDocente;
  onChangeFiltroTipoVacante: (val: 'TODAS' | TipoVacanteDocente) => void;
  filtroComunaVacante: string;
  onChangeFiltroComunaVacante: (val: string) => void;
  filtroFuenteVacante: 'TODAS' | 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
  onChangeFiltroFuenteVacante: (
    val: 'TODAS' | 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'
  ) => void;
  busquedaVacante: string;
  onChangeBusquedaVacante: (val: string) => void;
  comunasDisponibles: string[];
  vacanteDestinoId: string;
  onSelectVacanteDestino: (id: string) => void;
  colegiosByRbd: Map<string, Establecimiento>;
  asignaturasPorCubrirPorVacante: Map<string, ResumenAsignaturasVacante>;
  onVerAsignaturasModal: (v: Docente) => void;
  origenSeleccionado: OrigenSeleccionado | null;
  onAbrirHomologacionTp: (vacante: Docente) => void;
}

function esVacanteTecnicoProfesional(
  vacante: Docente,
  est?: Establecimiento
): boolean {
  if (
    est?.tipoPerfil === 'LICEO_TP' ||
    est?.tipoPerfil === 'LICEO_POLIVALENTE' ||
    est?.modalidadesAutorizadas?.some(m => /tp|tecnico|técnico/i.test(m))
  ) {
    return true;
  }
  const texto = `${vacante.asignaturaPrincipal || ''} ${vacante.apellidos || ''} ${
    vacante.justificacionVacante || ''
  }`;
  return /\b(tp|emtp|tecnico|técnico|especialidad|modulo|módulo|gastronom|mecan|mecán|electric|eléctric|agropecuar|enfermer|administrac|contab|programac|automotriz|construc)\b/i.test(
    texto
  );
}

export const BolsaVacantesPanel: React.FC<BolsaVacantesPanelProps> = ({
  vacantesFiltradas,
  filtroNaturalezaVacante = 'TODAS',
  onChangeFiltroNaturalezaVacante,
  filtroTipoVacante,
  onChangeFiltroTipoVacante,
  filtroComunaVacante,
  onChangeFiltroComunaVacante,
  filtroFuenteVacante,
  onChangeFiltroFuenteVacante,
  busquedaVacante,
  onChangeBusquedaVacante,
  comunasDisponibles,
  vacanteDestinoId,
  onSelectVacanteDestino,
  colegiosByRbd,
  asignaturasPorCubrirPorVacante,
  onVerAsignaturasModal,
  origenSeleccionado,
  onAbrirHomologacionTp
}) => {
  return (
    <section className="xl:col-span-4 card-elevated p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-600" />
          <span>3. Bolsa de Vacantes NN ({vacantesFiltradas.length})</span>
        </h2>
      </div>

      {/* Filtros de Vacantes */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={busquedaVacante}
            onChange={e => onChangeBusquedaVacante(e.target.value)}
            placeholder="Buscar por especialidad, escuela, RBD o comuna..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {onChangeFiltroNaturalezaVacante && (
            <select
              value={filtroNaturalezaVacante}
              onChange={e =>
                onChangeFiltroNaturalezaVacante(
                  e.target.value as 'TODAS' | TipoRequerimientoVacante
                )
              }
              className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="TODAS">Todo personal</option>
              <option value="HORAS_AULA">Horas Aula</option>
              <option value="CARGO_DOCENTE">Cargos Docentes</option>
              <option value="CARGO_ASISTENTE">Asistentes 21.109</option>
            </select>
          )}
          <select
            value={filtroTipoVacante}
            onChange={e =>
              onChangeFiltroTipoVacante(
                e.target.value as 'TODAS' | TipoVacanteDocente
              )
            }
            className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="TODAS">Todos los tipos</option>
            <option value="NN_DETECTADO">NN Detectado</option>
            <option value="NECESIDAD_ESCUELA">Necesidad Escuela</option>
            <option value="CONDICIONAL_EGRESO">Condicional Egreso</option>
            <option value="REBOTE_MOVILIDAD">NN-Rebote</option>
          </select>

          <select
            value={filtroComunaVacante}
            onChange={e => onChangeFiltroComunaVacante(e.target.value)}
            className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="TODAS">Todas comunas</option>
            {comunasDisponibles.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filtroFuenteVacante}
            onChange={e =>
              onChangeFiltroFuenteVacante(
                e.target.value as
                  | 'TODAS'
                  | 'SUBVENCION_GENERAL'
                  | 'SEP'
                  | 'PIE'
              )
            }
            className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="TODAS">Todas fuentes</option>
            <option value="SUBVENCION_GENERAL">Subv. General</option>
            <option value="SEP">SEP</option>
            <option value="PIE">PIE</option>
          </select>
        </div>
      </div>

      {/* Lista de Tarjetas Clickeables */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {vacantesFiltradas.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No hay vacantes NN que coincidan con los filtros actuales.
          </div>
        ) : (
          vacantesFiltradas.map(v => {
            const est = colegiosByRbd.get(v.rbd);
            const tipo: TipoVacanteDocente = v.tipoVacante || 'NN_DETECTADO';
            const tipoMeta = ETIQUETAS_TIPO_VACANTE[tipo];
            const fuente = inferirFuenteVacante(v);
            const seleccionada = vacanteDestinoId === v.id;
            const esAsistenteCargo = v.id.startsWith('vac_ast_');
            const esCargoDoc = !esAsistenteCargo && esVacanteCargoDocente(v);
            const esCargo = esAsistenteCargo || esCargoDoc;
            const resumenAsig = esCargo ? undefined : asignaturasPorCubrirPorVacante.get(v.id);
            const directas = resumenAsig?.directas || [];
            const deficit = resumenAsig?.deficitEstablecimiento || [];
            const esTp = !esCargo && esVacanteTecnicoProfesional(v, est);
            const homologacionHabilitada = Boolean(origenSeleccionado) || esTp;

            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectVacanteDestino(seleccionada ? '' : v.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectVacanteDestino(seleccionada ? '' : v.id);
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all space-y-1.5 cursor-pointer ${
                  seleccionada
                    ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-300 shadow-xs'
                    : v.vacanteCondicional
                    ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-slate-900">
                      {v.asignaturaPrincipal || `${v.nombres} ${v.apellidos}`}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {est?.nombre || `RBD ${v.rbd}`}{' '}
                      {est?.comuna ? `· ${est.comuna}` : ''}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[11px] font-black tabular-nums shrink-0">
                    {v.horasContrato}h
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold border ${tipoMeta.className}`}
                  >
                    {tipoMeta.label}
                  </span>
                  {esAsistenteCargo ? (
                    <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-300 font-black">
                      Asistente Ley 21.109{v.funcionPrincipal ? ` · ${v.funcionPrincipal}` : ''}
                    </span>
                  ) : esCargoDoc ? (
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-black">
                      Cargo Directivo / UTP
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                      Horas Aula
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                    {fuente === 'SUBVENCION_GENERAL' ? 'Subv. General' : fuente}
                  </span>
                  {esTp && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-black">
                      <GraduationCap className="w-3 h-3" />
                      <span>EMTP / TP</span>
                    </span>
                  )}
                  <span className="font-mono text-slate-400">{v.run}</span>
                </div>

                {/* Asignaturas por cubrir */}
                {(directas.length > 0 || deficit.length > 0) && (
                  <div className="pt-1 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {directas.slice(0, 3).map((d, idx) => (
                        <span
                          key={`${v.id}-dir-${idx}`}
                          className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold tabular-nums"
                        >
                          {d.asignatura} · {d.horasPedagogicas} HA (
                          {d.cursoNombre})
                        </span>
                      ))}
                      {directas.length === 0 &&
                        deficit.slice(0, 3).map((def, idx) => (
                          <span
                            key={`${v.id}-def-${idx}`}
                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold tabular-nums"
                          >
                            Déficit: {def.asignatura} ({def.horasPorCubrir} HA)
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {v.vacanteCondicional && (
                  <div className="px-2 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Condicional — Solo Cobertura Transitoria</span>
                  </div>
                )}

                {v.justificacionVacante && (
                  <p className="text-[10px] text-slate-600 line-clamp-2">
                    {v.justificacionVacante}
                  </p>
                )}

                <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onVerAsignaturasModal(v);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 hover:text-indigo-900 hover:underline"
                    >
                      <Eye className="w-3 h-3" />
                      <span>
                        Ver asignaturas por cubrir (
                        {directas.length > 0
                          ? `${directas.length} asig.`
                          : `${deficit.length} déficit`}
                        )
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!homologacionHabilitada}
                      title={
                        !homologacionHabilitada
                          ? 'Selecciona primero un funcionario origen en Columna 1'
                          : 'Analizar homologación curricular Técnico-Profesional (Decretos 352/452/954) con Gemini'
                      }
                      onClick={e => {
                        e.stopPropagation();
                        onAbrirHomologacionTp(v);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        !homologacionHabilitada
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : esTp
                          ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-xs'
                          : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Homologación TP (Gemini)</span>
                    </button>
                  </div>

                  <span className="text-[10px] font-semibold text-slate-400">
                    {seleccionada ? '✓ Seleccionada' : 'Clic para elegir'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export interface VacanteAsignaturasModalProps {
  vacante: Docente;
  colegiosByRbd: Map<string, Establecimiento>;
  asignaturasPorCubrirPorVacante: Map<string, ResumenAsignaturasVacante>;
  onSelectDestino: (vacanteId: string) => void;
  onClose: () => void;
}

export const VacanteAsignaturasModal: React.FC<
  VacanteAsignaturasModalProps
> = ({
  vacante,
  colegiosByRbd,
  asignaturasPorCubrirPorVacante,
  onSelectDestino,
  onClose
}) => {
  const est = colegiosByRbd.get(vacante.rbd);
  const resumen = asignaturasPorCubrirPorVacante.get(vacante.id);
  const directas = resumen?.directas || [];
  const deficit = resumen?.deficitEstablecimiento || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>
                Asignaturas por Cubrir —{' '}
                {vacante.asignaturaPrincipal ||
                  `${vacante.nombres} ${vacante.apellidos}`}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {est?.nombre || `RBD ${vacante.rbd}`} · {vacante.horasContrato}h
              contrato · RUN {vacante.run}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-black text-slate-800 mb-1.5">
              1. Asignaciones horarias vinculadas a esta vacante (
              {resumen?.totalHorasDirectas || 0} HA)
            </div>
            {directas.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                Esta vacante no tiene cursos/asignaciones vinculadas
                directamente todavía. Especialidad declarada:{' '}
                <strong className="text-slate-800">
                  {vacante.asignaturaPrincipal || 'No especificada'}
                </strong>
                .
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                    <tr>
                      <th className="p-2">Asignatura</th>
                      <th className="p-2">Curso</th>
                      <th className="p-2 text-right">Horas Aula (HA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {directas.map((d, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold text-slate-800">
                          {d.asignatura}
                        </td>
                        <td className="p-2 text-slate-600">{d.cursoNombre}</td>
                        <td className="p-2 text-right font-black tabular-nums">
                          {d.horasPedagogicas} HA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-black text-slate-800 mb-1.5">
              2. Asignaturas con déficit curricular pendiente en el
              establecimiento ({deficit.length})
            </div>
            {deficit.length === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                No se detecta déficit curricular pendiente en los planes del
                establecimiento.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-50 text-[10px] font-black uppercase text-amber-900">
                    <tr>
                      <th className="p-2">Asignatura</th>
                      <th className="p-2 text-right">Plan (HA)</th>
                      <th className="p-2 text-right">Cubiertas (HA)</th>
                      <th className="p-2 text-right">Por Cubrir (HA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deficit.map((def, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold text-slate-800">
                          {def.asignatura}
                        </td>
                        <td className="p-2 text-right tabular-nums text-slate-600">
                          {def.horasPlan}
                        </td>
                        <td className="p-2 text-right tabular-nums text-slate-600">
                          {def.horasCubiertas}
                        </td>
                        <td className="p-2 text-right font-black tabular-nums text-rose-700">
                          {def.horasPorCubrir} HA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onSelectDestino(vacante.id);
              onClose();
            }}
            className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
          >
            Seleccionar como Destino
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export interface HomologacionTpModalProps {
  vacante: Docente;
  origenSeleccionado: OrigenSeleccionado | null;
  docentesById: Map<string, Docente>;
  colegiosByRbd: Map<string, Establecimiento>;
  cursosTerritorio: CursoSae[];
  onClose: () => void;
  onError: (mensaje: string) => void;
}

export const HomologacionTpModal: React.FC<HomologacionTpModalProps> = ({
  vacante,
  origenSeleccionado,
  docentesById,
  colegiosByRbd,
  cursosTerritorio,
  onClose,
  onError
}) => {
  const est = colegiosByRbd.get(vacante.rbd);
  const [tituloMencion, setTituloMencion] = useState('');
  const [especialidadVacante, setEspecialidadVacante] = useState('');
  const [nivelCurso, setNivelCurso] = useState('3° / 4° Medio EMTP');
  const [resultado, setResultado] =
    useState<SugerenciaHomologacionTpResult | null>(null);
  const [cargando, setCargando] = useState(false);

  const ejecutarEvaluacion = async (
    tit: string,
    esp: string,
    niv: string
  ) => {
    setCargando(true);
    try {
      const res = await sugerirHomologacionCurricularTpGemini({
        docenteId: origenSeleccionado?.docenteId,
        nombreDocente: origenSeleccionado?.nombreDocente,
        tituloMencionDocente: tit,
        asignaturaDocente: origenSeleccionado?.asignatura,
        especialidadVacante: esp,
        rbdDestino: vacante.rbd,
        nivelCurso: niv
      });
      setResultado(res);
    } catch (err: any) {
      onError(`Error analizando homologación TP: ${err?.message || err}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const docOrig = origenSeleccionado
      ? docentesById.get(origenSeleccionado.docenteId)
      : undefined;
    const titInit = docOrig?.titulo || origenSeleccionado?.asignatura || '';
    const espInit = vacante.asignaturaPrincipal || vacante.apellidos || '';
    const cursoTp = cursosTerritorio.find(
      c => c.rbd === vacante.rbd && c.especialidadTp
    );
    const nivInit = cursoTp
      ? `${cursoTp.nivel} (${cursoTp.especialidadTp})`
      : '3° / 4° Medio EMTP';

    setTituloMencion(titInit);
    setEspecialidadVacante(espInit);
    setNivelCurso(nivInit);
    setResultado(null);
    void ejecutarEvaluacion(titInit, espInit, nivInit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacante.id, origenSeleccionado?.docenteId]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 my-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              <span>Homologación Curricular TP Asistida (Gemini)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Vacante: {vacante.asignaturaPrincipal || vacante.apellidos} ·{' '}
              {est?.nombre || `RBD ${vacante.rbd}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-bold flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            Confirmación Humana Obligatoria UATP / SEREMI: esta orientación no
            sustituye la habilitación docente oficial (Decreto N° 352/2003) ni
            altera puntajes de movilidad.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              Título / Mención Docente{' '}
              {origenSeleccionado ? `(${origenSeleccionado.nombreDocente})` : ''}
            </label>
            <input
              type="text"
              value={tituloMencion}
              onChange={e => setTituloMencion(e.target.value)}
              placeholder="Ej: Ing. Mecánico / Prof. TP"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              Especialidad Vacante TP
            </label>
            <input
              type="text"
              value={especialidadVacante}
              onChange={e => setEspecialidadVacante(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              Nivel / Curso EMTP
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={nivelCurso}
                onChange={e => setNivelCurso(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                disabled={cargando}
                onClick={() =>
                  ejecutarEvaluacion(
                    tituloMencion,
                    especialidadVacante,
                    nivelCurso
                  )
                }
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg disabled:opacity-50"
              >
                Re-evaluar
              </button>
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Evaluando compatibilidad determinista @slep/mineduc-engine y
            orientaciones EMTP...
          </div>
        ) : (
          resultado && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-black border ${
                      resultado.compatibleDeterminista
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {resultado.compatibleDeterminista
                      ? 'Compatible Determinista'
                      : 'Requiere Homologación / Autorización'}{' '}
                    ({resultado.puntajeIdoneidadBase} pts idoneidad)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">
                    {resultado.origenAnalisis}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700">
                  <strong>Diagnóstico Motor:</strong>{' '}
                  {resultado.diagnosticoDeterminista}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <strong>Sector Docente:</strong>{' '}
                    {resultado.sectorEconomicoDocente}
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <strong>Sector Vacante:</strong>{' '}
                    {resultado.sectorEconomicoVacante}
                  </div>
                </div>
              </div>

              {resultado.recomendacionIa && (
                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1">
                  <div className="font-black text-purple-950">
                    Orientación Curricular Asistida
                  </div>
                  <p className="text-[11px] text-purple-900 leading-relaxed">
                    {resultado.recomendacionIa}
                  </p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                <div className="font-black text-indigo-950">
                  Equivalencias Curriculares Sugeridas
                </div>
                {resultado.equivalenciasCurricularesSugeridas.map((eq, i) => (
                  <div key={i} className="text-[11px] text-indigo-900">
                    • {eq}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-black text-slate-800">
                  Criterios de Validación MINEDUC (Decretos 352 / 452 / 954)
                </div>
                {resultado.criteriosValidacionMineduc.map((cr, i) => (
                  <div key={i} className="text-[11px] text-slate-700">
                    • {cr}
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 italic">
                {resultado.notaNormativa}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
