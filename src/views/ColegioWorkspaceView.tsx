import React, { useState } from 'react';
import {
  Scale, Users, BookOpen, Clock, ShieldCheck, LayoutGrid,
  FileSpreadsheet, Printer, ArrowRightLeft, FileUp, FileDown, Sparkles,
  Building2, MapPin, AlertTriangle, CheckCircle2, ChevronRight, Calendar, Trash2, ShieldAlert
} from 'lucide-react';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria
} from '../types';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';
import { BalanzaDiagnosticoView } from './BalanzaDiagnosticoView';
import { DocentesDotacionView } from './DocentesDotacionView';
import { CurriculumDemandaView } from './CurriculumDemandaView';
import { PieAuditorView } from './PieAuditorView';
import { SalasSaeView } from './SalasSaeView';
import { MatrizExcelImportModal } from '../components/MatrizExcelImportModal';
import { ComparadorPeriodosModal } from '../components/ComparadorPeriodosModal';
import { ConfirmarVaciarDotacionModal } from '../components/ConfirmarVaciarDotacionModal';
import { ExportarEstablecimientoModal } from '../components/ExportarEstablecimientoModal';
import { ImportarEstablecimientoModal } from '../components/ImportarEstablecimientoModal';

export interface ColegioWorkspaceViewProps {
  colegio: Establecimiento;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  diagnostico: DiagnosticoColegioCompleto | null;
  onGuardarSala: (s: SalaInfraestructura) => Promise<void> | void;
  onEliminarSala: (id: string) => Promise<void> | void;
  onGuardarCurso: (c: CursoSae) => Promise<void> | void;
  onEliminarCurso: (id: string) => Promise<void> | void;
  onGuardarDocente: (d: Docente) => Promise<void> | void;
  onEliminarDocente: (id: string) => Promise<void> | void;
  onGuardarAsignacion: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion: (id: string) => Promise<void> | void;
  onAbrirModuloSige: () => void;
  onExportarExcel: () => void;
  onAbrirNavegadorColegios: () => void;
  todosLosColegios?: Establecimiento[];
  todosLosDocentes?: Docente[];
  todasLasAsignaciones?: AsignacionHoraria[];
  periodoActivo?: number;
  onTogglePeriodo?: (p: number) => void;
  onRefreshData?: () => void;
  onLimpiarDotacionColegio?: (periodo: number, rbd: string) => Promise<void> | void;
  onExportarDotacionColegio?: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onExportarMatrizExcelColegio?: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onAbrirCopilot?: () => void;
}

