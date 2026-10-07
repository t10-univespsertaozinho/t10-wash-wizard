/**
 * Utilitários de formatação (FA-14, FA-15, FA-16).
 *
 * Cada caso aqui é um dado que já quebrou ou poderia quebrar a tela: valor nulo
 * no `toFixed`, data inválida no `toLocaleDateString`, telefone incompleto no
 * link do WhatsApp. Os nulos são testados de propósito, mesmo com `NOT NULL` no
 * schema — a defesa existe justamente para o contrato violado por fora da API.
 */
import { describe, it, expect } from 'vitest';
import {
  SEM_VALOR,
  apenasDigitos,
  dataSegura,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarMoedaExtenso,
  formatarPercentual,
  montarLinkWhatsapp,
  numeroSeguro,
  telefoneDiscavel,
} from '@/utils/format';

describe('numeroSeguro', () => {
  it('aceita números finitos, inclusive zero e negativos', () => {
    expect(numeroSeguro(0)).toBe(0);
    expect(numeroSeguro(45.5)).toBe(45.5);
    expect(numeroSeguro(-3)).toBe(-3);
  });

  it('converte strings numéricas', () => {
    expect(numeroSeguro('45.5')).toBe(45.5);
    expect(numeroSeguro('0')).toBe(0);
  });

  it('rejeita o que não dá para exibir', () => {
    expect(numeroSeguro(null)).toBeNull();
    expect(numeroSeguro(undefined)).toBeNull();
    expect(numeroSeguro('')).toBeNull();
    expect(numeroSeguro('abc')).toBeNull();
    expect(numeroSeguro(NaN)).toBeNull();
    expect(numeroSeguro(Infinity)).toBeNull();
    expect(numeroSeguro({})).toBeNull();
  });
});

describe('formatarMoeda', () => {
  it('formata com duas casas decimais', () => {
    expect(formatarMoeda(45)).toBe('R$ 45.00');
    expect(formatarMoeda(45.456)).toBe('R$ 45.46');
    expect(formatarMoeda(0)).toBe('R$ 0.00');
  });

  it('devolve traço em vez de estourar com valor ausente', () => {
    // Era aqui que a tela morria: `undefined.toFixed(2)` é TypeError.
    expect(formatarMoeda(undefined)).toBe(SEM_VALOR);
    expect(formatarMoeda(null)).toBe(SEM_VALOR);
    expect(formatarMoeda('')).toBe(SEM_VALOR);
  });

  it('aceita fallback customizado', () => {
    expect(formatarMoeda(null, 'R$ 0,00')).toBe('R$ 0,00');
  });
});

describe('formatarMoedaExtenso', () => {
  it('agrupa milhares no padrão pt-BR', () => {
    expect(formatarMoedaExtenso(1234.5)).toBe('R$ 1.234,50');
  });

  it('devolve traço com valor inválido', () => {
    expect(formatarMoedaExtenso(null)).toBe(SEM_VALOR);
    expect(formatarMoedaExtenso(NaN)).toBe(SEM_VALOR);
  });
});

describe('formatarPercentual', () => {
  it('formata positivos, negativos e zero', () => {
    expect(formatarPercentual(12)).toBe('12%');
    expect(formatarPercentual(-7.5)).toBe('-7.5%');
    expect(formatarPercentual(0)).toBe('0%');
  });

  it('nunca renderiza "undefined%"', () => {
    // Exatamente o sintoma relatado em FA-14 quando stats vinha nulo.
    expect(formatarPercentual(undefined)).toBe(SEM_VALOR);
    expect(formatarPercentual(null)).toBe(SEM_VALOR);
    expect(formatarPercentual(undefined)).not.toContain('undefined');
  });
});

describe('dataSegura', () => {
  it('aceita ISO, timestamp e Date', () => {
    expect(dataSegura('2026-10-07T12:00:00.000Z')).toBeInstanceOf(Date);
    expect(dataSegura(1760000000000)).toBeInstanceOf(Date);
    expect(dataSegura(new Date('2026-10-07'))).toBeInstanceOf(Date);
  });

  it('rejeita o que viraria "Invalid Date"', () => {
    expect(dataSegura(null)).toBeNull();
    expect(dataSegura(undefined)).toBeNull();
    expect(dataSegura('')).toBeNull();
    expect(dataSegura('data-invalida')).toBeNull();
    expect(dataSegura(new Date('nada'))).toBeNull();
  });
});

describe('formatarData', () => {
  it('formata no padrão brasileiro', () => {
    // Meio-dia UTC evita a virada de dia por fuso na máquina que roda o teste.
    expect(formatarData('2026-10-07T12:00:00.000Z')).toBe('07/10/2026');
  });

  it('devolve traço em vez de "Invalid Date"', () => {
    expect(formatarData(null)).toBe(SEM_VALOR);
    expect(formatarData('')).toBe(SEM_VALOR);
    expect(formatarData('qualquer coisa')).toBe(SEM_VALOR);
    expect(formatarData(null)).not.toContain('Invalid');
  });
});

describe('formatarDataHora', () => {
  it('inclui hora e minuto', () => {
    expect(formatarDataHora('2026-10-07T12:00:00.000Z')).toMatch(/^07\/10\/2026 \d{2}:\d{2}$/);
  });

  it('devolve traço com data inválida', () => {
    expect(formatarDataHora('nada')).toBe(SEM_VALOR);
  });
});

describe('apenasDigitos', () => {
  it('remove máscara de telefone', () => {
    expect(apenasDigitos('(16) 99999-0000')).toBe('16999990000');
  });

  it('devolve string vazia para entrada não textual', () => {
    expect(apenasDigitos(null)).toBe('');
    expect(apenasDigitos(undefined)).toBe('');
    expect(apenasDigitos({})).toBe('');
  });
});

describe('telefoneDiscavel', () => {
  it('aceita fixo (10) e celular (11) com ou sem máscara', () => {
    expect(telefoneDiscavel('(16) 3333-4444')).toBe(true);
    expect(telefoneDiscavel('(16) 99999-0000')).toBe(true);
    expect(telefoneDiscavel('16999990000')).toBe(true);
  });

  it('aceita número já com código do país', () => {
    expect(telefoneDiscavel('5516999990000')).toBe(true);
  });

  it('recusa número ausente ou incompleto', () => {
    expect(telefoneDiscavel(null)).toBe(false);
    expect(telefoneDiscavel('')).toBe(false);
    expect(telefoneDiscavel('99999-0000')).toBe(false); // sem DDD
    expect(telefoneDiscavel('(16) 9')).toBe(false);
  });
});

describe('montarLinkWhatsapp', () => {
  it('monta o link com o código do país e a mensagem escapada', () => {
    const link = montarLinkWhatsapp('(16) 99999-0000', 'Olá, João & cia!');

    expect(link).toContain('https://wa.me/5516999990000?text=');
    expect(link).toContain(encodeURIComponent('Olá, João & cia!'));
  });

  it('não duplica o código do país quando já vem no número', () => {
    expect(montarLinkWhatsapp('5516999990000', 'oi')).toContain('wa.me/5516999990000?');
  });

  it('devolve null em vez de um link quebrado', () => {
    // O sintoma de FA-16: `https://wa.me/55?text=...`, um botão inútil.
    expect(montarLinkWhatsapp(null, 'oi')).toBeNull();
    expect(montarLinkWhatsapp('', 'oi')).toBeNull();
    expect(montarLinkWhatsapp('123', 'oi')).toBeNull();
  });
});
