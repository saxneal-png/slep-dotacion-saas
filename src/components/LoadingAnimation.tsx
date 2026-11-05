import React, { useEffect, useState } from 'react';
import { BookOpen, Calculator, GraduationCap, Lightbulb, Users } from 'lucide-react';

/**
 * Animación de carga didáctica y entretenida.
 *
 * Escena: una escuela que "se arma" mientras carga el sistema:
 *  - las salas (ventanas) se iluminan una a una, como cursos recibiendo dotación,
 *  - estudiantes caminan hacia la puerta,
 *  - el reloj de la fachada recorre 3/4 de vuelta = 1 hora pedagógica (45 min),
 *  - la bandera flamea y los íconos educativos orbitan.
 * Además rota pasos de proceso y datos normativos "¿Sabías que...?".
 *
 * Variantes:
 *  - `fullscreen`: pantalla de arranque (motor + base de datos offline).
 *  - `inline`: carga de módulos/vistas (React.Suspense), usa tokens del tema.
 */

const DATOS_DIDACTICOS: string[] = [
  'Una hora pedagógica dura 45 minutos: por eso el reloj de la escuela recorre solo 3/4 de vuelta.',
  'La Ley 20.903 fija la proporción 65% lectivas / 35% no lectivas para la jornada docente.',
  'En establecimientos con 80% o más de estudiantes prioritarios, la proporción es 60/40.',
  'El Decreto 170 permite hasta 5 estudiantes PIE transitorios y 2 permanentes por curso.',
  'La jornada docente máxima es de 44 horas cronológicas semanales (DFL 1/1996, Estatuto Docente).',
  'La Ley 21.040 creó el Sistema de Educación Pública y los Servicios Locales (SLEP).',
  'La Ley SEP (20.248) entrega recursos adicionales por cada estudiante prioritario.',
  'Cada ventana que se ilumina representa un curso que recibe su dotación docente.',
];

const PASOS_CARGA: string[] = [
  'Abriendo la base de datos offline',
  'Cargando el Motor Core MINEDUC',
  'Leyendo cursos y matrícula SAE',
  'Calculando horas lectivas y no lectivas',
  'Validando normativa PIE y SEP',
  'Asignando docentes a sus cursos',
];

interface LoadingAnimationProps {
  variant?: 'fullscreen' | 'inline';
  /** Mensaje principal opcional (reemplaza los pasos rotativos). */
  mensaje?: string;
}

function useRotatingIndex(length: number, intervalMs: number, randomStart = false) {
  const [index, setIndex] = useState(() => (randomStart ? Math.floor(Math.random() * length) : 0));
  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % length), intervalMs);
    return () => window.clearInterval(id);
  }, [length, intervalMs]);
  return index;
}