export const ColegioWorkspaceView: React.FC<ColegioWorkspaceViewProps> = ({
  colegio,
  salas,
  cursos,
  docentes,
  asignaciones,
  diagnostico,
  onGuardarSala,
  onEliminarSala,
  onGuardarCurso,
  onEliminarCurso,
  onGuardarDocente,
  onEliminarDocente,
  onGuardarAsignacion,
  onEliminarAsignacion,
  onAbrirModuloSige,
  onExportarExcel,
  onAbrirNavegadorColegios,
  todosLosColegios = [],
  todosLosDocentes = [],
  todasLasAsignaciones = [],
  periodoActivo = 2026,
  onTogglePeriodo,
  onRefreshData,
  onLimpiarDotacionColegio,
  onExportarDotacionColegio,
  onExportarMatrizExcelColegio,
  onAbrirCopilot
}) => {
  const [tabActiva, setTabActiva] = useState<'balanza' | 'docentes' | 'cursos' | 'pie' | 'salas'>('balanza');
  const [modalMatrizAbierto, setModalMatrizAbierto] = useState(false);
  const [modalComparadorAbierto, setModalComparadorAbierto] = useState(false);
  const [modalVaciarSeguroAbierto, setModalVaciarSeguroAbierto] = useState(false);
  const [modalExportarEstablecimientoAbierto, setModalExportarEstablecimientoAbierto] = useState(false);
  const [modalImportarEstablecimientoAbierto, setModalImportarEstablecimientoAbierto] = useState(false);
  const [menuAvanzadoAbierto, setMenuAvanzadoAbierto] = useState(false);

  const handleEjecutarVaciarDotacion = async () => {
    if (onLimpiarDotacionColegio) {
      await onLimpiarDotacionColegio(periodoActivo, colegio.rbd);
    }
  };

  const bg = diagnostico?.balanzaGeneral;
  const balance = bg?.superavitDeficitLectivo || 0;

  const tabs = [
    { id: 'balanza' as const, label: 'Balanza & Diagnóstico', icon: Scale, badge: balance > 0 ? `+${balance}h` : `${balance}h` },
    { id: 'docentes' as const, label: 'Nómina & Ley 20.903', icon: Users, badge: `${docentes.length}` },
    { id: 'cursos' as const, label: 'Cursos & Planes MINEDUC', icon: BookOpen, badge: `${cursos.length}` },
    { id: 'pie' as const, label: 'Auditoría PIE (Dec. 170)', icon: ShieldCheck, badge: `${bg?.horasPieDemandadas || 0}h` },
    { id: 'salas' as const, label: 'Salas & Aforo SAE (Dec. 548)', icon: LayoutGrid, badge: `${salas.length}` }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Cockpit Ejecutivo Superior - Estilo Apple */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-800">
                RBD {colegio.rbd}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                periodoActivo === 2027 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                <Calendar className="w-3 h-3" />
                {periodoActivo === 2027 ? 'Dotación 2027 (Proyectada)' : 'Dotación 2026 (Actual)'}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {colegio.comuna}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">
                Régimen {colegio.regimen} ({colegio.porcentajePrioritarios}% SEP - {colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35'})
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1.5 flex items-center gap-3">
              <span>{colegio.nombre}</span>
              <button
                onClick={onAbrirNavegadorColegios}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200 transition-colors inline-flex items-center gap-1"
                title="Cambiar de colegio (Ctrl+K)"
              >
                <span>Cambiar Escuela</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Director: <strong>{colegio.director || 'No especificado'}</strong> • Asesor UATP: <strong>{colegio.asesorUatp || 'UATP Valle Diguillín'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Hero 1: Asistente Inteligente */}
            {onAbrirCopilot && (
              <button
                onClick={onAbrirCopilot}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 border border-blue-400/30 group"
                title="Abrir asistente ¡Qué no va a saber! IA para este colegio (Ctrl+J)"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                <span>¡Qué no va a saber! IA</span>
              </button>
            )}

            {/* Hero 2: Importar Matriz */}
            <button
              onClick={() => setModalMatrizAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm border border-slate-700"
              title="Importar planilla Excel con cursos y docentes"
            >
              <FileSpreadsheet className="w-4 h-4 text-orange-400" />
              <span>Importar Matriz Excel</span>
            </button>

            {/* Hero 3: Comparar Periodos */}
            <button
              onClick={() => setModalComparadorAbierto(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-sm"
              title="Comparar Dotación 2026 vs 2027 lado a lado"
            >
              <Scale className="w-4 h-4 text-indigo-600" />
              <span>Comparar 2026 / 2027</span>
            </button>

            {/* Menú Desplegable de Más Opciones y Exportaciones */}
            <div className="relative">
              <button
                onClick={() => setMenuAvanzadoAbierto(!menuAvanzadoAbierto)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-sm"
                title="Exportar dotación, cargar SIGE o imprimir"
              >
                <span>Acciones</span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuAvanzadoAbierto ? 'rotate-90' : ''}`} />
              </button>

              {menuAvanzadoAbierto && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fade-in divide-y divide-slate-100">
                  <div className="p-1 space-y-0.5">
                    {onExportarMatrizExcelColegio && (
                      <button
                        onClick={() => {
                          onExportarMatrizExcelColegio(colegio, periodoActivo);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Exportar Matriz Oficial Excel</span>
                      </button>
                    )}

                    {onExportarDotacionColegio && (
                      <button
                        onClick={() => {
                          onExportarDotacionColegio(colegio, periodoActivo);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                      >
                        <FileDown className="w-4 h-4 text-indigo-600" />
                        <span>Exportar Ficha (.slep)</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onAbrirModuloSige();
                        setMenuAvanzadoAbierto(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors text-left"
                    >
                      <FileUp className="w-4 h-4 text-orange-600" />
                      <span>Cargar Nómina SIGE</span>
                    </button>

                    <button
                      onClick={() => {
                        window.print();
                        setMenuAvanzadoAbierto(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>Imprimir Informe Oficial</span>
                    </button>
                  </div>

                  {onLimpiarDotacionColegio && (
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setModalVaciarSeguroAbierto(true);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                        <span>Vaciar Dotación del Período</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setModalExportarEstablecimientoAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow transition-all"
              title="Exportar dotación de este establecimiento (.slep.json)"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar .slep.json</span>
            </button>

            <button
              onClick={() => setModalImportarEstablecimientoAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-all"
              title="Importar dotación de establecimiento (.slep.json)"
            >
              <FileUp className="w-4 h-4" />
              <span>Importar</span>
            </button>

            <button
              onClick={onExportarExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow transition-all"
              title="Exportar archivo consolidado de todo el territorio SLEP"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Consolidado SLEP</span>
            </button>
          </div>
        </div>

        {/* 4 KPIs Clave en Tiempo Real */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          {/* 1. Balanza Lectiva */}
          <div className={`p-4 rounded-xl border transition-all ${
            balance > 0 
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
              : balance < 0 
                ? 'bg-red-50/60 border-red-200 text-red-950' 
                : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Balanza de Aula</span>
              <Scale className={`w-4 h-4 ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-red-600' : 'text-slate-500'}`} />
            </div>
            <div className="text-2xl font-black mt-1">
              {balance > 0 ? `+${balance} HA` : `${balance} HA`}
            </div>
            <div className="text-[11px] font-medium opacity-80 mt-1">
              {balance > 0 
                ? 'Superávit disponible para refuerzo' 
                : balance < 0 
                  ? 'Déficit docente por cubrir' 
                  : 'Dotación exactamente equilibrada'}
            </div>
          </div>

          {/* 2. Demanda Curricular */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Demanda Curricular</span>
              <BookOpen className="w-4 h-4 text-[#002B49]" />
            </div>
            <div className="text-2xl font-black text-[#002B49] mt-1">
              {bg?.horasAulaDemandadasCurriculo || 0} <span className="text-xs font-normal text-slate-400">HA</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {cursos.length} cursos matriculados
            </div>
          </div>

          {/* 3. Matrícula y Aforo */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Matrícula vs SAE</span>
              <LayoutGrid className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {bg?.totalMatriculaProyectada || 0} <span className="text-xs font-normal text-slate-400">/ {bg?.totalCuposSae || 0} cupos</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {salas.length} salas de clases registradas
            </div>
          </div>

          {/* 4. Demanda PIE */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Demanda PIE Dec. 170</span>
              <ShieldCheck className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-black text-orange-600 mt-1">
              {bg?.horasPieDemandadas || 0} <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              + {bg?.horasColaborativasDemandadas || 0}h co-docencia obligatorias
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por Pestañas Fluidas No Bloqueantes */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 overflow-x-auto text-xs font-medium">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isSelected = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isSelected ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido Dinámico de la Pestaña Seleccionada */}
      <div className="space-y-6">
        {tabActiva === 'balanza' && (
          <BalanzaDiagnosticoView
            diagnostico={diagnostico}
            onExportarExcel={onExportarExcel}
          />
        )}

        {tabActiva === 'docentes' && (
          <DocentesDotacionView
            colegio={colegio}
            docentes={docentes}
            asignaciones={asignaciones}
            onGuardarDocente={onGuardarDocente}
            onEliminarDocente={onEliminarDocente}
            todosLosColegios={todosLosColegios}
            todosLosDocentes={todosLosDocentes}
            todasLasAsignaciones={todasLasAsignaciones}
            cursos={cursos}
            onGuardarAsignacion={onGuardarAsignacion}
            onEliminarAsignacion={onEliminarAsignacion}
          />
        )}

        {tabActiva === 'cursos' && (
          <CurriculumDemandaView
            colegio={colegio}
            cursos={cursos}
            docentes={docentes}
            asignaciones={asignaciones}
            onGuardarCurso={onGuardarCurso}
            onEliminarCurso={onEliminarCurso}
            onGuardarAsignacion={onGuardarAsignacion}
            onEliminarAsignacion={onEliminarAsignacion}
            periodoActivo={periodoActivo}
          />
        )}

        {tabActiva === 'pie' && (
          <PieAuditorView
            colegio={colegio}
            cursos={cursos}
            docentes={docentes}
            asignaciones={asignaciones}
            onGuardarCurso={onGuardarCurso}
            onGuardarAsignacion={onGuardarAsignacion}
            onEliminarAsignacion={onEliminarAsignacion}
          />
        )}

        {tabActiva === 'salas' && (
          <SalasSaeView
            colegio={colegio}
            salas={salas}
            cursos={cursos}
            onGuardarSala={onGuardarSala}
            onEliminarSala={onEliminarSala}
            onGuardarCurso={onGuardarCurso}
          />
        )}
      </div>

      {/* Modales de Gestión de Dotación */}
      <ExportarEstablecimientoModal
        isOpen={modalExportarEstablecimientoAbierto}
        onClose={() => setModalExportarEstablecimientoAbierto(false)}
        establecimiento={colegio}
        periodo={periodoActivo || 2026}
        cursos={cursos}
        docentes={docentes}
        salas={salas}
        asignaciones={asignaciones}
      />

      <ImportarEstablecimientoModal
        isOpen={modalImportarEstablecimientoAbierto}
        onClose={() => setModalImportarEstablecimientoAbierto(false)}
        todosLosColegios={todosLosColegios}
        colegioActivo={colegio}
        periodoActivo={periodoActivo || 2026}
        onImportSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <MatrizExcelImportModal
        isOpen={modalMatrizAbierto}
        onClose={() => setModalMatrizAbierto(false)}
        colegioActivo={colegio}
        colegios={todosLosColegios}
        periodoPorDefecto={periodoActivo || 2026}
        onImportComplete={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <ComparadorPeriodosModal
        isOpen={modalComparadorAbierto}
        onClose={() => setModalComparadorAbierto(false)}
        colegioActivo={colegio}
        colegios={todosLosColegios}
        onPeriodoActualizado={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <ConfirmarVaciarDotacionModal
        isOpen={modalVaciarSeguroAbierto}
        onClose={() => setModalVaciarSeguroAbierto(false)}
        colegio={colegio}
        periodoActivo={periodoActivo}
        cursosCount={cursos.length}
        docentesCount={docentes.length}
        asignacionesCount={asignaciones.length}
        onConfirmarVaciar={handleEjecutarVaciarDotacion}
        onExportarRespaldoPrevio={onExportarDotacionColegio ? () => onExportarDotacionColegio(colegio, periodoActivo) : undefined}
      />
    </div>
  );
};

