import React, { useState } from 'react';
import {
  Scale, Users, BookOpen, Clock, ShieldCheck, LayoutGrid,
  FileSpreadsheet, Printer, ArrowRightLeft, FileUp, FileDown, Sparkles,
  Building2, MapPin, AlertTriangle, CheckCircle2, ChevronRight, Calendar, Trash2, ShieldAlert, ChevronDown
} from 'lucide-react';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion
} from '../types';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';
import { BalanzaDiagnosticoView } from './BalanzaDiagnosticoView';
import { DocentesDotacionView } from './DocentesDotacionView';
import { AsistentesDotacionView } from './AsistentesDotacionView';
import { CurriculumDemandaView } from './CurriculumDemandaView';
import { PieAuditorView } from './PieAuditorView';
import { SalasSaeView } from './SalasSaeView';
import { MatrizExcelImportModal } from '../components/MatrizExcelImportModal';
import { ComparadorPeriodosModal } from '../components/ComparadorPeriodosModal';
import { ModalTraspasoDotacion } from '../components/ModalTraspasoDotacion';
import { ConfirmarVaciarDotacionModal } from '../components/ConfirmarVaciarDotacionModal';
import { ExportarEstablecimientoModal } from '../components/ExportarEstablecimientoModal';
import { ImportarEstablecimientoModal } from '../components/ImportarEstablecimientoModal';