/** Ilustración SVG animada de la escuela. */
const EscuelaAnimada: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const ventanas = [
    { x: 60, y: 72 }, { x: 88, y: 72 }, { x: 130, y: 72 }, { x: 158, y: 72 },
    { x: 60, y: 102 }, { x: 88, y: 102 }, { x: 130, y: 102 }, { x: 158, y: 102 },
  ];
  const estudiantes = [
    { color: '#F97316', delay: 0 },
    { color: '#38BDF8', delay: 1.4 },
    { color: '#A78BFA', delay: 2.8 },
  ];

  return (
    <svg
      viewBox="0 0 240 160"
      className={compact ? 'w-40 h-28' : 'w-64 h-44 sm:w-72 sm:h-48'}
      role="img"
      aria-label="Escuela animada cargando"
    >
      {/* Suelo */}
      <line x1="8" y1="140" x2="232" y2="140" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />

      {/* Mástil y bandera */}
      <line x1="120" y1="24" x2="120" y2="2" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" />
      <g className="slep-load-flag">
        <rect x="120.5" y="3" width="7" height="5" fill="#1D4ED8" />
        <rect x="127.5" y="3" width="11" height="5" fill="#F8FAFC" />
        <rect x="120.5" y="8" width="18" height="5" fill="#DC2626" />
        <circle cx="124" cy="5.5" r="1.1" fill="#F8FAFC" />
      </g>

      {/* Techo */}
      <polygon points="40,64 120,24 200,64" fill="#E35205" className="slep-load-roof" />
      {/* Reloj: 3/4 de vuelta = 45 minutos (hora pedagógica) */}
      <circle cx="120" cy="48" r="9" fill="#FFF7ED" stroke="#9A3412" strokeWidth="1.5" />
      <line x1="120" y1="48" x2="120" y2="43" stroke="#9A3412" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="120" y1="48" x2="120" y2="41" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" className="slep-load-clock-hand" />

      {/* Edificio */}
      <rect x="50" y="64" width="140" height="76" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />

      {/* Ventanas (salas) que se iluminan en secuencia */}
      {ventanas.map((v, i) => (
        <rect
          key={i}
          x={v.x}
          y={v.y}
          width="22"
          height="16"
          rx="2"
          className="slep-load-window"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}

      {/* Puerta */}
      <rect x="110" y="110" width="20" height="30" rx="2" fill="#7C2D12" />
      <circle cx="126" cy="126" r="1.2" fill="#FDBA74" />

      {/* Estudiantes caminando hacia la puerta */}
      {estudiantes.map((e, i) => (
        <g key={i} className="slep-load-student" style={{ animationDelay: `${e.delay}s` }}>
          <g className="slep-load-bob" style={{ animationDelay: `${e.delay}s` }}>
            <circle cx="0" cy="124" r="3.2" fill="#FCD9B6" />
            <rect x="-3.5" y="128" width="7" height="9" rx="3" fill={e.color} />
            <rect x="-5.5" y="129" width="3" height="5" rx="1" fill="#0F172A" opacity="0.6" />
          </g>
        </g>
      ))}

      {/* Lápiz que "escribe" la proporción 65/35 */}
      <g transform="translate(196 118)">
        <path d="M0 18 L26 18" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" className="slep-load-write" />
        <text x="13" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.75">65/35</text>
      </g>
    </svg>
  );
};

/** Íconos educativos orbitando alrededor de la escena. */
const OrbitaIconos: React.FC = () => {
  const iconos = [GraduationCap, BookOpen, Calculator, Users];
  return (
    <div className="absolute inset-0 pointer-events-none slep-load-orbit" aria-hidden="true">
      {iconos.map((Icon, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2"
          style={{ transform: `rotate(${i * 90}deg) translateY(-118px) rotate(-${i * 90}deg)` }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <div className="slep-load-counter-orbit w-9 h-9 rounded-xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center shadow-lg">
              <Icon className="w-[18px] h-[18px] text-orange-300" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ variant = 'inline', mensaje }) => {
  const pasoIdx = useRotatingIndex(PASOS_CARGA.length, 1800);
  const datoIdx = useRotatingIndex(DATOS_DIDACTICOS.length, 5500, true);

  if (variant === 'fullscreen') {
    return (
      <div className="slep-loader min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white px-6 overflow-hidden relative">
        {/* Halo de fondo */}
        <div className="absolute w-[520px] h-[520px] rounded-full bg-orange-500/10 blur-3xl slep-load-pulse" aria-hidden="true" />

        <div className="relative w-80 h-72 flex items-center justify-center text-slate-200">
          <OrbitaIconos />
          <EscuelaAnimada />
        </div>

        <h1 className="relative mt-2 text-lg sm:text-xl font-bold tracking-tight">
          SLEP Valle Diguillín · <span className="text-orange-400">Dotación</span>
        </h1>

        {/* Paso actual */}
        <p key={pasoIdx} className="relative mt-2 text-sm font-semibold text-slate-300 slep-load-fade" aria-live="polite">
          {mensaje ?? PASOS_CARGA[pasoIdx]}
          <span className="slep-load-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
        </p>

        {/* Barra de progreso */}
        <div className="relative mt-4 w-64 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-orange-500 via-amber-300 to-orange-500 slep-load-bar" />
        </div>

        {/* ¿Sabías que...? */}
        <div className="relative mt-8 max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-5 py-4 shadow-xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-300">
            <Lightbulb className="w-4 h-4 slep-load-pulse" />
            ¿Sabías que…?
          </div>
          <p key={datoIdx} className="mt-2 text-sm leading-relaxed text-slate-200 slep-load-fade min-h-[3rem]">
            {DATOS_DIDACTICOS[datoIdx]}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="slep-loader flex flex-col items-center justify-center min-h-[400px] py-12 animate-in fade-in text-content-secondary">
      <EscuelaAnimada compact />
      <p className="mt-3 text-sm font-semibold text-content-primary" aria-live="polite">
        {mensaje ?? 'Cargando módulo'}
        <span className="slep-load-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </p>
      <div className="mt-3 w-48 h-1 rounded-full bg-border-subtle/50 overflow-hidden relative">
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-brand-accent via-amber-400 to-brand-accent slep-load-bar" />
      </div>
      <div className="mt-5 max-w-sm flex items-start gap-2 text-xs text-content-muted">
        <Lightbulb className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
        <p key={datoIdx} className="slep-load-fade leading-relaxed">{DATOS_DIDACTICOS[datoIdx]}</p>
      </div>
    </div>
  );
};

export default LoadingAnimation;
