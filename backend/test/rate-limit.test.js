/**
 * Regressão dos limites de requisição.
 *
 * Arquivo próprio de propósito: o store do `express-rate-limit` vive no
 * processo, e uma cota esgotada não volta. Cada arquivo de teste roda em um
 * worker separado, então o estado fica confinado aqui.
 *
 * Duas consequências que moldam a estrutura abaixo:
 *
 *  - A cota de mutação é por usuário e não se recupera entre casos, então as
 *    asserções de escrita vivem em UM caso que percorre a sequência inteira.
 *    Espalhá-las em vários casos faria o segundo começar já bloqueado.
 *  - Esgotar o limite de login bloqueia qualquer login daquele IP, inclusive o
 *    válido (o limiter barra antes de o handler poder marcar a tentativa como
 *    bem-sucedida). Por isso o caso de força bruta é o último do arquivo.
 *
 * `RATE_LIMIT_MUTACOES` é baixado antes de importar os helpers (que importam o
 * `server.js`, onde o limite é lido): gastar 100 escritas reais só para provar
 * a 101ª deixaria a suíte lenta sem provar nada a mais.
 */
process.env.RATE_LIMIT_MUTACOES = '5';

import { describe, it, expect, beforeEach } from 'vitest';

const { request, app, db, prepararBanco, autenticar, USUARIOS } = await import('./helpers.js');

describe('Rate limit de mutações', () => {
  let token;

  beforeEach(async () => {
    await prepararBanco();
    token = await autenticar('admin');
  });

  const criarCliente = (token, n) => request(app).post('/api/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome: `Cliente Numero ${n}`, telefone: '(16) 99999-0000' });

  it('bloqueia a escrita no limite, mantém a leitura livre e isola por usuário', async () => {
    // 1. Dentro da cota, escreve normalmente.
    for (let i = 0; i < 5; i++) {
      expect((await criarCliente(token, i)).status, `escrita ${i}`).toBe(200);
    }

    // 2. A próxima escrita é barrada antes do handler.
    const bloqueada = await criarCliente(token, 99);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.error).toMatch(/operações de escrita/);
    expect(await db.get('SELECT count(*) c FROM clientes')).toMatchObject({ c: 6 });

    // 3. Leitura segue livre: o dashboard recarrega sozinho e o operador
    //    navega entre telas o tempo todo — travar GET seria o falso positivo
    //    mais visível do expediente.
    for (const rota of ['/api/clientes', '/api/lavagens', '/api/dashboard/stats']) {
      const res = await request(app).get(rota).set('Authorization', `Bearer ${token}`);
      expect(res.status, rota).toBe(200);
    }

    // 4. Mesmo IP, outro usuário: cota própria. O frontend na Vercel chama a API
    //    no Render por rewrite de proxy, então uma chave por IP poderia fazer a
    //    loja inteira dividir um contador e travar o balcão no meio do dia.
    const tokenOperador = await autenticar('operador');
    const doOperador = await criarCliente(tokenOperador, 100);
    expect(doOperador.status).toBe(200);
  });
});

describe('Rate limit de autenticação (força bruta)', () => {
  beforeEach(prepararBanco);

  it('o login bem-sucedido não consome a cota', async () => {
    // skipSuccessfulRequests: o uso legítimo não pode esgotar o limite que
    // existe para conter força bruta. 12 logins válidos > o limite de 10.
    for (let i = 0; i < 12; i++) {
      const res = await request(app).post('/api/auth/login')
        .send({ email: USUARIOS.admin.email, senha: USUARIOS.admin.senha });
      expect(res.status, `login válido ${i}`).toBe(200);
    }
  });

  // ÚLTIMO caso do arquivo: a partir daqui nenhum login deste IP passa.
  it('bloqueia com 429 depois de 10 tentativas falhas', async () => {
    const tentativa = () => request(app).post('/api/auth/login')
      .send({ email: USUARIOS.admin.email, senha: 'senha-errada' });

    for (let i = 0; i < 10; i++) {
      expect((await tentativa()).status, `tentativa ${i}`).toBe(401);
    }

    const bloqueada = await tentativa();
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.error).toMatch(/Muitas tentativas de login/);
  });
});
