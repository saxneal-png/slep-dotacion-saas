import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  Layers,
  Users,
  Key,
  Code,
  Download,
  Trash2,
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Table,
  GraduationCap,
  BookOpen,
  Briefcase
} from 'lucide-react';
import { FileUpload } from '../components/analizador/FileUpload';
import { KpiCards } from '../components/analizador/KpiCards';
import { ConsolidatedTable } from '../components/analizador/ConsolidatedTable';
import { TeacherDetailTable } from '../components/analizador/TeacherDetailTable';
import { CourseTeacherLoadView } from '../components/analizador/CourseTeacherLoadView';
import { AsistentesAnalizadorView } from '../components/analizador/AsistentesAnalizadorView';
import { ApiKeyModal } from '../components/analizador/ApiKeyModal';
import { PromptModal } from '../components/analizador/PromptModal';
import { TraspasoDotacionModal } from '../components/analizador/TraspasoDotacionModal';
import { inicializarPlanesEstudioAnalizador, getPlanesEstudioAnalizadorCache } from '../services/analizador/planesEstudioBridge';
import { processDotacionFilesClient, recalculateSchoolTotals } from '../services/analizador/dotacionProcessor';
import { exportConsolidatedExcelBrowser, exportCsvBrowser } from '../services/analizador/excelExporter';
import type { AsistenteAnalizadoRecord } from '../services/analizador/asistentesClassifier';
import {
  guardarEstablecimiento,
  guardarDocente,
  guardarCurso,
  guardarAsignacion,
  listarEstablecimientos
} from '../database/db';
import type {
  SchoolSummary,
  TeacherRecord,
  CourseLoadSummary,
  TeacherConsolidatedLoad,
  KpiStats,
  GeminiModel
} from '../types/analizadorTypes';

const FALLBACK_MODELS: GeminiModel[] = [
  {
    id: 'gemini-3.8-flash',
    display_name: 'Gemini 3.8 Flash',
    description: 'Modelo de última generación. Velocidad extrema y alta precisión para clasificación masiva.',
    badge: 'Nueva Generación',
    is_recommended: true,
  },
  {
    id: 'gemini-3.7-flash',
    display_name: 'Gemini 3.7 Flash',
    description: 'Modelo híbrido de razonamiento ágil y procesamiento textual ultrarrápido.',
    badge: 'Recomendado',
    is_recommended: true,
  },
  {
    id: 'gemini-2.5-flash',
    display_name: 'Gemini 2.5 Flash',
    description: 'Modelo consolidado, rápido, económico y óptimo para planillas escolares.',
    badge: 'Estable',
    is_recommended: false,
  },
  {
    id: 'gemini-2.0-flash',
    display_name: 'Gemini 2.0 Flash',
    description: 'Alta velocidad y precisión estándar.',
    badge: 'Rápido',
    is_recommended: false,
  },
];

interface AnalizadorDotacionViewProps {
  onSyncWithDatabase?: () => Promise<void>;
  onNavigateToColegio?: (rbd: string) => void;
}