export interface ColegioWorkspaceViewProps {
  colegio: Establecimiento;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  asistentes?: AsistenteEducacion[];
  diagnostico: DiagnosticoColegioCompleto | null;
  onGuardarSala: (s: SalaInfraestructura) => Promise<void> | void;
  onEliminarSala: (id: string) => Promise<void> | void;
  onGuardarCurso: (c: CursoSae) => Promise<void> | void;
  onEliminarCurso: (id: string) => Promise<void> | void;
  onGuardarDocente: (d: Docente) => Promise<void> | void;
  onEliminarDocente: (id: string) => Promise<void> | void;
  onGuardarAsistente?: (a: AsistenteEducacion) => Promise<void> | void;
  onGuardarAsistentesBatch?: (asistentes: AsistenteEducacion[], reemplazar?: boolean) => Promise<void> | void;
  onEliminarAsistente?: (id: string) => Promise<void> | void;
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
  asistentes = [],
  diagnostico,
  onGuardarSala,
  onEliminarSala,
  onGuardarCurso,
  onEliminarCurso,
  onGuardarDocente,
  onEliminarDocente,
  onGuardarAsistente,
  onGuardarAsistentesBatch,
  onEliminarAsistente,
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
  const [tabActiva, setTabActiva] = useState<'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas'>('balanza');
  const [modalMatrizAbierto, setModalMatrizAbierto] = useState(false);
  const [modalComparadorAbierto, setModalComparadorAbierto] = useState(false);
  const [modalTraspasoAbierto, setModalTraspasoAbierto] = useState(false);
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
    { id: 'docentes' as const, label: 'Nómina Docente (Ley 20.903)', icon: Users, badge: `${docentes.length}` },
    { id: 'asistentes' as const, label: 'Asistentes Educación', icon: Users, badge: `${asistentes.length}` },
    { id: 'cursos' as const, label: 'Cursos & Planes MINEDUC', icon: BookOpen, badge: `${cursos.length}` },
    { id: 'pie' as const, label: 'Auditoría PIE (Dec. 170)', icon: ShieldCheck, badge: `${bg?.horasPieDemandadas || 0}h` },
    { id: 'salas' as const, label: 'Salas & Aforo SAE (Dec. 548)', icon: LayoutGrid, badge: `${salas.length}` }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Cockpit Ejecutivo Superior */}
      <div className="card-elevated p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-mono">
                RBD {colegio.rbd}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                periodoActivo === 2027 
                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}>
                <Calendar className="w-3 h-3" />
                {periodoActivo === 2027 ? 'Dotación 2027 (Proyectada)' : 'Dotación 2026 (Actual)'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {colegio.comuna}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Régimen {colegio.regimen} ({colegio.porcentajePrioritarios}% SEP - {colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35'})
              </span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-2 flex items-center gap-3">
              <span>{colegio.nombre}</span>
              <button
                onClick={onAbrirNavegadorColegios}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 px-2.5 py-1 rounded-xl border border-orange-200 dark:border-orange-800/60 transition-colors inline-flex items-center gap-1 active:scale-[0.98]"
                title="Cambiar de escuela (Ctrl+K / ⌘K)"
              >
                <span>Cambiar Escuela</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Director: <strong className="text-slate-700 dark:text-slate-300">{colegio.director || 'No especificado'}</strong> • Asesor UATP: <strong className="text-slate-700 dark:text-slate-300">{colegio.asesorUatp || 'UATP Valle Diguillín'}</strong>
            </p>
          </div>

          {/* Barra de Acciones Desduplicada */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* 1. Asistente IA */}
            {onAbrirCopilot && (
              <button
                onClick={onAbrirCopilot}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 border border-blue-400/30 group active:scale-[0.98]"
                title="Abrir asistente ¡Qué no va a saber! IA para este colegio (Ctrl+J / ⌘J)"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                <span>¡Qué no va a saber! IA</span>
              </button>
            )}

            {/* 2. Importar Matriz Excel */}
            <button
              onClick={() => setModalMatrizAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm border border-slate-700/80 active:scale-[0.98]"
              title="Importar planilla Excel oficial con asignaciones"
            >
              <FileSpreadsheet className="w-4 h-4 text-orange-400" />
              <span>Importar Matriz</span>
            </button>

            {/* 3. Traspaso de Dotación */}
            <button
              onClick={() => setModalTraspasoAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98]"
              title="Asistente guiado de traspaso de dotación 2026 a 2027"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Traspaso 2026 ➔ 2027</span>
            </button>

            {/* 4. Menú Desplegable Consolidado de Acciones & Reportes */}
            <div className="relative">
              <button
                onClick={() => setMenuAvanzadoAbierto(!menuAvanzadoAbierto)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-sm active:scale-[0.98]"
                title="Más acciones, exportaciones y reportes"
              >
                <span>Acciones & Reportes</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuAvanzadoAbierto ? 'rotate-180' : ''}`} />
              </button>

              {menuAvanzadoAbierto && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800 backdrop-blur-md">
                  
                  {/* Reportes y Exportaciones */}
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setModalComparadorAbierto(true);
                        setMenuAvanzadoAbierto(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors text-left"
                    >
                      <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Comparar 2026 vs 2027</span>
                    </button>

                    {onExportarMatrizExcelColegio && (
                      <button
                        onClick={() => {
                          onExportarMatrizExcelColegio(colegio, periodoActivo);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Exportar Matriz Oficial Excel (.xlsx)</span>
                      </button>
                    )}

                    {onExportarDotacionColegio && (
                      <button
                        onClick={() => {
                          onExportarDotacionColegio(colegio, periodoActivo);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-left"
                      >
                        <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Exportar Ficha (.slep)</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setModalImportarEstablecimientoAbierto(true);
                        setMenuAvanzadoAbierto(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <FileUp className="w-4 h-4 text-slate-500" />
                      <span>Importar Ficha (.slep)</span>
                    </button>

                    <button
                      onClick={() => {
                        onAbrirModuloSige();
                        setMenuAvanzadoAbierto(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 hover:text-orange-700 dark:hover:text-orange-300 transition-colors text-left"
                    >
                      <FileUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span>Cargar Nómina SIGE</span>
                    </button>

                    <button
                      onClick={() => {
                        window.print();
                        setMenuAvanzadoAbierto(false);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>Imprimir Informe Oficial</span>
                    </button>
                  </div>

                  {/* Zona de Peligro */}
                  {onLimpiarDotacionColegio && (
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setModalVaciarSeguroAbierto(true);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors text-left"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        <span>Vaciar Dotación del Período</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 4 KPIs Clave en Formato Bento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          
          {/* 1. Balanza Lectiva */}
          <div className={`p-4 rounded-2xl border transition-all ${
            balance > 0 
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200' 
              : balance < 0 
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200' 
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Balanza de Aula</span>
              <Scale className="w-4 h-4 opacity-75" />
            </div>
            <div className="text-2xl font-black mt-1 tabular-nums font-mono">
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
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Demanda Curricular</span>
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums font-mono">
              {bg?.horasAulaDemandadasCurriculo || 0} <span className="text-xs font-normal text-slate-400">HA</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {cursos.length} cursos matriculados
            </div>
          </div>

          {/* 3. Matrícula y Aforo */}
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Matrícula vs SAE</span>
              <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums font-mono">
              {bg?.totalMatriculaProyectada || 0} <span className="text-xs font-normal text-slate-400">/ {bg?.totalCuposSae || 0} cupos</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {salas.length} salas de clases registradas
            </div>
          </div>

          {/* 4. Demanda PIE */}
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Demanda PIE Dec. 170</span>
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums font-mono">
              {bg?.horasPieDemandadas || 0} <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              + {bg?.horasColaborativasDemandadas || 0}h co-docencia obligatorias
            </div>
          </div>

        </div>
      </div>

      {/* Navegación por Pestañas Estilizadas */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5 overflow-x-auto text-xs font-medium">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isSelected = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all whitespace-nowrap active:scale-[0.98] ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-soft-sm dark:bg-blue-600 dark:text-white'
                  : 'card-elevated text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-orange-400 dark:text-amber-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums font-mono ${
                isSelected ? 'bg-orange-500 text-white dark:bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido de Pestaña */}
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

        {tabActiva === 'asistentes' && onGuardarAsistente && onEliminarAsistente && (
          <AsistentesDotacionView
            colegio={colegio}
            asistentes={asistentes}
            matricula={cursos.reduce((sum, c) => sum + (c.matriculaProyectada || 0), 0)}
            salasParvulo={salas.filter((s) => s.tipo === 'PARVULARIA').length}
            periodoActivo={periodoActivo}
            onGuardarAsistente={onGuardarAsistente}
            onGuardarAsistentesBatch={onGuardarAsistentesBatch}
            onEliminarAsistente={onEliminarAsistente}
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
            onSincronizarMalla={onRefreshData}
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

      {/* Modales */}
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

      <ModalTraspasoDotacion
        isOpen={modalTraspasoAbierto}
        onClose={() => setModalTraspasoAbierto(false)}
        colegioActivo={colegio}
        colegios={todosLosColegios}
        periodoOrigen={2026}
        periodoDestino={2027}
        onTraspasoCompletado={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
