/**
 * Regressão de integridade do BI (FA-01, FA-02).
 * `data_conclusao` é propriedade exclusiva do servidor e lavagem não nasce
 * concluída: as duas regras sustentam as métricas de receita e fidelização.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, db, prepararBanco, autenticar, criarLavagem } from './helpers.js';

const DATA_FORJADA = '2024-01-01T00:00:00.000Z';

describe('data_conclusao pertence ao servidor (FA-01)', () => {
  let tokenOperador;
  let tokenAdmin;

  beforeEach(async () => {
    await prepararBanco();
    tokenOperador = await autenticar('operador');
    tokenAdmin = await autenticar('admin');
  });

  it('ignora data_conclusao enviada pelo cliente sem transição de status', async () => {
    const lavagem = await criarLavagem();

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ data_conclusao: DATA_FORJADA, observacao: 'tentativa de forja' });

    expect(res.status).toBe(200);
    expect(res.body.data_conclusao).toBeNull();
    expect(res.body.observacao).toBe('tentativa de forja');
  });

  it('ignora data_conclusao enviada junto da conclusão e usa a hora do servidor', async () => {
    const lavagem = await criarLavagem();
    const antes = Date.now();

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ status: 'concluida', data_conclusao: DATA_FORJADA });

    expect(res.status).toBe(200);
    expect(res.body.data_conclusao).not.toBe(DATA_FORJADA);
    const gravada = new Date(res.body.data_conclusao).getTime();
    expect(gravada).toBeGreaterThanOrEqual(antes - 1000);
    expect(gravada).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('não reescreve data_conclusao de uma lavagem já concluída', async () => {
    const original = '2026-01-15T10:00:00.000Z';
    const lavagem = await criarLavagem({ status: 'concluida', data_conclusao: original });

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'concluida', observacao: 'revisão' });

    expect(res.status).toBe(200);
    expect(res.body.data_conclusao).toBe(original);
  });

  it('ignora data_conclusao enviada na criação da lavagem', async () => {
    const res = await request(app)
      .post('/api/lavagens')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({
        cliente_id: 'cli-teste',
        veiculo_id: 'vei-teste',
        tipo_lavagem_id: 'tl-teste',
        valor: 25,
        data_conclusao: DATA_FORJADA,
      });

    expect(res.status).toBe(200);
    expect(res.body.data_conclusao).toBeNull();
  });
});

describe('lavagem não nasce concluída (FA-02)', () => {
  let tokenOperador;
  let tokenAdmin;

  beforeEach(async () => {
    await prepararBanco();
    tokenOperador = await autenticar('operador');
    tokenAdmin = await autenticar('admin');
  });

  const novaLavagem = (extra = {}) => ({
    cliente_id: 'cli-teste',
    veiculo_id: 'vei-teste',
    tipo_lavagem_id: 'tl-teste',
    valor: 25,
    ...extra,
  });

  it('rejeita com 403 o operador que cria a lavagem já concluída', async () => {
    const res = await request(app)
      .post('/api/lavagens')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send(novaLavagem({ status: 'concluida' }));

    expect(res.status).toBe(403);
    expect(await db.get('SELECT count(*) c FROM lavagens')).toMatchObject({ c: 0 });
  });

  it('permite ao admin o lançamento retroativo concluído', async () => {
    const res = await request(app)
      .post('/api/lavagens')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(novaLavagem({ status: 'concluida' }));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('concluida');
    expect(res.body.data_conclusao).not.toBeNull();
  });

  it('rejeita status fora do domínio com 400', async () => {
    const res = await request(app)
      .post('/api/lavagens')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(novaLavagem({ status: 'arquivada' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Status inválido/);
  });

  it('rejeita valor negativo com 400', async () => {
    const res = await request(app)
      .post('/api/lavagens')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(novaLavagem({ valor: -10 }));

    expect(res.status).toBe(400);
  });
});
