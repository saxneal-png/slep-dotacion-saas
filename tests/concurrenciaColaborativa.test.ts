import { describe, it, expect, vi } from 'vitest';
import { SupabaseDotacionService } from '../src/services/supabaseDotacionService';

describe('Sincronización Concurrente y Modular por Apartados en Supabase', () => {
  it('debe existir el método sincronizarApartadoColegioASupabase', () => {
    expect(typeof SupabaseDotacionService.sincronizarApartadoColegioASupabase).toBe('function');
  });

  it('debe existir el soporte de descarga modular en descargarEIntegrarColegioDesdeSupabase', () => {
    expect(typeof SupabaseDotacionService.descargarEIntegrarColegioDesdeSupabase).toBe('function');
  });
});
