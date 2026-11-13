import {
  Establecimiento,
  TipoEstablecimientoBase,
  TipoPerfilEstablecimiento,
} from '../types';
import { findSchoolByRbd, inferTipoPerfilCatalog } from '../data/slepSchoolsCatalog';

export interface PerfilEstablecimientoMeta {
  perfil: TipoPerfilEstablecimiento;
  tipoBase: TipoEstablecimientoBase;
  label: string;
  shortLabel: string;
  badgeClass: string;
  esJardinOSalaCuna: boolean;
  esLiceoOEducacionMedia: boolean;
  esEspecial: boolean;
  esEpja: boolean;
}

export const PERFILES_ESTABLECIMIENTO_OPTIONS: Array<{
  value: TipoPerfilEstablecimiento;
  label: string;
  tipoBaseDefault: TipoEstablecimientoBase;
}> = [
  { value: 'ESCUELA_BASICA', label: 'Escuela Básica / Rural (NT1-8°)', tipoBaseDefault: 'ESCUELA' },
  { value: 'LICEO_HC', label: 'Liceo Humanístico-Científico', tipoBaseDefault: 'LICEO' },
  { value: 'LICEO_TP', label: 'Liceo Técnico-Profesional', tipoBaseDefault: 'LICEO' },
  { value: 'LICEO_POLIVALENTE', label: 'Liceo Polivalente (HC + TP)', tipoBaseDefault: 'LICEO' },
  { value: 'JARDIN_SALA_CUNA', label: 'Jardín Infantil / Sala Cuna (VTF)', tipoBaseDefault: 'JARDIN' },
  { value: 'ESCUELA_ESPECIAL', label: 'Escuela Especial (Dec. 83 / 87)', tipoBaseDefault: 'ESCUELA' },
  { value: 'EPJA', label: 'Educación de Adultos (EPJA / Dec. 10)', tipoBaseDefault: 'ESCUELA' },
];

export function resolvePerfilEstablecimiento(
  est?: Partial<Establecimiento> | null
): TipoPerfilEstablecimiento {
  if (!est) return 'ESCUELA_BASICA';
  if (est.tipoPerfil) return est.tipoPerfil;
  if (est.tipo === 'JARDIN' || est.tipo === 'SALA_CUNA') return 'JARDIN_SALA_CUNA';

  const cat = est.rbd ? findSchoolByRbd(est.rbd) : undefined;
  if (cat) return inferTipoPerfilCatalog(cat);

  const upper = (est.nombre || '').toUpperCase();
  if (upper.includes('JARDIN') || upper.includes('JARDÍN') || upper.includes('SALA CUNA')) {
    return 'JARDIN_SALA_CUNA';
  }
  if (upper.includes('ESPECIAL')) return 'ESCUELA_ESPECIAL';
  if (upper.includes('ADULTO') || upper.includes('EPJA') || upper.includes('CEIA')) return 'EPJA';
  if (upper.includes('POLIVALENTE') || upper.includes('POLITECNICO') || upper.includes('POLITÉCNICO')) {
    return 'LICEO_POLIVALENTE';
  }
  if (est.tipo === 'LICEO' || est.tipo === 'COLEGIO' || upper.includes('LICEO')) {
    return 'LICEO_HC';
  }
  return 'ESCUELA_BASICA';
}

export function esJardinOSalaCuna(est?: Partial<Establecimiento> | null): boolean {
  return resolvePerfilEstablecimiento(est) === 'JARDIN_SALA_CUNA';
}

export function getPerfilEstablecimientoMeta(
  est?: Partial<Establecimiento> | null
): PerfilEstablecimientoMeta {
  const perfil = resolvePerfilEstablecimiento(est);
  const tipoBase: TipoEstablecimientoBase =
    est?.tipo ||
    (perfil === 'JARDIN_SALA_CUNA'
      ? (est?.nombre || '').toUpperCase().startsWith('SALA CUNA') &&
        !(est?.nombre || '').toUpperCase().includes('JARD')
        ? 'SALA_CUNA'
        : 'JARDIN'
      : perfil.startsWith('LICEO')
      ? 'LICEO'
      : 'ESCUELA');

  switch (perfil) {
    case 'JARDIN_SALA_CUNA':
      return {
        perfil,
        tipoBase,
        label: tipoBase === 'SALA_CUNA' ? 'Sala Cuna VTF' : 'Jardín / Sala Cuna VTF',
        shortLabel: 'VTF / Parvularia',
        badgeClass: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800',
        esJardinOSalaCuna: true,
        esLiceoOEducacionMedia: false,
        esEspecial: false,
        esEpja: false,
      };
    case 'LICEO_TP':
      return {
        perfil,
        tipoBase,
        label: 'Liceo Técnico-Profesional',
        shortLabel: 'Liceo TP',
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
        esJardinOSalaCuna: false,
        esLiceoOEducacionMedia: true,
        esEspecial: false,
        esEpja: false,
      };
    case 'LICEO_POLIVALENTE':
      return {
        perfil,
        tipoBase,
        label: 'Liceo Polivalente (HC+TP)',
        shortLabel: 'Polivalente',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        esJardinOSalaCuna: false,
        esLiceoOEducacionMedia: true,
        esEspecial: false,
        esEpja: false,
      };
    case 'LICEO_HC':
      return {
        perfil,
        tipoBase,
        label: 'Liceo Humanístico-Científico',
        shortLabel: 'Liceo HC',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        esJardinOSalaCuna: false,
        esLiceoOEducacionMedia: true,
        esEspecial: false,
        esEpja: false,
      };
    case 'ESCUELA_ESPECIAL':
      return {
        perfil,
        tipoBase,
        label: 'Escuela Especial',
        shortLabel: 'Especial',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
        esJardinOSalaCuna: false,
        esLiceoOEducacionMedia: false,
        esEspecial: true,
        esEpja: false,
      };
    case 'EPJA':
      return {
        perfil,
        tipoBase,
        label: 'EPJA (Adultos)',
        shortLabel: 'EPJA',
        badgeClass: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
        esJardinOSalaCuna: false,
        esLiceoOEducacionMedia: true,
        esEspecial: false,
        esEpja: true,
      };
    default:
      return {
        perfil: 'ESCUELA_BASICA',
        tipoBase,
        label: 'Escuela Básica',
        shortLabel: 'Básica',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
        esJardinOSalaCuna: false,
        esLiceoOEducacionMedia: false,
        esEspecial: false,
        esEpja: false,
      };
  }
}
