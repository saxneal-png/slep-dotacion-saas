import { describe, it, expect } from 'vitest';
import { createDeterministicPiiVault, CLINICAL_NEE_REGEX, CHILEAN_RUN_REGEX } from '../src/utils/piiSovereigntySanitizer';

describe('Capa de Anonimización Determinista PII (piiSovereigntySanitizer)', () => {
  it('reemplaza bidireccionalmente RUN y Nombres de funcionarios por tokens opacos', () => {
    const funcionarios = [
      { run: '12.345.678-9', nombres: 'María Elena', apellidos: 'González Pinto' },
      { run: '9.876.543-K', nombres: 'Rodrigo', apellidos: 'Fuentes Uribe' }
    ];

    const vault = createDeterministicPiiVault(funcionarios);

    const textoOriginal = 'La docente María Elena González Pinto (12.345.678-9) y el asesor Rodrigo Fuentes Uribe (9.876.543-K) revisaron la carga horaria.';
    const anonimizado = vault.anonymizeText(textoOriginal);

    expect(anonimizado).not.toContain('María Elena');
    expect(anonimizado).not.toContain('12.345.678-9');
    expect(anonimizado).not.toContain('Rodrigo Fuentes Uribe');
    expect(anonimizado).not.toContain('9.876.543-K');
    expect(anonimizado).toContain('[FUNC_001_NOMBRE]');
    expect(anonimizado).toContain('[FUNC_001_RUN]');
    expect(anonimizado).toContain('[FUNC_002_NOMBRE]');
    expect(anonimizado).toContain('[FUNC_002_RUN]');

    const desanonimizado = vault.deanonimizeText(anonimizado);
    expect(desanonimizado).toBe(textoOriginal);
  });

  it('redacta diagnósticos clínicos del Decreto 170 y patologías de salud laboral', () => {
    const vault = createDeterministicPiiVault([]);
    const textoClinico = 'El estudiante fue diagnosticado con TEA y TDAH severo, derivado por TEL mixto y sospecha de FIL.';
    const sanitizado = vault.anonymizeText(textoClinico);

    expect(sanitizado).not.toMatch(/\btea\b/i);
    expect(sanitizado).not.toMatch(/\btdah\b/i);
    expect(sanitizado).not.toMatch(/\btel\b/i);
    expect(sanitizado).not.toMatch(/\bfil\b/i);
    expect(sanitizado).toContain('[DIAGNOSTICO_NEE_DECRETO_170_RESERVADO]');
  });

  it('redacta RUNs residuales no indexados en la lista de funcionarios', () => {
    const vault = createDeterministicPiiVault([]);
    const textoConRutResidual = 'El reemplazo fue asumido por el postulante RUN 15.444.333-2 sin registro previo.';
    const sanitizado = vault.anonymizeText(textoConRutResidual);

    expect(sanitizado).not.toContain('15.444.333-2');
    expect(sanitizado).toContain('[RUN_RESERVADO_SLEP]');
  });
});
