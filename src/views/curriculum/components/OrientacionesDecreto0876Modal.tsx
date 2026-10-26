import React, { useState, useMemo } from 'react';
import {
  X, GraduationCap, BookOpen, Layers, CheckCircle2, AlertTriangle, AlertCircle,
  HelpCircle, Sparkles, SlidersHorizontal, Scale, Award, Info, Check, RefreshCw
} from 'lucide-react';
import {
  CATALOGO_PROFUNDIZACION_HC_27,
  CATALOGO_PLAN_COMUN_ELECTIVO_3_4,
  CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35,
  CATALOGO_MENCIONES_ARTISTICAS_10,
  DECRETO_0876_2019_METADATA,
  validarOfertaElectivosHc,
  validarEleccionEstudianteHc,
  AsignaturaProfundizacionHc
} from '@slep/mineduc-engine';

interface OrientacionesDecreto0876ModalProps {
  abierto: boolean;
  onCerrar: () => void;
}

export const OrientacionesDecreto0876Modal: React.FC<OrientacionesDecreto0876ModalProps> = ({
  abierto,
  onCerrar
}) => {
  const [tabActiva, setTabActiva] = useState<'distribucion' | 'catalogo' | 'validador' | 'orientaciones'>('distribucion');
  const [filtroAreaCatalogo, setFiltroAreaCatalogo] = useState<'TODAS' | 'A' | 'B' | 'C'>('TODAS');
  const [filtroDisciplinaCatalogo, setFiltroDisciplinaCatalogo] = useState<string>('TODAS');

  // Estado del simulador de oferta
  const [asignaturasOfertadasSimuladas, setAsignaturasOfertadasSimuladas] = useState<string[]>([
    "Taller de Literatura",
    "Participación y argumentación en democracia",
    "Límites, derivadas e integrales",
    "Biología de los ecosistemas",
    "Química",
    "Creación y composición musical"
  ]);

  if (!abierto) return null;

  // Validación reactiva de la oferta simulada
  const resultadoValidacion = validarOfertaElectivosHc(asignaturasOfertadasSimuladas);

  // Toggle de selección en simulador
  const toggleAsignaturaSimulador = (nombre: string) => {
    setAsignaturasOfertadasSimuladas(prev =>
      prev.includes(nombre) ? prev.filter(x => x !== nombre) : [...prev, nombre]
    );
  };

  const preseleccionarOfertaRecomendada = () => {
    setAsignaturasOfertadasSimuladas([
      "Taller de Literatura",
      "Economía y sociedad",
      "Límites, derivadas e integrales",
      "Pensamiento computacional y programación",
      "Biología de los ecosistemas",
      "Artes visuales, audiovisuales y multimediales",
      "Ciencias del ejercicio físico y deportivo"
    ]);
  };

  // Filtrado reactivo en catálogo
  const asignaturasCatalogoFiltradas = CATALOGO_PROFUNDIZACION_HC_27.filter(asig => {
    if (filtroAreaCatalogo !== 'TODAS' && asig.area !== filtroAreaCatalogo) return false;
    if (filtroDisciplinaCatalogo !== 'TODAS' && asig.disciplina !== filtroDisciplinaCatalogo) return false;
    return true;
  });

  const disciplinasDisponibles = Array.from(
    new Set(
      CATALOGO_PROFUNDIZACION_HC_27
        .filter(a => filtroAreaCatalogo === 'TODAS' || a.area === filtroAreaCatalogo)
        .map(a => a.disciplina)
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="card-elevated max-w-5xl w-full h-[92vh] max-h-[900px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden animate-scale-in">
        
        {/* ── HEADER DEL MODAL ── */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4 shrink-0 border-b border-indigo-800/40">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-black tracking-wider uppercase">
                {DECRETO_0876_2019_METADATA.decreto}
              </span>
              <span className="text-xs text-indigo-200 font-semibold">
                • {DECRETO_0876_2019_METADATA.acuerdoCned}
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                • 38 Semanas Lectivas Anuales
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1.5 flex items-center gap-2 text-white">
              <GraduationCap className="w-6 h-6 text-indigo-400" />
              <span>Plan de Estudios para 3° y 4° Año de Educación Media</span>
            </h2>
            <p className="text-xs text-indigo-200 max-w-3xl leading-relaxed mt-1">
              Orientaciones curriculares oficiales, distribución horaria para Formación General (HC, TP y Artística), catálogo de las 27 asignaturas de profundización y validador de oferta institucional.
            </p>
          </div>

          <button
            onClick={onCerrar}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors shrink-0"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── NAV TABS ── */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTabActiva('distribucion')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
              tabActiva === 'distribucion'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>1. Distribución Horaria (Tablas 1-4)</span>
          </button>

          <button
            onClick={() => setTabActiva('catalogo')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
              tabActiva === 'catalogo'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>2. Catálogo de 27 Asignaturas HC</span>
          </button>

          <button
            onClick={() => setTabActiva('validador')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
              tabActiva === 'validador'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>3. Validador & Simulador de Oferta Liceo</span>
          </button>

          <button
            onClick={() => setTabActiva('orientaciones')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
              tabActiva === 'orientaciones'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>4. Principios & Normativa Religión</span>
          </button>
        </div>

        {/* ── CONTENIDO SCROLLABLE ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: DISTRIBUCIÓN HORARIA OFICIAL (TABLAS 1 A 4 DEL DECRETO)    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tabActiva === 'distribucion' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <p className="font-bold">
                    Estructura Global del Tiempo Escolar en 3° y 4° Medio:
                  </p>
                  <p>
                    El plan de estudios contempla <strong>42 horas pedagógicas semanales mínimas en Jornada Completa Diurna (JEC)</strong> para las tres modalidades (HC, TP y Artística). En régimen Sin JEC, el mínimo es de <strong>36 horas (HC)</strong>, <strong>38 horas (TP)</strong> y <strong>38 horas (Artística)</strong>. Se organiza en 3 ámbitos: <em>Formación General (Común + Electivo)</em>, <em>Formación Diferenciada</em> y <em>Horas de Libre Disposición</em>.
                  </p>
                </div>
              </div>

              {/* Comparativa por Modalidades */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Modalidad HC */}
                <div className="p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider">
                      Humanístico-Científico
                    </span>
                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                      42h JEC / 36h No JEC
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-indigo-100 dark:border-indigo-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Plan Común General:</span>
                      <span className="font-mono font-black text-indigo-600">14 hrs (532h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-indigo-100 dark:border-indigo-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Plan Común Electivo:</span>
                      <span className="font-mono font-black text-indigo-600">2 hrs (76h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-indigo-100 dark:border-indigo-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Formación Diferenciada (3 electivos x 6h):</span>
                      <span className="font-mono font-black text-indigo-600">18 hrs (684h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-100/50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900">
                      <span className="font-bold text-indigo-900 dark:text-indigo-200">Horas Libre Disposición:</span>
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-300">8h JEC / 2h No JEC</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    💡 Gran autonomía para el estudiante: <strong>20 horas electivas</strong> (18h diferenciada + 2h común electivo).
                  </div>
                </div>

                {/* Modalidad TP */}
                <div className="p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider">
                      Técnico-Profesional
                    </span>
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                      42h JEC / 38h No JEC
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-emerald-100 dark:border-emerald-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Plan Común General:</span>
                      <span className="font-mono font-black text-emerald-600">14 hrs (532h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-emerald-100 dark:border-emerald-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Plan Común Electivo:</span>
                      <span className="font-mono font-black text-emerald-600">2 hrs (en libre disp.)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-emerald-100 dark:border-emerald-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Formación Diferenciada TP (35 especialidades):</span>
                      <span className="font-mono font-black text-emerald-600">22 hrs (836h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-100/50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">Horas Libre Disposición:</span>
                      <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">6h JEC / 2h No JEC</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    🔧 Los colegios TP implementan el Plan Común Electivo dentro de sus 6h de libre disposición.
                  </div>
                </div>

                {/* Modalidad Artística */}
                <div className="p-5 rounded-2xl border-2 border-purple-200 dark:border-purple-900/60 bg-gradient-to-b from-purple-50/50 to-white dark:from-purple-950/20 dark:to-slate-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-black uppercase tracking-wider">
                      Artística
                    </span>
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                      42h JEC / 38h No JEC
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-purple-100 dark:border-purple-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Plan Común General:</span>
                      <span className="font-mono font-black text-purple-600">14 hrs (532h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-purple-100 dark:border-purple-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Plan Común Electivo:</span>
                      <span className="font-mono font-black text-purple-600">2 hrs (76h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/70 border border-purple-100 dark:border-purple-950">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Formación Diferenciada Artística (D.S. 3/2007):</span>
                      <span className="font-mono font-black text-purple-600">21 hrs (798h/año)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-purple-100/50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900">
                      <span className="font-bold text-purple-900 dark:text-purple-200">Horas Libre Disposición:</span>
                      <span className="font-mono font-black text-purple-700 dark:text-purple-300">5h JEC / 1h No JEC</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    🎨 Comprende 10 menciones artísticas con objetivos terminales especializados.
                  </div>
                </div>

              </div>

              {/* Tabla Detallada del Plan Común General y Electivo */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Detalle de Asignaturas del Plan Común (Obligatorio + Electivo)</span>
                </h3>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-black">
                      <tr>
                        <th className="p-3">Asignatura</th>
                        <th className="p-3">Tipo de Plan</th>
                        <th className="p-3 text-center">Horas Semanales</th>
                        <th className="p-3 text-center">Horas Anuales (38 sem)</th>
                        <th className="p-3">Observaciones Normativas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                      <tr>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">Lengua y Literatura</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold">Común Obligatorio</span></td>
                        <td className="p-3 text-center font-mono font-bold">3 hrs</td>
                        <td className="p-3 text-center font-mono">114 hrs</td>
                        <td className="p-3 text-[11px] text-slate-500">Obligatoria durante todo el ciclo de 3° y 4° medio.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">Matemática</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold">Común Obligatorio</span></td>
                        <td className="p-3 text-center font-mono font-bold">3 hrs</td>
                        <td className="p-3 text-center font-mono">114 hrs</td>
                        <td className="p-3 text-[11px] text-slate-500">Obligatoria durante todo el ciclo de 3° y 4° medio.</td>
                      </tr>
                      <tr>
                        <td className="p-3">Educación Ciudadana</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold">Común Obligatorio</span></td>
                        <td className="p-3 text-center font-mono font-bold">2 hrs</td>
                        <td className="p-3 text-center font-mono">76 hrs</td>
                        <td className="p-3 text-[11px] text-slate-500">Formación democrática, derechos humanos e institucionalidad.</td>
                      </tr>
                      <tr>
                        <td className="p-3">Filosofía</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold">Común Obligatorio</span></td>
                        <td className="p-3 text-center font-mono font-bold">2 hrs</td>
                        <td className="p-3 text-center font-mono">76 hrs</td>
                        <td className="p-3 text-[11px] text-slate-500">Reflexión crítica y ética para todas las modalidades.</td>
                      </tr>
                      <tr>
                        <td className="p-3">Inglés</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold">Común Obligatorio</span></td>
                        <td className="p-3 text-center font-mono font-bold">2 hrs</td>
                        <td className="p-3 text-center font-mono">76 hrs</td>
                        <td className="p-3 text-[11px] text-slate-500">Competencias comunicativas globales.</td>
                      </tr>
                      <tr>
                        <td className="p-3">Ciencias para la Ciudadanía</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold">Común Obligatorio</span></td>
                        <td className="p-3 text-center font-mono font-bold">2 hrs</td>
                        <td className="p-3 text-center font-mono">76 hrs</td>
                        <td className="p-3 text-[11px] text-slate-500">Módulos integrados de salud, ambiente, tecnología y seguridad.</td>
                      </tr>
                      <tr className="bg-amber-50/50 dark:bg-amber-950/20">
                        <td className="p-3 font-bold text-amber-800 dark:text-amber-300">
                          Plan Común Electivo (Historia / Artes / Ed. Física / Religión)
                        </td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] font-bold">Común Electivo</span></td>
                        <td className="p-3 text-center font-mono font-bold text-amber-700 dark:text-amber-300">2 hrs</td>
                        <td className="p-3 text-center font-mono text-amber-700 dark:text-amber-300">76 hrs</td>
                        <td className="p-3 text-[11px] text-slate-600 dark:text-slate-300">
                          El liceo debe ofrecer Religión (Dec. 924/83). Si no se dicta o alumnos optan por no cursarla, las 2h se destinan a Artes, Ed. Física o Historia.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: CATÁLOGO DE LAS 27 ASIGNATURAS DE PROFUNDIZACIÓN HC        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tabActiva === 'catalogo' && (
            <div className="space-y-5">
              
              {/* Filtros de Área y Disciplina */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 mr-1">Filtrar por Área:</span>
                  <button
                    onClick={() => { setFiltroAreaCatalogo('TODAS'); setFiltroDisciplinaCatalogo('TODAS'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filtroAreaCatalogo === 'TODAS'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Todas (27)
                  </button>
                  <button
                    onClick={() => { setFiltroAreaCatalogo('A'); setFiltroDisciplinaCatalogo('TODAS'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filtroAreaCatalogo === 'A'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Área A: Humanidades & Cs. Sociales (9)
                  </button>
                  <button
                    onClick={() => { setFiltroAreaCatalogo('B'); setFiltroDisciplinaCatalogo('TODAS'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filtroAreaCatalogo === 'B'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Área B: Matemática & Ciencias (9)
                  </button>
                  <button
                    onClick={() => { setFiltroAreaCatalogo('C'); setFiltroDisciplinaCatalogo('TODAS'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filtroAreaCatalogo === 'C'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Área C: Artes & Ed. Física (9)
                  </button>
                </div>

                {/* Filtro por disciplina */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Disciplina:</span>
                  <select
                    value={filtroDisciplinaCatalogo}
                    onChange={(e) => setFiltroDisciplinaCatalogo(e.target.value)}
                    className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    <option value="TODAS">Todas las disciplinas</option>
                    {disciplinasDisponibles.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid de Asignaturas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {asignaturasCatalogoFiltradas.map(asig => {
                  const colorBadge =
                    asig.area === 'A'
                      ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-200'
                      : asig.area === 'B'
                      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200'
                      : 'border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 text-purple-800 dark:text-purple-200';

                  const badgePill =
                    asig.area === 'A'
                      ? 'bg-indigo-600 text-white'
                      : asig.area === 'B'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-purple-600 text-white';

                  return (
                    <div
                      key={asig.id}
                      className={`p-4 rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between ${colorBadge}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${badgePill}`}>
                            Área {asig.area}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {asig.disciplina}
                          </span>
                        </div>

                        <h4 className="font-black text-slate-900 dark:text-white text-sm leading-snug">
                          {asig.nombre}
                        </h4>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono font-bold">
                        <span className="text-slate-600 dark:text-slate-300">
                          {asig.horasSemanales} hrs semanales
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {asig.horasAnuales} hrs/año
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: VALIDADOR Y SIMULADOR DE OFERTA CURRICULAR DEL LICEO       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tabActiva === 'validador' && (
            <div className="space-y-6">
              
              {/* Panel de Diagnóstico Normativo */}
              <div className={`p-5 rounded-2xl border-2 transition-all ${
                resultadoValidacion.valido
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500'
                  : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    {resultadoValidacion.valido ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        {resultadoValidacion.valido
                          ? 'Oferta Institucional Conforme a Normativa CNED (Decreto N° 0876/2019)'
                          : 'Oferta Institucional con Inconsistencias Normativas'}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {asignaturasOfertadasSimuladas.length} asignaturas seleccionadas • {resultadoValidacion.areasCubiertas.length} área(s) cubierta(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={preseleccionarOfertaRecomendada}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs"
                    >
                      Cargar Ejemplo Aprobado
                    </button>
                    <button
                      onClick={() => setAsignaturasOfertadasSimuladas([])}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* Métricas y Carga Docente */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Ofertadas</span>
                    <span className={`text-lg font-mono font-black ${resultadoValidacion.totalOfertadas >= 6 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {resultadoValidacion.totalOfertadas} / 6 mín.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Áreas Cubiertas</span>
                    <span className={`text-lg font-mono font-black ${resultadoValidacion.areasCubiertas.length >= 2 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {resultadoValidacion.areasCubiertas.length} / 2 mín.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Demanda Docente Oferta</span>
                    <span className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {asignaturasOfertadasSimuladas.length * 6} hrs aula
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Carga por Estudiante</span>
                    <span className="text-lg font-mono font-black text-slate-700 dark:text-slate-300">
                      3 asig (18 hrs)
                    </span>
                  </div>
                </div>

                {/* Errores y Alertas */}
                {resultadoValidacion.errores.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {resultadoValidacion.errores.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100/60 dark:bg-red-950/40 p-2 rounded-xl border border-red-200 dark:border-red-900/60">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {resultadoValidacion.advertencias.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {resultadoValidacion.advertencias.map((adv, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900/60">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{adv}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selector de Asignaturas por Áreas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 dark:text-white text-sm">
                    Selecciona las asignaturas que ofertará el liceo para 3° y 4° Medio:
                  </h4>
                  <span className="text-xs font-bold text-slate-500">
                    Marca o desmarca para simular la oferta institucional
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Área A */}
                  <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-900/60 pb-2">
                      <span className="font-black text-xs text-indigo-900 dark:text-indigo-200 uppercase">
                        Área A: Humanidades & Cs. Sociales
                      </span>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                        {resultadoValidacion.desglosePorArea.areaA.cantidad} sel.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {CATALOGO_PROFUNDIZACION_HC_27.filter(a => a.area === 'A').map(asig => {
                        const seleccionada = asignaturasOfertadasSimuladas.includes(asig.nombre);
                        return (
                          <label
                            key={asig.id}
                            className={`flex items-start gap-2 p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                              seleccionada
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionada}
                              onChange={() => toggleAsignaturaSimulador(asig.nombre)}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <span className="block leading-snug">{asig.nombre}</span>
                              <span className={`text-[10px] block ${seleccionada ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {asig.disciplina} • 6 hrs
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Área B */}
                  <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/60 pb-2">
                      <span className="font-black text-xs text-emerald-900 dark:text-emerald-200 uppercase">
                        Área B: Matemática & Ciencias
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                        {resultadoValidacion.desglosePorArea.areaB.cantidad} sel.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {CATALOGO_PROFUNDIZACION_HC_27.filter(a => a.area === 'B').map(asig => {
                        const seleccionada = asignaturasOfertadasSimuladas.includes(asig.nombre);
                        return (
                          <label
                            key={asig.id}
                            className={`flex items-start gap-2 p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                              seleccionada
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionada}
                              onChange={() => toggleAsignaturaSimulador(asig.nombre)}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <span className="block leading-snug">{asig.nombre}</span>
                              <span className={`text-[10px] block ${seleccionada ? 'text-emerald-200' : 'text-slate-400'}`}>
                                {asig.disciplina} • 6 hrs
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Área C */}
                  <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900 bg-purple-50/20 dark:bg-purple-950/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-900/60 pb-2">
                      <span className="font-black text-xs text-purple-900 dark:text-purple-200 uppercase">
                        Área C: Artes & Educación Física
                      </span>
                      <span className="text-[10px] font-mono font-bold text-purple-600 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded">
                        {resultadoValidacion.desglosePorArea.areaC.cantidad} sel.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {CATALOGO_PROFUNDIZACION_HC_27.filter(a => a.area === 'C').map(asig => {
                        const seleccionada = asignaturasOfertadasSimuladas.includes(asig.nombre);
                        return (
                          <label
                            key={asig.id}
                            className={`flex items-start gap-2 p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                              seleccionada
                                ? 'bg-purple-600 text-white font-bold'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionada}
                              onChange={() => toggleAsignaturaSimulador(asig.nombre)}
                              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <span className="block leading-snug">{asig.nombre}</span>
                              <span className={`text-[10px] block ${seleccionada ? 'text-purple-200' : 'text-slate-400'}`}>
                                {asig.disciplina} • 6 hrs
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: PRINCIPIOS PEDAGÓGICOS & NORMATIVA OFICIAL                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tabActiva === 'orientaciones' && (
            <div className="space-y-6">
              
              {/* 3 Principios Orientadores */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Tres Principios Pedagógicos del Plan Diferenciado HC</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase">
                      1. Electividad
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-xs">
                      Autonomía y Proyecto de Vida
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {DECRETO_0876_2019_METADATA.principios.electividad}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase">
                      2. Profundización
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-xs">
                      Habilidades Siglo XXI
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {DECRETO_0876_2019_METADATA.principios.profundizacion}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20 space-y-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-black uppercase">
                      3. Exploración
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-xs">
                      Sin Canales Cerrados
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {DECRETO_0876_2019_METADATA.principios.exploracion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Protocolo de Agrupación Internivel y Simultaneidad */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <h4 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Flexibilidad en la Organización de Grupos (Articulación Internivel 3° y 4°)</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  El Decreto Exento N° 0876/2019 autoriza expresamente que los establecimientos organicen los grupos de profundización <strong>con estudiantes de ambos niveles juntos (3° y 4° Medio combinados)</strong> o por nivel separado. Esta disposición normativa resulta clave para optimizar la dotación docente en liceos territoriales con 1 o 2 cursos paralelos por nivel, permitiendo conformar electivos viables sin sobrecargar la dotación del sostenedor.
                </p>
              </div>

              {/* Normativa de Religión (Decreto N° 924/1983) */}
              <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <h4 className="font-black text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <span>Régimen Normativo de Religión y su Reemplazo en el Plan Común Electivo</span>
                </h4>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                  <p>
                    • Se incluye la asignatura de Religión, que <strong>debe ofrecerse obligatoriamente en todos los establecimientos del país</strong> (Decreto N° 924, 1983) con 2 horas semanales, pero que es optativa para los estudiantes y sus familias.
                  </p>
                  <p>
                    • Si la clase de religión no se dicta en el liceo, las horas que a ella corresponden <strong>serán distribuidas por el establecimiento en una o más de las siguientes asignaturas</strong>: <em>Artes</em>, <em>Educación Física y Salud</em> o <em>Historia, Geografía y Ciencias Sociales</em>.
                  </p>
                  <p>
                    • Si uno o más alumnos optan por no cursar religión, el establecimiento deberá arbitrar medidas para que dicho tiempo se destine en al menos una de las tres asignaturas señaladas.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── FOOTER DEL MODAL ── */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Award className="w-4 h-4 text-indigo-500" />
            <span>Unidad de Currículum y Evaluación (UCE) • Ministerio de Educación</span>
          </div>

          <button
            onClick={onCerrar}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-black transition-all shadow-md"
          >
            Entendido / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
