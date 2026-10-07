/**
 * Regressão de RBAC (FA-03, FA-05) e de autenticação (FA-06).
 * Cada caso aqui corresponde a um cenário de reprodução da matriz de falhas:
 * se algum voltar a passar com 200, a falha original foi reintroduzida.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, db, prepararBanco, autenticar, criarLavagem, USUARIOS } from './helpers.js';

describe('RBAC — rotas destrutivas exigem admin (FA-03)', () => {
  let tokenOperador;
  let tokenAdmin;

  beforeEach(async () => {
    await prepararBanco();
    tokenOperador = await autenticar('operador');
    tokenAdmin = await autenticar('admin');
  });

  it('nega 403 ao operador que tenta excluir uma lavagem', async () => {
    const lavagem = await criarLavagem();

    const res = await request(app)
      .delete(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`);

    expect(res.status).toBe(403);
    // O registro continua existindo: o 403 barrou antes do DELETE.
    expect(await db.get('SELECT id FROM lavagens WHERE id = ?', [lavagem.id])).toBeTruthy();
  });

  it('nega 403 ao operador que tenta excluir um cliente', async () => {
    const res = await request(app)
      .delete('/api/clientes/cli-teste')
      .set('Authorization', `Bearer ${tokenOperador}`);

    expect(res.status).toBe(403);
    expect(await db.get('SELECT id FROM clientes WHERE id = ?', ['cli-teste'])).toBeTruthy();
  });

  it('nega 403 ao operador que tenta excluir um veículo', async () => {
    const res = await request(app)
      .delete('/api/veiculos/vei-teste')
      .set('Authorization', `Bearer ${tokenOperador}`);

    expect(res.status).toBe(403);
    expect(await db.get('SELECT id FROM veiculos WHERE id = ?', ['vei-teste'])).toBeTruthy();
  });

  it('permite ao admin excluir e grava a trilha de auditoria antes do DELETE (FA-04)', async () => {
    const lavagem = await criarLavagem({ valor: 123.45 });

    const res = await request(app)
      .delete(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(await db.get('SELECT id FROM lavagens WHERE id = ?', [lavagem.id])).toBeUndefined();

    // A linha de auditoria sobrevive ao DELETE: é a prova de quem apagou o quê.
    const auditoria = await db.get(
      'SELECT campo, user_id, valor_anterior FROM auditoria_lavagens WHERE lavagem_id = ?',
      [lavagem.id]
    );
    expect(auditoria).toMatchObject({ campo: 'exclusao_lavagem', user_id: USUARIOS.admin.id });
    expect(JSON.parse(auditoria.valor_anterior)).toMatchObject({ id: lavagem.id, valor: 123.45 });
  });

  it('audita as lavagens derrubadas em cascata ao excluir um cliente', async () => {
    const lavagem = await criarLavagem();

    const res = await request(app)
      .delete('/api/clientes/cli-teste')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    const auditoria = await db.get('SELECT campo FROM auditoria_lavagens WHERE lavagem_id = ?', [lavagem.id]);
    expect(auditoria?.campo).toBe('exclusao_cliente');
  });

  it('exige autenticação: sem token é 401', async () => {
    const res = await request(app).delete('/api/clientes/cli-teste');
    expect(res.status).toBe(401);
  });
});

describe('RBAC — campos financeiros exigem admin (FA-05)', () => {
  let tokenOperador;
  let tokenAdmin;

  beforeEach(async () => {
    await prepararBanco();
    tokenOperador = await autenticar('operador');
    tokenAdmin = await autenticar('admin');
  });

  it('nega 403 ao operador que tenta reduzir o valor da lavagem', async () => {
    const lavagem = await criarLavagem({ valor: 80 });

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ valor: 40 });

    expect(res.status).toBe(403);
    const atual = await db.get('SELECT valor FROM lavagens WHERE id = ?', [lavagem.id]);
    expect(atual.valor).toBe(80);
  });

  it('nega 403 ao operador que tenta trocar a forma de pagamento', async () => {
    const lavagem = await criarLavagem({ pagamento: 'PIX' });

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ pagamento: 'Dinheiro' });

    expect(res.status).toBe(403);
  });

  it('permite ao operador avançar o status e registrar observação', async () => {
    const lavagem = await criarLavagem();

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ status: 'em_progresso', observacao: 'Cliente aguardando' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('em_progresso');
  });

  it('permite ao admin alterar o valor e registra a mudança na auditoria', async () => {
    const lavagem = await criarLavagem({ valor: 80 });

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: 40 });

    expect(res.status).toBe(200);
    const auditoria = await db.get(
      "SELECT valor_anterior, valor_novo FROM auditoria_lavagens WHERE lavagem_id = ? AND campo = 'valor'",
      [lavagem.id]
    );
    expect(auditoria).toMatchObject({ valor_anterior: '80', valor_novo: '40' });
  });

  it('reenviar o mesmo valor não é alteração, então o operador não é barrado', async () => {
    const lavagem = await criarLavagem({ valor: 80, pagamento: 'PIX' });

    const res = await request(app)
      .put(`/api/lavagens/${lavagem.id}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ valor: 80, pagamento: 'PIX', status: 'em_progresso' });

    expect(res.status).toBe(200);
  });
});

describe('Revogação de token (FA-06)', () => {
  beforeEach(async () => {
    await prepararBanco();
  });

  it('invalida o token quando o usuário é removido do banco', async () => {
    const token = await autenticar('operador');
    await db.run('DELETE FROM users WHERE id = ?', [USUARIOS.operador.id]);

    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('invalida o token quando o perfil muda depois do login', async () => {
    const token = await autenticar('admin');
    await db.run('UPDATE users SET role = ? WHERE id = ?', ['operador', USUARIOS.admin.id]);

    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejeita token assinado com outro segredo', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const forjado = jwt.sign({ id: USUARIOS.admin.id, role: 'admin' }, 'outro_segredo_qualquer_bem_longo_123');

    const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${forjado}`);
    expect(res.status).toBe(401);
  });
});
