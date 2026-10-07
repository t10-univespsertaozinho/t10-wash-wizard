/**
 * Regressão do import de backup (FA-18) e do rollback transacional.
 * Dados fora do domínio devem virar 400 apontando a linha, não 500 genérico,
 * e o banco precisa ficar exatamente como estava.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, db, prepararBanco, autenticar, limparTabelas } from './helpers.js';

const anexarCsv = (req, tabela, conteudo) =>
  req.attach(`${tabela}.csv`, Buffer.from(conteudo, 'utf8'), `${tabela}.csv`);

describe('POST /api/backup/import — validação de domínio (FA-18)', () => {
  let tokenAdmin;
  let tokenOperador;

  beforeEach(async () => {
    await prepararBanco();
    tokenAdmin = await autenticar('admin');
    tokenOperador = await autenticar('operador');
  });

  it('é restrito a admin', async () => {
    await limparTabelas('lavagens', 'veiculos');
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenOperador}`),
      'clientes',
      'id,nome\ncli-x,Fulano\n'
    );
    expect(res.status).toBe(403);
  });

  it('importa um CSV válido', async () => {
    await limparTabelas('lavagens', 'veiculos');
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'clientes',
      'id,nome,telefone\ncli-a,Alice,(16) 90000-0001\ncli-b,Bruno,(16) 90000-0002\n'
    );

    expect(res.status).toBe(200);
    expect(res.body.records).toBe(2);
    expect(await db.get('SELECT count(*) c FROM clientes')).toMatchObject({ c: 2 });
  });

  it('devolve 400 citando linha e coluna para role inválido', async () => {
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'users',
      'id,email,nome,role\nu1,a@b.com,Alice,admin\nu2,c@d.com,Bruno,gerente\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('users.csv');
    expect(res.body.error).toContain('linha 3');
    expect(res.body.error).toContain('role');
    // Rollback íntegro: os usuários originais continuam no banco.
    expect(await db.get('SELECT count(*) c FROM users')).toMatchObject({ c: 2 });
    expect(await db.get('SELECT id FROM users WHERE id = ?', ['u1'])).toBeUndefined();
  });

  it('devolve 400 para status de lavagem fora do domínio', async () => {
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'lavagens',
      'id,cliente_id,veiculo_id,tipo_lavagem_id,status,valor,data\n' +
      'l1,cli-teste,vei-teste,tl-teste,arquivada,50,2026-01-01T00:00:00.000Z\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status');
    expect(res.body.error).toContain('linha 2');
  });

  it('devolve 400 para preço negativo em tipos_lavagem', async () => {
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'tipos_lavagem',
      'id,nome,preco\ntl-a,Simples,25\ntl-b,Completa,-5\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('preco');
    expect(res.body.error).toContain('linha 3');
  });

  it('devolve 400 para preço não numérico', async () => {
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'tipos_lavagem',
      'id,nome,preco\ntl-a,Simples,vinte e cinco\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('preco');
  });

  it('devolve 400 para tipo de movimentação inválido', async () => {
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'movimentacoes',
      'id,produto_id,tipo,quantidade\nm1,prod-x,devolucao,3\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tipo');
  });

  it('devolve 400 quando uma coluna obrigatória vem vazia', async () => {
    await limparTabelas('lavagens', 'veiculos');
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'clientes',
      'id,nome\ncli-a,Alice\n,Sem Id\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('linha 3');
    expect(res.body.error).toContain('obrigatório');
  });

  it('aceita coluna opcional em branco como NULL', async () => {
    await limparTabelas('lavagens', 'veiculos');
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'clientes',
      'id,nome,telefone\ncli-a,Alice,\n'
    );

    expect(res.status).toBe(200);
    expect(await db.get('SELECT telefone FROM clientes WHERE id = ?', ['cli-a'])).toMatchObject({ telefone: null });
  });

  it('rejeita coluna fora da allowlist', async () => {
    await limparTabelas('lavagens', 'veiculos');
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'clientes',
      'id,nome,saldo_devedor\ncli-a,Alice,100\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Colunas inválidas');
  });

  it('rejeita o backup inteiro quando há referência órfã', async () => {
    await limparTabelas('lavagens');
    const res = await anexarCsv(
      request(app).post('/api/backup/import').set('Authorization', `Bearer ${tokenAdmin}`),
      'veiculos',
      'id,cliente_id,modelo,placa\nv1,cliente-que-nao-existe,Gol,ABC1D23\n'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inconsistente|órfã/);
  });
});
