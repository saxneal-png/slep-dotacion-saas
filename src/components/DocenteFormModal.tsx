import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Coins, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Scale, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import type { 
  Docente, 
  CalidadJuridicaDocente, 
  EstamentoDocente, 
  FuncionNoAulaDocente, 
  TipoFuncionNoAula, 
  FuenteFinanciamientoFuncion 
} from '../types';

export const ESTAMENTOS: { id: EstamentoDocente; label: string }[] = [
  { id: 'DOCENTE_AULA', label: 'Docente de Aula Regular' },
  { id: 'DOCENTE_DIFERENCIAL', label: 'Docente Educación Diferencial (PIE)' },
  { id: 'PROFESIONAL_PAE', label: 'Profesional Asistente PAE (Fono/Psico/TO)' },
  { id: 'TECNICO_ESPECIAL', label: 'Técnico en Educación Especial' },
  { id: 'ASISTENTE_AULA', label: 'Asistente de Aula' },
  { id: 'DIRECTIVO', label: 'Directivo' },
  { id: 'TECNICO_PEDAGOGICO', label: 'Técnico Pedagógico (UTP)' },
  { id: 'COORDINADOR_CRA', label: 'Coordinador CRA' },
  { id: 'OTRA_ESTABLECIMIENTO', label: 'Otra Función' }
];

