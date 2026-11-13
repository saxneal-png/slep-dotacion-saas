import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, BookOpen, Sparkles, RotateCcw, Save } from 'lucide-react';
import { AsignaturaPlanEstudio, CursoSae, Establecimiento, PlanEstudioCurricular } from '../../../types';
import { InfoPlanResuelto } from '../../../services/curricularPlanService';

interface PersonalizarPlanColegioModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegio: Establecimiento;
  curso: CursoSae;
  infoPlanActual: InfoPlanResuelto;
  planColegioExistente: PlanEstudioCurricular | null;
  onGuardarPlanColegio: (plan: PlanEstudioCurricular) => Promise<void>;
  onRestaurarPlanOficial?: (planId: string) => Promise<void>;
}

export const PersonalizarPlanColegioModal: React.FC<PersonalizarPlanColegioModalProps> = ({
  isOpen,
  onClose,
  colegio,
  curso,
  infoPlanActual,
  planColegioExistente,
  onGuardarPlanColegio,
  onRestaurarPlanOficial
}) => {
  const [asignaturas, setAsignaturas] = useState<AsignaturaPlanEstudio[]>([]);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [nuevaHoras, setNuevaHoras] = useState<number>(2);
  const [nuevoCaracter, setNuevoCaracter] = useState<'Obligatoria' | 'Electiva' | 'Opcional'>('Obligatoria');
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setNuevaNombre('');
    setNuevaHoras(2);
    setNuevoCaracter('Obligatoria');

    if (planColegioExistente && planColegioExistente.asignaturas.length > 0) {
      setAsignaturas(planColegioExistente.asignaturas.map(a => ({ ...a })));
    } else {
      setAsignaturas(
        infoPlanActual.asignaturas.map((a, idx) => ({
          id: `asig-base-${idx}`,
          nombre: a.nombre,
          horasSemanales: a.horas,
          caracter: (a.caracter as any) || 'Obligatoria'
        }))
      );
    }
  }, [isOpen, planColegioExistente, infoPlanActual]);

  if (!isOpen) return null;

  const totalHorasAsignaturas = asignaturas.reduce((s, a) => s + (Number(a.horasSemanales) || 0), 0);
  const horasLibre = infoPlanActual.horasLibreDisposicion || 0;

  const handleAgregarAsignatura = () => {
    const nombreLimpio = nuevaNombre.trim();
    if (!nombreLimpio) {
      setErrorMsg('Ingresa el nombre de la asignatura.');
      return;
    }
    if (asignaturas.some(a => a.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase())) {
      setErrorMsg('Ya existe una asignatura con ese nombre en este plan.');
      return;
    }
    const hrs = Math.max(1, Math.min(44, Number(nuevaHoras) || 1));
    setErrorMsg(null);
    setAsignaturas(prev => [
      ...prev,
      {
        id: `asig-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: nombreLimpio,
        horasSemanales: hrs,
        caracter: nuevoCaracter
      }
    ]);
    setNuevaNombre('');
    setNuevaHoras(2);
  };

  const handleActualizarHoras = (idx: number, horas: number) => {
    const val = Math.max(1, Math.min(44, Number(horas) || 1));
    setAsignaturas(prev => prev.map((a, i) => (i === idx ? { ...a, horasSemanales: val } : a)));
  };

  const handleEliminarAsignatura = (idx: number) => {
    setAsignaturas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGuardar = async () => {
    if (asignaturas.length === 0) {
      setErrorMsg('El plan debe tener al menos una asignatura.');
      return;
    }
    setGuardando(true);
    setErrorMsg(null);
    try {
      const planAGuardar: PlanEstudioCurricular = {
        id: planColegioExistente?.id || '',
        rbd: colegio.rbd,
        nivel: curso.nivel,
        regimen: curso.regimen === 'JEC' ? 'JEC' : 'No JEC',
        categoria: (infoPlanActual.categoria as any) || 'OTRO',
        documento: `Plan Personalizado ${colegio.nombre}`,
        decretoSupremo: `Personalizado RBD ${colegio.rbd}`,
        totalHorasSemanalesObligatorias: totalHorasAsignaturas,
        horasLibreDisposicion: horasLibre,
        totalHorasPlan: totalHorasAsignaturas + horasLibre,
        asignaturas,
        esPersonalizado: true
      };
      await onGuardarPlanColegio(planAGuardar);
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error al guardar la personalización del plan.');
    } finally {
      setGuardando(false);
    }
  };

  const handleRestaurar = async () => {
    if (!planColegioExistente || !onRestaurarPlanOficial) return;
    setGuardando(true);
    try {
      await onRestaurarPlanOficial(planColegioExistente.id);
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error al restaurar el plan oficial.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Personalizar Plan de Estudio del Establecimiento</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {colegio.nombre} (RBD {colegio.rbd}) • Nivel: <strong>{curso.nivel}</strong> ({curso.regimen})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
            Esta personalización se almacena <strong>exclusivamente para {colegio.nombre}</strong> y no modifica el catálogo general de Planes de Estudio MINEDUC ni afecta a otros establecimientos.
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Formulario para crear nueva asignatura en este plan */}
          <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 space-y-2.5">
            <div className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-orange-600" />
              <span>Agregar Nueva Asignatura al Plan de esta Escuela</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={nuevaNombre}
                onChange={e => setNuevaNombre(e.target.value)}
                placeholder="Ej: Taller de Robótica, Lengua Mapudungun..."
                className="sm:col-span-6 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <select
                value={nuevoCaracter}
                onChange={e => setNuevoCaracter(e.target.value as any)}
                className="sm:col-span-3 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="Obligatoria">Obligatoria</option>
                <option value="Electiva">Electiva</option>
                <option value="Opcional">Opcional</option>
              </select>
              <div className="sm:col-span-3 flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={44}
                  value={nuevaHoras}
                  onChange={e => setNuevaHoras(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={handleAgregarAsignatura}
                  className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Listado de asignaturas del plan escolar */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] border-b">
                <tr>
                  <th className="px-3.5 py-2">Asignatura</th>
                  <th className="px-3.5 py-2">Carácter</th>
                  <th className="px-3.5 py-2 text-center">Horas Sem. (HA)</th>
                  <th className="px-3.5 py-2 text-right">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {asignaturas.map((asig, idx) => (
                  <tr key={asig.id || idx} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2 font-medium text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{asig.nombre}</span>
                    </td>
                    <td className="px-3.5 py-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {asig.caracter || 'Obligatoria'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        max={44}
                        value={asig.horasSemanales}
                        onChange={e => handleActualizarHoras(idx, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs border border-slate-300 rounded text-center font-bold"
                      />
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEliminarAsignatura(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Eliminar asignatura de este plan escolar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <span className="text-slate-600">
              Total asignaturas: <strong>{asignaturas.length}</strong> ({totalHorasAsignaturas} HA)
              {horasLibre > 0 ? ` + ${horasLibre} HA Libre Disposición` : ''}
            </span>
            <span className="font-black text-slate-800">
              Total Plan: {totalHorasAsignaturas + horasLibre} HA
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div>
            {planColegioExistente && onRestaurarPlanOficial && (
              <button
                type="button"
                disabled={guardando}
                onClick={handleRestaurar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Plan Oficial</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={handleGuardar}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{guardando ? 'Guardando...' : 'Guardar Plan del Establecimiento'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
