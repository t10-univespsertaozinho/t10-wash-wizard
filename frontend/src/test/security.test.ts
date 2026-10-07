/**
 * Validadores de entrada do frontend (src/utils/security.ts).
 *
 * São controles de UX, não de segurança — o backend revalida tudo. O valor de
 * testá-los é manter os dois lados com o MESMO critério: quando divergem, o
 * formulário aprova um dado que a API recusa depois (ou o contrário), e o
 * usuário fica sem saber o que corrigir.
 */
import { describe, it, expect } from 'vitest';
import { SENHA_MINIMA, isValidEmail, isValidPhone, isValidPlaca } from '@/utils/security';

describe('isValidEmail', () => {
  it('aceita endereços bem formados', () => {
    expect(isValidEmail('admin@washwizard.com')).toBe(true);
    expect(isValidEmail('sr.reinaldo+bi@lava.com.br')).toBe(true);
  });

  it('ignora espaços nas pontas', () => {
    expect(isValidEmail('  admin@washwizard.com  ')).toBe(true);
  });

  it('recusa endereços incompletos', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('admin')).toBe(false);
    expect(isValidEmail('admin@')).toBe(false);
    expect(isValidEmail('admin@local')).toBe(false); // TLD ausente
    expect(isValidEmail('admin@local.c')).toBe(false); // TLD de 1 letra
    expect(isValidEmail('a d@min.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('aceita fixo (10 dígitos) e celular (11 dígitos)', () => {
    expect(isValidPhone('(16) 3333-4444')).toBe(true);
    expect(isValidPhone('(16) 99999-0000')).toBe(true);
  });

  it('recusa quantidade de dígitos fora da faixa', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('99999-0000')).toBe(false);
    expect(isValidPhone('(16) 99999-00001')).toBe(false);
  });
});

describe('isValidPlaca', () => {
  it('aceita o formato antigo AAA1234', () => {
    expect(isValidPlaca('ABC1234')).toBe(true);
    expect(isValidPlaca('abc1234')).toBe(true);
    expect(isValidPlaca('ABC-1234')).toBe(true);
  });

  it('aceita o formato Mercosul AAA1A23', () => {
    expect(isValidPlaca('ABC1D23')).toBe(true);
  });

  it('recusa placas malformadas', () => {
    expect(isValidPlaca('')).toBe(false);
    expect(isValidPlaca('AB1234')).toBe(false);
    expect(isValidPlaca('ABCD123')).toBe(false);
    expect(isValidPlaca('1234567')).toBe(false);
  });
});

describe('SENHA_MINIMA', () => {
  it('acompanha o mínimo exigido pelo backend em POST /api/users', () => {
    // Divergir daqui faz o formulário aceitar uma senha que a API recusa.
    expect(SENHA_MINIMA).toBe(10);
  });
});