export const TIPOS_FUNCIONES_LABELS: Record<TipoFuncionNoAula, { label: string; defaultNombre: string; badgeColor: string }> = {
  DIRECTIVA: { label: 'Gestión Directiva (Dirección / Subdirección)', defaultNombre: 'Dirección / Subdirección', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  INSPECTORIA: { label: 'Inspectoría General', defaultNombre: 'Inspectoría General', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  UTP: { label: 'Jefatura Técnico-Pedagógica (UTP)', defaultNombre: 'Jefatura UTP', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  COORDINACION: { label: 'Coordinación Pedagógica UTP', defaultNombre: 'Coordinación UTP', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  CONVIVENCIA: { label: 'Encargado Convivencia Escolar', defaultNombre: 'Convivencia Escolar', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  CRA: { label: 'Coordinación CRA (Biblioteca)', defaultNombre: 'Coordinador CRA', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  ENLACES: { label: 'Enlaces / Informática Educativa', defaultNombre: 'Coordinador Enlaces / TIC', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  EXTRAESCOLAR: { label: 'Actividades Extraescolares / ACLE', defaultNombre: 'Encargado Extraescolar', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  EVALUACION: { label: 'Evaluador Pedagógico', defaultNombre: 'Evaluador Pedagógico', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  ORIENTACION: { label: 'Orientación Educacional', defaultNombre: 'Orientador Educacional', badgeColor: 'bg-teal-100 text-teal-800 border-teal-200' },
  GREMIAL: { label: 'Horas Gremiales / Dirigencia Docente', defaultNombre: 'Horas Gremiales', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
  ADMINISTRATIVA: { label: 'Función Administrativa / Apoyo Institucional', defaultNombre: 'Apoyo Administrativo', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' },
  OTRA: { label: 'Otra Función Fuera de Aula', defaultNombre: 'Función No Aula', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' }
};

interface DocenteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardarDocente: (docente: Docente) => void;
  editingDoc: Docente | null;
  rbd: string;
  periodoActivo?: number;
}

export const DocenteFormModal: React.FC<DocenteFormModalProps> = ({
  isOpen,
  onClose,
  onGuardarDocente,
  editingDoc,
  rbd,
  periodoActivo = 2026
}) => {
  const [run, setRun] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [titulo, setTitulo] = useState('');
  const [calidadJuridica, setCalidadJuridica] = useState<CalidadJuridicaDocente>('TITULAR');
  const [estamento, setEstamento] = useState<EstamentoDocente>('DOCENTE_AULA');
  const [horasContrato, setHorasContrato] = useState(44);
  const [asignaturaPrincipal, setAsignaturaPrincipal] = useState('Lenguaje y Comunicación');
  const [aplicaArticulo69, setAplicaArticulo69] = useState(false);

  // Funciones no aula / administrativas
  const [funcionesNoAula, setFuncionesNoAula] = useState<FuncionNoAulaDocente[]>([]);
  const [nuevaFuncionTipo, setNuevaFuncionTipo] = useState<TipoFuncionNoAula>('COORDINACION');
  const [nuevaFuncionNombre, setNuevaFuncionNombre] = useState('');
  const [nuevaFuncionHoras, setNuevaFuncionHoras] = useState<number | ''>('');
  const [nuevaFuncionFinanciamiento, setNuevaFuncionFinanciamiento] = useState<FuenteFinanciamientoFuncion>('SUBVENCION_GENERAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fuentes de Financiamiento desglosadas
  const [horasSubvGeneralTitular, setHorasSubvGeneralTitular] = useState<number>(44);
  const [horasSubvGeneralContrata, setHorasSubvGeneralContrata] = useState<number>(0);
  const [horasSepTitular, setHorasSepTitular] = useState<number>(0);
  const [horasSepContrata, setHorasSepContrata] = useState<number>(0);
  const [horasPieTitular, setHorasPieTitular] = useState<number>(0);
  const [horasPieContrata, setHorasPieContrata] = useState<number>(0);

  // Funciones exentas de proporción
  const [horasTallerSep, setHorasTallerSep] = useState<number>(0);
  const [horasTrabajoColaborativo, setHorasTrabajoColaborativo] = useState<number>(0);

  // Parámetros GDP & Contrato Oficial DEP
  const [fechaInicioContrato, setFechaInicioContrato] = useState<string>('');
  const [fechaTerminoContrato, setFechaTerminoContrato] = useState<string>('');
  const [propuestaGdp, setPropuestaGdp] = useState<string>('Continuidad');
  const [remuneracionMensual, setRemuneracionMensual] = useState<number>(0);
  const [accionPme, setAccionPme] = useState<string>('');
  const [horasProRetencion, setHorasProRetencion] = useState<number>(0);
  const [horasVigentesAnterior, setHorasVigentesAnterior] = useState<number>(0);
  const [observacionesPal, setObservacionesPal] = useState<string>('');
  const [seccionGdpAbierta, setSeccionGdpAbierta] = useState<boolean>(false);

  // Inicializar estado cuando se abre el modal o cambia el docente a editar
  useEffect(() => {
    if (!isOpen) return;

    if (editingDoc) {
      setRun(editingDoc.run || '');
      setNombres(editingDoc.nombres || '');
      setApellidos(editingDoc.apellidos || '');
      setTitulo(editingDoc.titulo || '');
      setCalidadJuridica(editingDoc.calidadJuridica || 'TITULAR');
      setEstamento(editingDoc.estamento || 'DOCENTE_AULA');
      setHorasContrato(editingDoc.horasContrato || 44);
      setAsignaturaPrincipal(editingDoc.asignaturaPrincipal || 'Lenguaje y Comunicación');
      setAplicaArticulo69(Boolean(editingDoc.aplicaArticulo69));

      if (editingDoc.funcionesNoAula && editingDoc.funcionesNoAula.length > 0) {
        setFuncionesNoAula([...editingDoc.funcionesNoAula]);
      } else {
        const legacyList: FuncionNoAulaDocente[] = [];
        if (editingDoc.horasDirectivas) legacyList.push({ id: `f-${Date.now()}-1`, tipo: 'DIRECTIVA', nombre: 'Gestión Directiva (Dirección/Subdirección)', horas: editingDoc.horasDirectivas, financiamiento: 'SUBVENCION_GENERAL' });
        if (editingDoc.horasInspectorGeneral) legacyList.push({ id: `f-${Date.now()}-2`, tipo: 'INSPECTORIA', nombre: 'Inspectoría General', horas: editingDoc.horasInspectorGeneral, financiamiento: 'SUBVENCION_GENERAL' });
        if (editingDoc.horasTecnicoPedagogicas) legacyList.push({ id: `f-${Date.now()}-3`, tipo: 'UTP', nombre: 'Jefatura Técnico-Pedagógica (UTP)', horas: editingDoc.horasTecnicoPedagogicas, financiamiento: 'SUBVENCION_GENERAL' });
        if (editingDoc.horasCoordinacion) legacyList.push({ id: `f-${Date.now()}-4`, tipo: 'COORDINACION', nombre: editingDoc.tipoCoordinacion ? `Coordinación UTP (${editingDoc.tipoCoordinacion})` : 'Coordinación Pedagógica UTP', horas: editingDoc.horasCoordinacion, financiamiento: 'SUBVENCION_GENERAL' });
        if (editingDoc.horasCoordinacionPie) legacyList.push({ id: `f-${Date.now()}-5`, tipo: 'COORDINACION', nombre: 'Coordinación Programa de Integración Escolar (PIE)', horas: editingDoc.horasCoordinacionPie, financiamiento: 'PIE' });
        if (editingDoc.horasConvivenciaEscolar) legacyList.push({ id: `f-${Date.now()}-6`, tipo: 'CONVIVENCIA', nombre: 'Convivencia Escolar / Mediación', horas: editingDoc.horasConvivenciaEscolar, financiamiento: 'SUBVENCION_GENERAL' });
        if (editingDoc.horasExtraescolar) legacyList.push({ id: `f-${Date.now()}-7`, tipo: 'EXTRAESCOLAR', nombre: 'Actividades Extraescolares y Talleres', horas: editingDoc.horasExtraescolar, financiamiento: 'SUBVENCION_GENERAL' });
        setFuncionesNoAula(legacyList);
      }

      setHorasTallerSep(editingDoc.horasTallerSep || 0);
      setHorasTrabajoColaborativo(editingDoc.horasTrabajoColaborativo || 0);

      let subTit = editingDoc.horasSubvencionGeneralTitular || 0;
      let subCon = editingDoc.horasSubvencionGeneralContrata || 0;
      let sepTit = editingDoc.horasSepTitular || 0;
      let sepCon = editingDoc.horasSepContrata || 0;
      let pieTit = editingDoc.horasPieTitular || 0;
      let pieCon = editingDoc.horasPieContrata || 0;

      const suma = subTit + subCon + sepTit + sepCon + pieTit + pieCon;
      if (suma === 0 && editingDoc.horasContrato > 0) {
        if (editingDoc.calidadJuridica === 'TITULAR') {
          subTit = editingDoc.horasContrato;
        } else {
          subCon = editingDoc.horasContrato;
        }
      }

      setHorasSubvGeneralTitular(subTit);
      setHorasSubvGeneralContrata(subCon);
      setHorasSepTitular(sepTit);
      setHorasSepContrata(sepCon);
      setHorasPieTitular(pieTit);
      setHorasPieContrata(pieCon);

      // Normalizar fechas para evitar fallos de render en input date
      const normDate = (dStr?: string) => {
        if (!dStr || dStr === 'Indefinido') return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
        if (/^\d{2}-\d{2}-\d{4}$/.test(dStr)) {
          const [d, m, y] = dStr.split('-');
          return `${y}-${m}-${d}`;
        }
        return '';
      };

      setFechaInicioContrato(normDate(editingDoc.fechaInicioContrato));
      setFechaTerminoContrato(normDate(editingDoc.fechaTerminoContrato));
      setPropuestaGdp(editingDoc.propuestaGdp || 'Continuidad');
      setRemuneracionMensual(editingDoc.remuneracionMensual ?? (editingDoc as any).remuneracionMensualApp ?? 0);
      setAccionPme(editingDoc.accionPme ?? (editingDoc as any).accionPmeSep ?? '');
      setHorasProRetencion(editingDoc.horasProRetencion || 0);
      setHorasVigentesAnterior(editingDoc.horasVigentesAnterior || editingDoc.horasContrato || 0);
      setObservacionesPal(editingDoc.observacionesPal ?? (editingDoc as any).observacionesDirector ?? '');
    } else {
      // Nuevo Docente
      setRun('');
      setNombres('');
      setApellidos('');
      setTitulo('');
      setCalidadJuridica('TITULAR');
      setEstamento('DOCENTE_AULA');
      setHorasContrato(44);
      setAsignaturaPrincipal('Lenguaje y Comunicación');
      setAplicaArticulo69(false);
      setFuncionesNoAula([]);
      setHorasTallerSep(0);
      setHorasTrabajoColaborativo(0);
      setHorasSubvGeneralTitular(44);
      setHorasSubvGeneralContrata(0);
      setHorasSepTitular(0);
      setHorasSepContrata(0);
      setHorasPieTitular(0);
      setHorasPieContrata(0);
      setFechaInicioContrato('');
      setFechaTerminoContrato('');
      setPropuestaGdp('Continuidad');
      setRemuneracionMensual(0);
      setAccionPme('');
      setHorasProRetencion(0);
      setHorasVigentesAnterior(44);
      setObservacionesPal('');
    }

    setNuevaFuncionTipo('COORDINACION');
    setNuevaFuncionNombre('');
    setNuevaFuncionHoras('');
    setNuevaFuncionFinanciamiento('SUBVENCION_GENERAL');
  }, [isOpen, editingDoc]);

  if (!isOpen) return null;

  const agregarFuncionNoAula = () => {
    const horasNum = Number(nuevaFuncionHoras) || 0;
    if (horasNum <= 0) return;
    const defaultInfo = TIPOS_FUNCIONES_LABELS[nuevaFuncionTipo];
    const nombreFinal = nuevaFuncionNombre.trim() || defaultInfo?.defaultNombre || 'Función Fuera de Aula';
    const item: FuncionNoAulaDocente = {
      id: `func-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: nuevaFuncionTipo,
      nombre: nombreFinal,
      horas: horasNum,
      financiamiento: nuevaFuncionFinanciamiento
    };
    setFuncionesNoAula(prev => [...prev, item]);
    setNuevaFuncionNombre('');
    setNuevaFuncionHoras('');
    setNuevaFuncionFinanciamiento('SUBVENCION_GENERAL');
  };

  const eliminarFuncionNoAula = (id: string) => {
    setFuncionesNoAula(prev => prev.filter(f => f.id !== id));
  };

  const totalHorasFuncionesNoAula = funcionesNoAula.reduce((s, f) => s + (Number(f.horas) || 0), 0);

  const sumaFinanciamiento = 
    horasSubvGeneralTitular + horasSubvGeneralContrata +
    horasSepTitular + horasSepContrata +
    horasPieTitular + horasPieContrata;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let finalFunciones = [...funcionesNoAula];

    // Si el usuario escribió horas en el recuadro de nueva función pero no presionó "+ Añadir a la lista", auto-añadirlo:
    const pendienteHoras = Number(nuevaFuncionHoras) || 0;
    if (pendienteHoras > 0) {
      const defaultInfo = TIPOS_FUNCIONES_LABELS[nuevaFuncionTipo];
      const nombreFinal = nuevaFuncionNombre.trim() || defaultInfo?.defaultNombre || 'Función Fuera de Aula';
      finalFunciones.push({
        id: `func-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo: nuevaFuncionTipo,
        nombre: nombreFinal,
        horas: pendienteHoras,
        financiamiento: nuevaFuncionFinanciamiento
      });
      setNuevaFuncionHoras('');
      setNuevaFuncionNombre('');
    }

    const dirHours = finalFunciones.filter(f => f.tipo === 'DIRECTIVA').reduce((s, f) => s + Number(f.horas || 0), 0);
    const inspHours = finalFunciones.filter(f => f.tipo === 'INSPECTORIA').reduce((s, f) => s + Number(f.horas || 0), 0);
    const utpHours = finalFunciones.filter(f => f.tipo === 'UTP' || f.tipo === 'EVALUACION' || f.tipo === 'ORIENTACION').reduce((s, f) => s + Number(f.horas || 0), 0);
    const coordPieHours = finalFunciones.filter(f => f.tipo === 'COORDINACION' && (f.financiamiento === 'PIE' || /pie/i.test(f.nombre))).reduce((s, f) => s + Number(f.horas || 0), 0);
    const convHours = finalFunciones.filter(f => f.tipo === 'CONVIVENCIA').reduce((s, f) => s + Number(f.horas || 0), 0);
    const extraHours = finalFunciones.filter(f => f.tipo === 'EXTRAESCOLAR').reduce((s, f) => s + Number(f.horas || 0), 0);
    const coordHours = finalFunciones.filter(f => (f.tipo === 'COORDINACION' && f.financiamiento !== 'PIE' && !/pie/i.test(f.nombre)) || f.tipo === 'CRA' || f.tipo === 'ENLACES' || f.tipo === 'GREMIAL' || f.tipo === 'ADMINISTRATIVA' || f.tipo === 'OTRA').reduce((s, f) => s + Number(f.horas || 0), 0);

    const doc: Docente = {
      id: editingDoc ? editingDoc.id : `doc-${Date.now()}`,
      rbd,
      run: run.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      titulo: titulo.trim() || undefined,
      calidadJuridica,
      estamento,
      horasContrato: Number(horasContrato),
      horasSubvencionGeneralTitular: Number(horasSubvGeneralTitular) || 0,
      horasSubvencionGeneralContrata: Number(horasSubvGeneralContrata) || 0,
      horasSepTitular: Number(horasSepTitular) || 0,
      horasSepContrata: Number(horasSepContrata) || 0,
      horasPieTitular: Number(horasPieTitular) || 0,
      horasPieContrata: Number(horasPieContrata) || 0,
      horasDirectivas: dirHours || 0,
      horasInspectorGeneral: inspHours || 0,
      horasTecnicoPedagogicas: utpHours || 0,
      horasCoordinacion: coordHours || 0,
      tipoCoordinacion: editingDoc?.tipoCoordinacion,
      horasCoordinacionPie: coordPieHours,
      horasConvivenciaEscolar: convHours,
      horasExtraescolar: extraHours,
      cargoInstitucional: editingDoc?.cargoInstitucional,
      funcionesNoAula: finalFunciones.length > 0 ? finalFunciones : undefined,
      horasAula: editingDoc?.horasAula || 0,
      horasIngles: editingDoc?.horasIngles || 0,
      funcionPrincipal: editingDoc?.funcionPrincipal,
      funcionSecundaria: editingDoc?.funcionSecundaria,
      periodo: periodoActivo ?? editingDoc?.periodo ?? 2026,
      horasTallerSep: Number(horasTallerSep) || 0,
      horasTrabajoColaborativo: Number(horasTrabajoColaborativo) || 0,
      asignaturaPrincipal: asignaturaPrincipal.trim() || undefined,
      aplicaArticulo69,
      fechaInicioContrato: fechaInicioContrato || undefined,
      fechaTerminoContrato: fechaTerminoContrato || undefined,
      propuestaGdp: propuestaGdp as any,
      remuneracionMensual: Number(remuneracionMensual) || 0,
      remuneracionMensualApp: Number(remuneracionMensual) || 0,
      accionPme: accionPme.trim() || undefined,
      accionPmeSep: accionPme.trim() || undefined,
      horasProRetencion: Number(horasProRetencion) || 0,
      horasVigentesAnterior: Number(horasVigentesAnterior) || Number(horasContrato),
      observacionesPal: observacionesPal.trim() || undefined,
      observacionesDirector: observacionesPal.trim() || undefined
    };

    try {
      setIsSubmitting(true);
      await onGuardarDocente(doc);
      onClose();
    } catch (err) {
      console.error("Error al guardar docente:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="bg-[#002B49] text-white p-5 px-6 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editingDoc ? `Editar Docente: ${editingDoc.nombres} ${editingDoc.apellidos}` : 'Registrar Nuevo Docente en Dotación'}
              </h3>
              <p className="text-xs text-slate-300">
                {editingDoc ? `RBD Establecimiento: ${rbd} • RUN: ${editingDoc.run}` : 'Configura contrato, financiamiento y funciones no aula'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs custom-scrollbar">
            {/* 1. DATOS PERSONALES Y CONTRATO */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              Identificación y Jornada Contractual
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">RUN *</label>
                <input
                  type="text"
                  required
                  value={run}
                  onChange={e => setRun(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  placeholder="Ej: 12.345.678-9"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Horas Contrato Totales *</label>
                <input
                  type="number"
                  min="1"
                  max="44"
                  step="any"
                  required
                  value={horasContrato}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    const prevVal = horasContrato;
                    setHorasContrato(val);
                    // Sincronizar automáticamente Subvención General si la dotación está financiada íntegramente por ella
                    const soloSubv = (horasSepTitular + horasSepContrata + horasPieTitular + horasPieContrata) === 0;
                    if (soloSubv || !editingDoc) {
                      if (calidadJuridica === 'TITULAR') {
                        setHorasSubvGeneralTitular(val);
                        setHorasSubvGeneralContrata(0);
                      } else {
                        setHorasSubvGeneralContrata(val);
                        setHorasSubvGeneralTitular(0);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-bold text-center text-blue-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombres *</label>
                <input
                  type="text"
                  required
                  value={nombres}
                  onChange={e => setNombres(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  placeholder="Ej: Juan Andrés"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Apellidos *</label>
                <input
                  type="text"
                  required
                  value={apellidos}
                  onChange={e => setApellidos(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  placeholder="Ej: Pérez Soto"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título Profesional</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  placeholder="Ej: Prof. de Educación General Básica"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estamento *</label>
                <select
                  value={estamento}
                  onChange={e => setEstamento(e.target.value as EstamentoDocente)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                >
                  {ESTAMENTOS.map(est => (
                    <option key={est.id} value={est.id}>{est.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Calidad Jurídica Predominante *</label>
                <select
                  value={calidadJuridica}
                  onChange={e => {
                    const nuevaCalidad = e.target.value as CalidadJuridicaDocente;
                    setCalidadJuridica(nuevaCalidad);
                    const soloSubv = (horasSepTitular + horasSepContrata + horasPieTitular + horasPieContrata) === 0;
                    if (soloSubv || !editingDoc) {
                      if (nuevaCalidad === 'TITULAR') {
                        setHorasSubvGeneralTitular(horasContrato);
                        setHorasSubvGeneralContrata(0);
                      } else {
                        setHorasSubvGeneralContrata(horasContrato);
                        setHorasSubvGeneralTitular(0);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                >
                  <option value="TITULAR">Titular</option>
                  <option value="CONTRATA">Contrata</option>
                  <option value="REEMPLAZANTE">Reemplazante</option>
                  <option value="POSTULANDO_A_TITULARIDAD">Postulando a Titularidad</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asignatura Principal</label>
                <input
                  type="text"
                  value={asignaturaPrincipal}
                  onChange={e => setAsignaturaPrincipal(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  placeholder="Ej: Lenguaje y Comunicación"
                />
              </div>
            </div>

            {/* Switch Artículo 69 */}
            <div className="pt-2 border-t border-slate-200/80">
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-100/80 transition-colors">
                <input
                  type="checkbox"
                  checked={aplicaArticulo69}
                  onChange={e => setAplicaArticulo69(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    Aplica Artículo 69 (Reducción voluntaria de aula por 30+ años de docencia)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tope legal máximo de 24 horas cronológicas de aula (32 HA). El remanente pasa automáticamente a tiempo no lectivo.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 2. DESGLOSE DE FUENTES DE FINANCIAMIENTO */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Coins className="w-4 h-4 text-orange-600" />
                Desglose por Fuentes de Financiamiento (Horas)
              </span>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                sumaFinanciamiento === horasContrato 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                Suma: {sumaFinanciamiento} / {horasContrato} hrs {sumaFinanciamiento === horasContrato ? '✓ Cuadrado' : '⚠️ Descuadre'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Subvención General */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5 border-slate-100">
                  <span className="font-bold text-slate-800 text-xs">Subvención General</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                    {horasSubvGeneralTitular + horasSubvGeneralContrata} hrs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Titular (hrs):</label>
                    <input
                      type="number"
                      min="0"
                      max="44"
                      step="any"
                      value={horasSubvGeneralTitular}
                      onChange={e => setHorasSubvGeneralTitular(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Contrata (hrs):</label>
                    <input
                      type="number"
                      min="0"
                      max="44"
                      step="any"
                      value={horasSubvGeneralContrata}
                      onChange={e => setHorasSubvGeneralContrata(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SEP */}
              <div className="bg-purple-50/40 p-3 rounded-xl border border-purple-100 shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5 border-purple-100">
                  <span className="font-bold text-purple-900 text-xs">SEP (Ley 20.248)</span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                    {horasSepTitular + horasSepContrata} hrs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-purple-700 mb-0.5">Titular (hrs):</label>
                    <input
                      type="number"
                      min="0"
                      max="44"
                      step="any"
                      value={horasSepTitular}
                      onChange={e => setHorasSepTitular(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-purple-400 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-purple-700 mb-0.5">Contrata (hrs):</label>
                    <input
                      type="number"
                      min="0"
                      max="44"
                      step="any"
                      value={horasSepContrata}
                      onChange={e => setHorasSepContrata(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-purple-400 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* PIE */}
              <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100 shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5 border-blue-100">
                  <span className="font-bold text-blue-900 text-xs">PIE (Dec. 170)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                    {horasPieTitular + horasPieContrata} hrs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-700 mb-0.5">Titular (hrs):</label>
                    <input
                      type="number"
                      min="0"
                      max="44"
                      step="any"
                      value={horasPieTitular}
                      onChange={e => setHorasPieTitular(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-700 mb-0.5">Contrata (hrs):</label>
                    <input
                      type="number"
                      min="0"
                      max="44"
                      step="any"
                      value={horasPieContrata}
                      onChange={e => setHorasPieContrata(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {sumaFinanciamiento !== horasContrato && (
              <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                La suma de horas por fuente ({sumaFinanciamiento}h) no coincide con el total contratado ({horasContrato}h).
              </p>
            )}
          </div>

          {/* 3. SECCIÓN FUNCIONES FUERA DE AULA / ADMINISTRATIVAS */}
          <div className="bg-purple-50/30 p-4 rounded-xl border border-purple-100 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-purple-600" />
                  Funciones Fuera de Aula / Administrativas (Exentas de Proporción Aula)
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Registra múltiples cargos o coordinaciones (Directivas, Inspectoría, UTP, CRA, Enlaces, Convivencia, Gremiales, Apoyo Administrativo). No llevan proporción 65/35 o 60/40.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                Total Funciones: {totalHorasFuncionesNoAula} hrs
              </span>
            </div>

            {/* Listado de Funciones Agregadas */}
            {funcionesNoAula.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {funcionesNoAula.map(f => {
                  const meta = TIPOS_FUNCIONES_LABELS[f.tipo] || { label: f.tipo, defaultNombre: f.nombre, badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' };
                  const metaFinanc = f.financiamiento === 'SEP'
                    ? { label: 'SEP (Ley 20.248)', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' }
                    : f.financiamiento === 'PIE'
                    ? { label: 'PIE (Dec. 170)', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' }
                    : { label: 'Subv. General', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

                  return (
                    <div key={f.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-xs hover:border-purple-200 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeColor}`}>
                          {f.tipo}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{f.nombre}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${metaFinanc.badgeColor}`}>
                          {metaFinanc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <strong className="text-purple-900 font-bold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">{f.horas} hrs</strong>
                        <button
                          type="button"
                          onClick={() => eliminarFuncionNoAula(f.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar función"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3 px-4 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
                Sin funciones fuera de aula agregadas. El docente tendrá sus horas disponibles para aula regular.
              </div>
            )}

            {/* Formulario Espacioso para Agregar una Nueva Función */}
            <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs space-y-3">
              <span className="font-bold text-purple-950 block text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-purple-600" />
                Agregar Nueva Función Fuera de Aula / Administrativa:
              </span>

              {/* Fila 1: Tipo y Financiamiento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tipo / Categoría de Función</label>
                  <select
                    value={nuevaFuncionTipo}
                    onChange={e => {
                      const t = e.target.value as TipoFuncionNoAula;
                      setNuevaFuncionTipo(t);
                      if (!nuevaFuncionNombre) {
                        setNuevaFuncionNombre(TIPOS_FUNCIONES_LABELS[t]?.defaultNombre || '');
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    {Object.entries(TIPOS_FUNCIONES_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fuente de Financiamiento</label>
                  <select
                    value={nuevaFuncionFinanciamiento}
                    onChange={e => setNuevaFuncionFinanciamiento(e.target.value as FuenteFinanciamientoFuncion)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none font-medium text-slate-800"
                  >
                    <option value="SUBVENCION_GENERAL">Subvención General</option>
                    <option value="SEP">SEP (Ley 20.248)</option>
                    <option value="PIE">PIE (Dec. 170)</option>
                  </select>
                </div>
              </div>

              {/* Fila 2: Nombre, Horas y Botón */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre / Descripción Detallada</label>
                  <input
                    type="text"
                    value={nuevaFuncionNombre}
                    onChange={e => setNuevaFuncionNombre(e.target.value)}
                    placeholder="Ej: Encargado de Convivencia Escolar y Mediación"
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-center">Horas</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    max={horasContrato}
                    value={nuevaFuncionHoras}
                    onChange={e => {
                      const val = e.target.value;
                      setNuevaFuncionHoras(val === '' ? '' : Math.max(0, parseFloat(val) || 0));
                    }}
                    placeholder="Ej: 2"
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none font-bold text-center text-purple-950"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={agregarFuncionNoAula}
                    className="w-full h-[38px] bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir a la lista</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bloque Talleres SEP y Trabajo Colaborativo (Exentos) */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5 shadow-xs">
              <span className="font-bold text-emerald-950 block text-xs">
                Talleres SEP y Trabajo Colaborativo Directo (Exentos de Proporción)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Horas Taller SEP (hrs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={horasContrato}
                    value={horasTallerSep}
                    onChange={e => setHorasTallerSep(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none bg-white font-semibold text-center"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Refuerzo SEP fuera de plan regular</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Trabajo Colaborativo Art. 86 (hrs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={horasContrato}
                    value={horasTrabajoColaborativo}
                    onChange={e => setHorasTrabajoColaborativo(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none bg-white font-semibold text-center"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Co-planificación Dec. 170</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-100/50 rounded-xl border border-purple-200 flex items-center justify-between text-xs text-slate-700">
              <span className="font-medium">Horas disponibles para docencia lectiva de aula regular:</span>
              <strong className="text-purple-950 font-black text-sm bg-white px-2.5 py-0.5 rounded-lg border border-purple-200">
                {Math.max(0, horasContrato - totalHorasFuncionesNoAula - horasTallerSep - horasTrabajoColaborativo)} hrs
              </strong>
            </div>

            {/* Sección Desplegable: Parámetros GDP & Contrato Oficial DEP */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setSeccionGdpAbierta(!seccionGdpAbierta)}
                className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200/80 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-xs text-slate-800">
                    Parámetros GDP & Contrato Oficial DEP (Proyección Ministerial 2027)
                  </span>
                </div>
                {seccionGdpAbierta ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {seccionGdpAbierta && (
                <div className="p-4 space-y-3 bg-white border-t border-slate-200 animate-fade-in text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Propuesta Dotación GDP
                      </label>
                      <select
                        value={propuestaGdp}
                        onChange={e => setPropuestaGdp(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white font-medium"
                      >
                        <option value="Continuidad">Continuidad</option>
                        <option value="No Continuidad">No Continuidad</option>
                        <option value="Aumento Horas">Aumento Horas</option>
                        <option value="Disminución Horas">Disminución Horas</option>
                        <option value="Nuevo">Nuevo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Fecha Inicio Contrato
                      </label>
                      <input
                        type="date"
                        value={fechaInicioContrato}
                        onChange={e => setFechaInicioContrato(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Fecha Término Contrato
                      </label>
                      <input
                        type="date"
                        value={fechaTerminoContrato}
                        onChange={e => setFechaTerminoContrato(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Remuneración Mensual ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={remuneracionMensual || ''}
                        placeholder="Ej: 1450000"
                        onChange={e => setRemuneracionMensual(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Para costeo en hojas SEP / Pro-Retención</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Acción PME (SEP)
                      </label>
                      <input
                        type="text"
                        value={accionPme}
                        placeholder="Ej: A-1 Refuerzo escolar"
                        onChange={e => setAccionPme(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Horas Pro-Retención
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={horasContrato}
                        value={horasProRetencion || ''}
                        placeholder="0"
                        onChange={e => setHorasProRetencion(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white text-center font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Observaciones Oficiales DEP (PAL)
                    </label>
                    <input
                      type="text"
                      value={observacionesPal}
                      placeholder="Ej: Decreto de titularidad N° 142..."
                      onChange={e => setObservacionesPal(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Botones del Modal */}
          <div className="shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all hover:shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isSubmitting ? 'Guardando...' : (editingDoc ? 'Guardar Cambios Docente' : 'Registrar Docente')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