export const AnalizadorDotacionView: React.FC<AnalizadorDotacionViewProps> = ({
  onSyncWithDatabase,
  onNavigateToColegio
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'consolidated' | 'teachers' | 'asistentes' | 'courses'>('upload');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('gemini_model') || 'gemini-3.7-flash');
  const [models, setModels] = useState<GeminiModel[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_models');
      if (saved) return JSON.parse(saved);
    } catch {}
    return FALLBACK_MODELS;
  });

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [isTraspasoModalOpen, setIsTraspasoModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [totalPlanesCurriculares, setTotalPlanesCurriculares] = useState<number>(0);

  useEffect(() => {
    inicializarPlanesEstudioAnalizador().then((p) => {
      setTotalPlanesCurriculares(p.length);
    });
  }, []);

  const [schools, setSchools] = useState<SchoolSummary[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_schools');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [teachers, setTeachers] = useState<TeacherRecord[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_teachers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [asistentes, setAsistentes] = useState<AsistenteAnalizadoRecord[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_asistentes_analizados');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [courses, setCourses] = useState<CourseLoadSummary[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_courses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [teacherLoads, setTeacherLoads] = useState<TeacherConsolidatedLoad[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_teacher_loads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [kpis, setKpis] = useState<KpiStats>(() => {
    try {
      const saved = localStorage.getItem('dotacion_kpis');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      total_schools: 0,
      total_teachers: 0,
      total_matricula: 0,
      total_courses: 0,
      total_horas_general: 0,
      total_horas_aula: 0,
      total_horas_directivas: 0,
      total_horas_tecnicas: 0,
      pct_aula: 0,
      pct_directivas: 0,
      pct_tecnicas: 0,
      discrepancies_count: 0,
    };
  });

  const [selectedRbd, setSelectedRbd] = useState<string>('ALL');
  const [selectedComuna, setSelectedComuna] = useState<string>('ALL');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    showToast('Clave de Gemini AI guardada correctamente.');
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('gemini_model', model);
    showToast(`Modelo de IA seleccionado: ${model}`);
  };

  const handleUpdateModels = (newModels: GeminiModel[]) => {
    setModels(newModels);
    try {
      localStorage.setItem('gemini_models', JSON.stringify(newModels));
    } catch {}
  };

  const handleProcessFiles = async (files: File[]) => {
    setLoading(true);
    try {
      const customPrompt = localStorage.getItem('gemini_custom_prompt') || undefined;
      const result = await processDotacionFilesClient(files, apiKey, selectedModel, customPrompt);

      setSchools(result.schools);
      setTeachers(result.teachers);
      setCourses(result.courses);
      setTeacherLoads(result.teacherLoads);
      setAsistentes(result.asistentes || []);
      setKpis(result.kpis);

      try {
        localStorage.setItem('dotacion_schools', JSON.stringify(result.schools));
        localStorage.setItem('dotacion_teachers', JSON.stringify(result.teachers));
        localStorage.setItem('dotacion_courses', JSON.stringify(result.courses));
        localStorage.setItem('dotacion_teacher_loads', JSON.stringify(result.teacherLoads));
        localStorage.setItem('dotacion_asistentes_analizados', JSON.stringify(result.asistentes || []));
        localStorage.setItem('dotacion_kpis', JSON.stringify(result.kpis));
      } catch {}

      setActiveTab('consolidated');
      const asistMsg = result.asistentes && result.asistentes.length > 0 ? ` y ${result.asistentes.length} asistentes analizados` : '';
      showToast(`¡Se procesaron exitosamente ${result.schools.length} establecimientos con ${result.courses.length} cursos${asistMsg}!`);
    } catch (err: any) {
      showToast(err.message || 'Error al procesar las planillas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReclassify = async (teacherIndex: number, newCategory: 'AULA' | 'TECNICA' | 'DIRECTIVA') => {
    const updated = [...teachers];
    if (updated[teacherIndex]) {
      updated[teacherIndex] = {
        ...updated[teacherIndex],
        category: newCategory,
        source: 'Reclasificación Manual de Usuario',
      };

      const result = recalculateSchoolTotals(updated, schools);
      setTeachers(updated);
      setSchools(result.schools);
      setKpis(result.kpis);
      setCourses(result.courses);
      setTeacherLoads(result.teacherLoads);

      try {
        localStorage.setItem('dotacion_teachers', JSON.stringify(updated));
        localStorage.setItem('dotacion_schools', JSON.stringify(result.schools));
        localStorage.setItem('dotacion_kpis', JSON.stringify(result.kpis));
        localStorage.setItem('dotacion_courses', JSON.stringify(result.courses));
        localStorage.setItem('dotacion_teacher_loads', JSON.stringify(result.teacherLoads));
      } catch {}

      showToast(`Reclasificado a ${newCategory} con recálculo dinámico en tiempo real.`);
    }
  };

  const handleBulkReclassify = async (indices: number[], newCategory: 'AULA' | 'TECNICA' | 'DIRECTIVA') => {
    const updated = [...teachers];
    indices.forEach((idx) => {
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          category: newCategory,
          source: 'Reclasificación Masiva de Usuario',
        };
      }
    });

    const result = recalculateSchoolTotals(updated, schools);
    setTeachers(updated);
    setSchools(result.schools);
    setKpis(result.kpis);
    setCourses(result.courses);
    setTeacherLoads(result.teacherLoads);

    try {
      localStorage.setItem('dotacion_teachers', JSON.stringify(updated));
      localStorage.setItem('dotacion_schools', JSON.stringify(result.schools));
      localStorage.setItem('dotacion_kpis', JSON.stringify(result.kpis));
      localStorage.setItem('dotacion_courses', JSON.stringify(result.courses));
      localStorage.setItem('dotacion_teacher_loads', JSON.stringify(result.teacherLoads));
    } catch {}

    showToast(`¡Se reclasificaron ${indices.length} funciones a ${newCategory}!`);
  };

  const handleClearData = () => {
    if (!window.confirm('¿Deseas limpiar todos los datos del analizador y reiniciar?')) return;
    setSchools([]);
    setTeachers([]);
    setCourses([]);
    setTeacherLoads([]);
    setAsistentes([]);
    setKpis({
      total_schools: 0,
      total_teachers: 0,
      total_matricula: 0,
      total_courses: 0,
      total_horas_general: 0,
      total_horas_aula: 0,
      total_horas_directivas: 0,
      total_horas_tecnicas: 0,
      pct_aula: 0,
      pct_directivas: 0,
      pct_tecnicas: 0,
      discrepancies_count: 0,
    });
    localStorage.removeItem('dotacion_schools');
    localStorage.removeItem('dotacion_teachers');
    localStorage.removeItem('dotacion_courses');
    localStorage.removeItem('dotacion_teacher_loads');
    localStorage.removeItem('dotacion_asistentes_analizados');
    localStorage.removeItem('dotacion_kpis');
    setActiveTab('upload');
    showToast('Datos reiniciados.');
  };

  const handleSaveToSqlite = async () => {
    if (schools.length === 0) return;
    setSavingDb(true);
    try {
      const existingColegios = await listarEstablecimientos();

      for (const s of schools) {
        let est = existingColegios.find((c) => c.rbd === s.rbd);
        if (!est) {
          est = {
            id: `est-${s.rbd}`,
            rbd: s.rbd,
            nombre: s.establishment,
            comuna: (s.comuna as any) || 'Chillán',
            regimen: 'JEC',
            porcentajePrioritarios: 75,
          };
          await guardarEstablecimiento(est);
        }

        // Guardar Cursos
        const schoolCourses = courses.filter((c) => c.rbd === s.rbd);
        for (const sc of schoolCourses) {
          await guardarCurso({
            id: `curso-${s.rbd}-${sc.curso.replace(/\s+/g, '-')}`,
            rbd: s.rbd,
            periodo: 2026,
            nivel: sc.nivel,
            letra: sc.letra,
            regimen: 'JEC',
            cupoSae: 35,
            matriculaProyectada: Math.round(s.matricula / Math.max(1, schoolCourses.length)),
            alumnosNeet: 5,
            alumnosNeep: 2,
          });
        }

        // Guardar Docentes
        const schoolTeacherLoads = teacherLoads.filter((d) => d.rbd === s.rbd);
        for (const dl of schoolTeacherLoads) {
          await guardarDocente({
            id: `doc-${s.rbd}-${dl.rut.replace(/[^0-9kK]/g, '')}`,
            rbd: s.rbd,
            periodo: 2026,
            run: dl.rut || `TEMP-${dl.teacher_name.slice(0, 8)}`,
            nombres: dl.teacher_name.split(' ')[0] || 'Docente',
            apellidos: dl.teacher_name.split(' ').slice(1).join(' ') || '',
            calidadJuridica: 'TITULAR',
            estamento: 'DOCENTE_AULA',
            horasContrato: dl.horas_contrato,
            horasAula: dl.horas_aula,
            horasDirectivas: dl.horas_directivas,
            horasTecnicoPedagogicas: dl.horas_tecnicas,
          });

          // Guardar Asignaciones
          for (const asig of dl.cursos) {
            await guardarAsignacion({
              id: `asig-${s.rbd}-${dl.rut}-${asig.curso}-${asig.asignatura}`.replace(/\s+/g, '-'),
              rbd: s.rbd,
              periodo: 2026,
              cursoId: `curso-${s.rbd}-${asig.curso.replace(/\s+/g, '-')}`,
              docenteId: `doc-${s.rbd}-${dl.rut.replace(/[^0-9kK]/g, '')}`,
              asignatura: asig.asignatura,
              horasPedagogicasAula: asig.horas,
            });
          }
        }
      }

      if (onSyncWithDatabase) {
        await onSyncWithDatabase();
      }

      showToast(`¡Sincronización exitosa! ${schools.length} establecimientos incorporados a la base SQLite local.`);
    } catch (err: any) {
      console.error('Error guardando en SQLite:', err);
      showToast(`Error al guardar en SQLite: ${err.message || err}`, 'error');
    } finally {
      setSavingDb(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notificación */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border border-slate-700'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Cockpit Superior del Analizador */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-800">
                Motor Híbrido SLEP
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1" title="Planes curriculares sincronizados con SQLite">
                <BookOpen className="w-3 h-3 text-emerald-700" />
                {totalPlanesCurriculares > 0 ? `${totalPlanesCurriculares} Planes SQLite` : 'Planes MINEDUC & EPJA'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {selectedModel}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">
                {schools.length} Colegios • {teachers.length} Registros • {courses.length} Cursos
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1.5 flex items-center gap-2">
              Analizador de Dotación, Cursos y Carga Horaria
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Procesa planillas escolares en lote, clasifica funciones según normativa ministerial y audita la carga horaria completa de cada docente por curso.
            </p>
          </div>

          {/* Botones de Acción Global */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200"
              title="Configurar clave de Gemini AI"
            >
              <Key className="w-3.5 h-3.5 text-orange-500" /> API Key
            </button>

            <button
              onClick={() => setIsPromptModalOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200"
              title="Personalizar prompt del sistema"
            >
              <Code className="w-3.5 h-3.5 text-indigo-500" /> Prompt IA
            </button>

            {schools.length > 0 && (
              <>
                <button
                  onClick={() => exportConsolidatedExcelBrowser(schools, teachers, courses, teacherLoads)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                  title="Descargar Excel oficial de 3 hojas con Consolidado, Auditoría y Carga por Cursos"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar Excel
                </button>

                <button
                  onClick={() => exportCsvBrowser(schools)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200"
                  title="Exportar archivo CSV para sistemas SLEP"
                >
                  CSV
                </button>

                <button
                  onClick={() => setIsTraspasoModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-600/20 flex items-center gap-1.5"
                  title="Traspasar a la Dotación oficial 2026 homologando asignaturas con IA y controlando descuadres"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Traspasar a Dotación 2026 (con IA)</span>
                </button>

                <button
                  onClick={handleSaveToSqlite}
                  disabled={savingDb}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                  title="Guardado directo rápido en SQLite"
                >
                  {savingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-slate-500" />}
                  <span>Rápido</span>
                </button>

                <button
                  onClick={handleClearData}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Limpiar y reiniciar análisis"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra de Pestañas Principales */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Cargar Planillas</span>
          </button>

          <button
            onClick={() => setActiveTab('consolidated')}
            disabled={schools.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'consolidated'
                ? 'bg-blue-600 text-white shadow-xs'
                : schools.length === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Consolidado SLEP ({schools.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            disabled={teachers.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'teachers'
                ? 'bg-blue-600 text-white shadow-xs'
                : teachers.length === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Auditoría Docentes ({teachers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('asistentes')}
            disabled={asistentes.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'asistentes'
                ? 'bg-blue-600 text-white shadow-xs'
                : asistentes.length === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Asistentes Educación ({asistentes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            disabled={teachers.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'courses'
                ? 'bg-blue-600 text-white shadow-xs'
                : teachers.length === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Cursos y Carga Asignada ({courses.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards si hay datos procesados */}
      {schools.length > 0 && <KpiCards kpis={kpis} />}

      {/* Loading Overlay */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto shadow-xs animate-spin">
            <Loader2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Analizando planillas y consultando motor híbrido...
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Procesando horas, detectando cursos, clasificando asignaturas en Aula/Técnica/Directiva y cuadrando dotaciones.
          </p>
        </div>
      )}

      {/* Contenido de la Pestaña Activa */}
      {!loading && (
        <>
          {activeTab === 'upload' && (
            <FileUpload
              onProcessFiles={handleProcessFiles}
              loading={loading}
              onOpenPromptModal={() => setIsPromptModalOpen(true)}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
              models={models}
              onOpenKeyModal={() => setIsKeyModalOpen(true)}
            />
          )}

          {activeTab === 'consolidated' && (
            <ConsolidatedTable
              schools={schools}
              selectedComuna={selectedComuna}
              onSelectComuna={setSelectedComuna}
              onSelectSchool={(rbd) => {
                setSelectedRbd(rbd);
                setActiveTab('teachers');
              }}
            />
          )}

          {activeTab === 'teachers' && (
            <TeacherDetailTable
              teachers={teachers}
              schools={schools}
              selectedRbd={selectedRbd}
              onSelectRbd={setSelectedRbd}
              selectedComuna={selectedComuna}
              onSelectComuna={setSelectedComuna}
              onReclassify={handleReclassify}
              onBulkReclassify={handleBulkReclassify}
            />
          )}

          {activeTab === 'asistentes' && (
            <AsistentesAnalizadorView
              asistentes={asistentes}
              apiKey={apiKey}
              selectedModel={selectedModel}
              onUpdateAsistentes={(updated) => {
                setAsistentes(updated);
                try {
                  localStorage.setItem('dotacion_asistentes_analizados', JSON.stringify(updated));
                } catch {}
              }}
              onSyncWithDatabase={onSyncWithDatabase}
              onNavigateToColegio={onNavigateToColegio}
              onOpenApiKeyModal={() => setIsKeyModalOpen(true)}
            />
          )}

          {activeTab === 'courses' && (
            <CourseTeacherLoadView
              teacherLoads={teacherLoads}
              courses={courses}
              schools={schools}
              selectedRbd={selectedRbd}
              onSelectRbd={setSelectedRbd}
              selectedComuna={selectedComuna}
              onSelectComuna={setSelectedComuna}
            />
          )}
        </>
      )}

      {/* Modales */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        models={models}
        onUpdateModels={handleUpdateModels}
      />

      <PromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        onNotify={(msg, type) => showToast(msg, type || 'success')}
      />

      <TraspasoDotacionModal
        isOpen={isTraspasoModalOpen}
        onClose={() => setIsTraspasoModalOpen(false)}
        schools={schools}
        teachers={teachers}
        courses={courses}
        teacherLoads={teacherLoads}
        apiKey={apiKey}
        selectedModel={selectedModel}
        onTransferSuccess={async (res, targetRbd) => {
          if (onSyncWithDatabase) await onSyncWithDatabase();
          showToast(`¡Traspaso exitoso! ${res.colegiosProcesados} colegio(s), ${res.cursosCreados} cursos y ${res.asignacionesGuardadas} asignaciones guardadas en 2026.`);
          if (targetRbd && onNavigateToColegio) {
            onNavigateToColegio(targetRbd);
          }
        }}
      />
    </div>
  );
};
