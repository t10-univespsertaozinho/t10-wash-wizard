/**
 * Contrato de GET /api/dashboard/stats (FA-14, FA-15, item 3.4 do plano).
 *
 * A UI do painel formata esses números direto no JSX. Se um campo vier
 * `undefined` ou `null`, a tela renderiza "undefined%" ou estoura em `toFixed`.
 * O caso mais perigoso é justamente o banco vazio — uma instalação nova — então
 * é ele que o contrato cobre primeiro.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, db, prepararBanco, autenticar, limparTabelas, criarLavagem } from './helpers.js';

const CAMPOS_FINANCEIRO = [
  'receita_semana', 'lavagens_semana', 'ticket_medio', 'receita_semana_anterior',
  'lavagens_semana_anterior', 'variacao_receita_pct', 'variacao_ticket_pct',
];

const CAMPOS_FIDELIZACAO = [
  'total_clientes_com_lavagem', 'clientes_recorrentes', 'taxa_recorrencia_pct',
];

async function buscarStats() {
  const token = await autenticar('admin');
  const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body;
}

describe('Contrato do dashboard com banco vazio', () => {
  beforeEach(async () => {
    await prepararBanco();
    await limparTabelas('lavagens', 'veiculos', 'clientes', 'produtos');
  });

  it('devolve todos os números financeiros definidos e finitos', async () => {
    const stats = await buscarStats();

    for (const campo of CAMPOS_FINANCEIRO) {
      expect(stats.financeiro[campo], campo).toBeTypeOf('number');
      expect(Number.isFinite(stats.financeiro[campo]), campo).toBe(true);
    }
  });

  it('devolve todos os números de fidelização definidos', async () => {
    const stats = await buscarStats();

    for (const campo of CAMPOS_FIDELIZACAO) {
      expect(stats.fidelizacao[campo], campo).toBeTypeOf('number');
      expect(Number.isFinite(stats.fidelizacao[campo]), campo).toBe(true);
    }
  });

  it('devolve listas vazias, nunca null ou undefined', async () => {
    const stats = await buscarStats();

    for (const lista of ['clientes_ausentes', 'mix_servicos', 'estoque_critico', 'pagamentos', 'desempenho_operadores']) {
      expect(Array.isArray(stats[lista]), lista).toBe(true);
    }
    // Sem dado nenhum, nada pode aparecer nestas listas.
    for (const lista of ['clientes_ausentes', 'estoque_critico', 'pagamentos']) {
      expect(stats[lista], lista).toHaveLength(0);
    }
  });

  it('zera as métricas de catálogos e rosters em vez de omitir a linha', async () => {
    // mix_servicos e desempenho_operadores são listas de cadastro: o tipo de
    // lavagem e o operador aparecem mesmo sem nenhum atendimento, com os números
    // em zero. A UI divide e formata esses campos, então eles precisam ser
    // numéricos — nunca null.
    const stats = await buscarStats();

    expect(stats.mix_servicos.length).toBeGreaterThan(0);
    for (const servico of stats.mix_servicos) {
      expect(servico.total_atendimentos).toBeTypeOf('number');
      expect(Number.isFinite(servico.faturamento_total)).toBe(true);
    }

    for (const operador of stats.desempenho_operadores) {
      expect(operador.total_lavagens).toBeTypeOf('number');
      expect(Number.isFinite(operador.receita)).toBe(true);
      expect(Number.isFinite(operador.ticket_medio)).toBe(true);
    }
  });

  it('devolve a série de 7 dias completa, com zeros em vez de buracos', async () => {
    const stats = await buscarStats();

    expect(stats.financeiro.fluxo_diario_7d).toHaveLength(7);
    for (const dia of stats.financeiro.fluxo_diario_7d) {
      expect(dia.receita).toBeTypeOf('number');
      expect(dia.lavagens).toBeTypeOf('number');
    }
  });

  it('devolve tempo de atendimento zerado sem lavagens concluídas', async () => {
    const stats = await buscarStats();

    expect(stats.tempo_atendimento.total_finalizadas).toBe(0);
    expect(stats.tempo_atendimento.tempo_medio_min).toBeTypeOf('number');
    expect(Number.isFinite(stats.tempo_atendimento.tempo_medio_min)).toBe(true);
  });
});

describe('Contrato do dashboard com dados incompletos', () => {
  beforeEach(async () => {
    await prepararBanco();
  });

  it('mantém o shape com lavagem sem pagamento nem observação', async () => {
    await criarLavagem({ status: 'concluida', data_conclusao: new Date().toISOString(), pagamento: null, observacao: null });

    const stats = await buscarStats();

    expect(stats.financeiro.receita_semana).toBeTypeOf('number');
    expect(Array.isArray(stats.pagamentos)).toBe(true);
    for (const forma of stats.pagamentos) {
      expect(forma.receita).toBeTypeOf('number');
      expect(forma.lavagens).toBeTypeOf('number');
    }
  });

  it('não divide por zero quando a semana anterior não teve receita', async () => {
    await criarLavagem({ status: 'concluida', data_conclusao: new Date().toISOString(), valor: 100 });

    const stats = await buscarStats();

    expect(Number.isFinite(stats.financeiro.variacao_receita_pct)).toBe(true);
    expect(Number.isFinite(stats.financeiro.variacao_ticket_pct)).toBe(true);
  });

  it('lista estoque crítico somente quando existe produto abaixo do mínimo', async () => {
    await db.run('INSERT INTO produtos (id, nome, quantidade, estoque_minimo, unidade, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['prod-ok', 'Shampoo', 50, 5, 'L', new Date().toISOString()]);

    let stats = await buscarStats();
    expect(stats.estoque_critico).toHaveLength(0);

    await db.run('UPDATE produtos SET quantidade = 1 WHERE id = ?', ['prod-ok']);
    stats = await buscarStats();
    expect(stats.estoque_critico).toHaveLength(1);
    expect(stats.estoque_critico[0]).toMatchObject({ id: 'prod-ok' });
    expect(stats.estoque_critico[0].consumo_diario).toBeTypeOf('number');
  });

  it('exige autenticação', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});
