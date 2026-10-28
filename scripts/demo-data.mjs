#!/usr/bin/env node
/**
 * Gera um banco SQLite de demonstração, 100% fictício, para as capturas de tela
 * do README (`scripts/capture-screenshots.mjs`).
 *
 * Por que não usar o `wash_wizard.db` de desenvolvimento:
 *  1. Privacidade — o banco de dev pode conter dados reais de clientes da
 *     validação em campo (nome, telefone, placa). Print disso num repositório
 *     público é vazamento de dado pessoal, mesmo que acidental.
 *  2. Qualidade — o `seed.js` sorteia datas no mês corrente. Em muitos dias a
 *     "semana atual" do dashboard sai zerada e o print fica sem graça.
 *
 * Este script resolve os dois: dados inventados e datas ancoradas em "hoje",
 * com PRNG de semente fixa (mesmo resultado em cada execução do mesmo dia).
 *
 * Uso:
 *   node scripts/demo-data.mjs [--out caminho.db]
 *
 * Nada aqui aponta para o banco real: a saída padrão é
 * ~/.cache/wash-wizard-demo/wash_wizard.db, fora do repositório.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');

// sqlite3 e bcryptjs já são dependências do backend; reaproveitá-las evita uma
// segunda árvore de node_modules só para gerar uma imagem.
const requireDoBackend = createRequire(path.join(RAIZ, 'backend', 'package.json'));
const sqlite3 = requireDoBackend('sqlite3');
const bcrypt = requireDoBackend('bcryptjs');

const SCHEMA = path.join(RAIZ, 'backend', 'schema.sql');
const SAIDA_PADRAO = path.join(os.homedir(), '.cache', 'wash-wizard-demo', 'wash_wizard.db');

const argOut = process.argv.indexOf('--out');
const DB_PATH = argOut > -1 && process.argv[argOut + 1]
  ? path.resolve(process.argv[argOut + 1])
  : process.env.DEMO_DB_PATH
    ? path.resolve(process.env.DEMO_DB_PATH)
    : SAIDA_PADRAO;

/* ------------------------------------------------------------------ */
/* PRNG determinístico (mulberry32) — mesma seed, mesmo dataset        */
/* ------------------------------------------------------------------ */
function criarRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = criarRandom(20261028);
const sortear = (lista) => lista[Math.floor(random() * lista.length)];
const inteiro = (min, max) => min + Math.floor(random() * (max - min + 1));

/* ------------------------------------------------------------------ */
/* Datas ancoradas em hoje (UTC, igual ao que as queries do BI usam)   */
/* ------------------------------------------------------------------ */
const AGORA = new Date();
const HOJE_UTC = Date.UTC(AGORA.getUTCFullYear(), AGORA.getUTCMonth(), AGORA.getUTCDate());
const DIA = 24 * 60 * 60 * 1000;

/** Data a N dias atrás do dia de hoje, em uma hora fixa (UTC). */
function diasAtras(dias, hora = 12, minuto = 0) {
  return new Date(HOJE_UTC - dias * DIA + (hora * 60 + minuto) * 60000);
}

/** Data a N minutos atrás do instante atual (para a fila do pátio). */
function minutosAtras(minutos) {
  return new Date(AGORA.getTime() - minutos * 60000);
}

const iso = (data) => data.toISOString();
const ymd = (data) => data.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Catálogo fictício                                                   */
/* ------------------------------------------------------------------ */
// Clientes são pseudônimos ("Cliente 001"), não nomes de pessoas.
//
// A versão anterior usava nomes completos plausíveis (nome + sobrenome comuns)
// e o resultado, embora inventado, era indistinguível de um dump real de
// clientes: nome + telefone + data de nascimento + placa na mesma tela. Para a
// LGPD isso é pior do que parece — o dado sintético não é dado pessoal (art. 5º,
// I, porque não se refere a pessoa natural identificável), mas o *formato*
// idêntico ao real cria risco de colisão (o telefone sorteado pode existir) e
// faz a captura parecer vazamento. Pseudônimo elimina os dois problemas.
const nomeCliente = (i) => `Cliente ${String(i + 1).padStart(3, '0')}`;

// Telefone em DDD 00: formatação válida para a UI, mas o DDD 00 não é
// atribuído pela ANATEL, então é impossível colidir com a linha de alguém.
const telefoneCliente = (i) => `(00) 90000-${String(i + 1).padStart(4, '0')}`;

// Placa mascarada (5 bullets + 2 dígitos = 7 caracteres): preserva a largura da
// coluna e deixa explícito que o dado foi suprimido. Placas reais identificam o
// proprietário junto ao Detran, então nenhuma placa plausível entra no dataset.
const placaMascarada = (i) => `•••••${String(i + 1).padStart(2, '0')}`;

const MODELOS = [
  ['Toyota', 'Corolla', 'Prata'], ['Honda', 'Civic', 'Preto'],
  ['Volkswagen', 'Gol', 'Branco'], ['Ford', 'Ka', 'Vermelho'],
  ['Chevrolet', 'Onix', 'Cinza'], ['Hyundai', 'HB20', 'Azul'],
  ['Fiat', 'Uno', 'Branco'], ['Jeep', 'Renegade', 'Laranja'],
  ['Nissan', 'Versa', 'Prata'], ['Toyota', 'Etios', 'Branco'],
  ['Honda', 'Fit', 'Cinza'], ['Volkswagen', 'Polo', 'Preto'],
  ['Ford', 'EcoSport', 'Vermelho'], ['Chevrolet', 'Spin', 'Prata'],
  ['Hyundai', 'Creta', 'Branco'], ['Renault', 'Duster', 'Marrom'],
  ['Fiat', 'Argo', 'Azul'], ['Toyota', 'Yaris', 'Prata'],
  ['Honda', 'City', 'Cinza'], ['Peugeot', '208', 'Branco'],
  ['Citroën', 'C3', 'Vermelho'], ['Mitsubishi', 'L200', 'Prata'],
  ['Volkswagen', 'Saveiro', 'Branco'], ['Chevrolet', 'Tracker', 'Preto'],
  ['Nissan', 'Kicks', 'Cinza'], ['Fiat', 'Toro', 'Prata'],
  ['Ford', 'Ranger', 'Azul'], ['Honda', 'HR-V', 'Branco'],
  ['Toyota', 'Hilux', 'Prata'], ['Hyundai', 'Tucson', 'Preto'],
];

const SERVICOS = [
  ['Lavagem Simples', 'Lavagem externa com água e sabão', 25.0],
  ['Lavagem Completa', 'Lavagem interna e externa completa', 45.0],
  ['Lavagem a Seco', 'Lavagem ecológica sem uso de água', 35.0],
  ['Cera de Proteção', 'Aplicação de cera de proteção', 50.0],
  ['Polimento', 'Polimento completo da pintura', 80.0],
  ['Higienização Interna', 'Limpeza profunda de estofados e carpetes', 60.0],
];

// quantidade, mínimo, categoria, unidade, preço — desenhados para produzir
// três estados distintos no card de Runway: zerado, urgente e atenção.
const PRODUTOS = [
  ['Shampoo Automotivo', 3, 5, 'Lavagem', 'L', 28.9, 30],
  ['Cera Líquida', 0, 4, 'Acabamento', 'L', 42.5, 20],
  ['Pretinho para Pneus', 2, 6, 'Acabamento', 'L', 19.9, 12],
  ['Pano de Microfibra', 40, 12, 'Acessórios', 'un', 6.5, 0],
  ['Desengraxante', 14, 5, 'Lavagem', 'L', 24.0, 6],
  ['Sabão Neutro', 22, 8, 'Lavagem', 'L', 15.5, 8],
  ['Limpa Vidros', 18, 6, 'Acabamento', 'L', 12.9, 4],
  ['Silicone em Gel', 11, 4, 'Acabamento', 'un', 22.0, 3],
  ['Aspirador de Pó', 9, 3, 'Equipamento', 'un', 89.0, 0],
  ['Cera em Pasta', 16, 5, 'Acabamento', 'un', 32.0, 2],
];

const PAGAMENTOS = ['Pix', 'Cartão de Crédito', 'Dinheiro', 'Cartão de Débito'];

/* ------------------------------------------------------------------ */
/* Acesso ao SQLite (callback -> Promise)                              */
/* ------------------------------------------------------------------ */
// O diretório precisa existir antes do `new Database`, senão o sqlite3 falha
// com SQLITE_CANTOPEN. A limpeza também é feita *antes* de abrir o handle:
// apagar o arquivo por baixo de uma conexão aberta rende SQLITE_IOERR.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
for (const sufixo of ['', '-wal', '-shm']) {
  const alvo = `${DB_PATH}${sufixo}`;
  if (fs.existsSync(alvo)) fs.rmSync(alvo);
}
const db = new sqlite3.Database(DB_PATH);
const exec = (sql) => new Promise((ok, erro) => db.exec(sql, (e) => (e ? erro(e) : ok())));
const run = (sql, params = []) => new Promise((ok, erro) => db.run(sql, params, function (e) { e ? erro(e) : ok(this); }));
const get = (sql, params = []) => new Promise((ok, erro) => db.get(sql, params, (e, r) => (e ? erro(e) : ok(r))));
const all = (sql, params = []) => new Promise((ok, erro) => db.all(sql, params, (e, r) => (e ? erro(e) : ok(r))));

/* ------------------------------------------------------------------ */
/* Construção dos dados                                                */
/* ------------------------------------------------------------------ */
async function semear() {
  await exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await exec(fs.readFileSync(SCHEMA, 'utf8'));

  const agora = iso(AGORA);
  const senhaAdmin = (process.env.SEED_ADMIN_PASSWORD || 'admin123');
  const senhaOperador = (process.env.SEED_OPERADOR_PASSWORD || 'operador123');

  const usuarios = [
    ['usr-admin', 'admin@washwizard.com', 'Administrador', 'admin', bcrypt.hashSync(senhaAdmin, 10)],
    ['usr-operador', 'operador@washwizard.com', 'Operador Demo', 'operador', bcrypt.hashSync(senhaOperador, 10)],
  ];
  for (const u of usuarios) {
    await run(
      'INSERT INTO users (id, email, nome, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [...u, agora],
    );
  }

  for (const [i, [nome, descricao, preco]] of SERVICOS.entries()) {
    await run(
      'INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)',
      [`tl-${String(i + 1).padStart(3, '0')}`, nome, descricao, preco, agora],
    );
  }

  const clientes = [];
  for (let i = 0; i < 24; i += 1) {
    const id = `cli-${String(i + 1).padStart(3, '0')}`;
    const nome = nomeCliente(i);
    const telefone = telefoneCliente(i);
    // Data de nascimento é dado pessoal sem uso nas telas de demonstração:
    // fica nula (minimização, LGPD art. 6º, III). O campo continua no schema e
    // aparece como "não informado" na ficha do cliente.
    await run(
      'INSERT INTO clientes (id, user_id, nome, telefone, data_nascimento, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, 'usr-admin', nome, telefone, null, agora],
    );
    clientes.push({ id, nome, telefone });
  }

  const veiculos = [];
  for (let i = 0; i < MODELOS.length; i += 1) {
    const [marca, modelo, cor] = MODELOS[i];
    const dono = clientes[i % clientes.length];
    const id = `vei-${String(i + 1).padStart(3, '0')}`;
    const placa = placaMascarada(i);
    await run(
      'INSERT INTO veiculos (id, cliente_id, user_id, modelo, placa, cor, marca, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, dono.id, 'usr-admin', modelo, placa, cor, marca, agora],
    );
    veiculos.push({ id, cliente_id: dono.id });
  }
  // Um cliente com dois carros — cenário real e que a tela de detalhe ilustra.
  await run(
    'INSERT INTO veiculos (id, cliente_id, user_id, modelo, placa, cor, marca, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['vei-031', clientes[0].id, 'usr-admin', 'Fiat Strada', placaMascarada(30), 'Branco', 'Fiat', agora],
  );
  veiculos.push({ id: 'vei-031', cliente_id: clientes[0].id });

  const produtos = [];
  for (const [i, [nome, quantidade, minimo, categoria, unidade, preco, saida30d]] of PRODUTOS.entries()) {
    const id = `prod-${String(i + 1).padStart(3, '0')}`;
    await run(
      'INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, nome, quantidade, minimo, categoria, unidade, preco, 'usr-admin', agora],
    );
    produtos.push({ id, nome: nome, saida30d });
  }

  /* --------------------------- Lavagens --------------------------- */
  // Os 4 últimos clientes são reservados ao radar de ausentes (f) e por isso
  // ficam fora do sorteio das lavagens recentes — senão a última visita deles
  // seria hoje e o radar do dashboard sairia vazio.
  const ATIVOS = clientes.length - 4;

  const lavagens = [];
  let seq = 1;
  const nova = ({ clienteIdx, veiculoId, tipoIdx, status, valor, data, conclusao, user, pagamento, observacao = null }) => {
    lavagens.push({
      id: `lav-${String(seq).padStart(4, '0')}`,
      cliente_id: clientes[clienteIdx].id,
      veiculo_id: veiculoId ?? veiculos[clienteIdx % veiculos.length].id,
      tipo_lavagem_id: `tl-${String(tipoIdx + 1).padStart(3, '0')}`,
      status,
      valor,
      data: iso(data),
      user_id: user,
      pagamento,
      data_conclusao: conclusao ? iso(conclusao) : null,
      observacao,
    });
    seq += 1;
  };
  const horarioConclusao = (inicio, minutos) => new Date(inicio.getTime() + minutos * 60000);
  const precoDe = (tipoIdx) => SERVICOS[tipoIdx][2];

  // a) Fila do pátio: pendentes e em progresso, sempre no passado recente.
  const fila = [
    { clienteIdx: 3, tipoIdx: 1, status: 'em_progresso', minutos: 15 },
    { clienteIdx: 8, tipoIdx: 4, status: 'em_progresso', minutos: 40 },
    { clienteIdx: 12, tipoIdx: 0, status: 'pendente', minutos: 25 },
    { clienteIdx: 17, tipoIdx: 2, status: 'pendente', minutos: 50 },
    { clienteIdx: 16, tipoIdx: 3, status: 'pendente', minutos: 80 },
  ];
  fila.forEach((f) => nova({
    clienteIdx: f.clienteIdx,
    tipoIdx: f.tipoIdx,
    status: f.status,
    valor: precoDe(f.tipoIdx),
    data: minutosAtras(f.minutos),
    user: 'usr-operador',
    pagamento: f.status === 'em_progresso' ? 'Pix' : 'Pendente',
    observacao: f.tipoIdx === 4 ? 'Cliente aguarda na recepção' : null,
  }));

  // b) Semana atual: 2 concluídas por dia nos últimos 6 dias + 2 hoje.
  for (let dias = 6; dias >= 1; dias -= 1) {
    for (const [k, hora] of [9, 15].entries()) {
      const tipoIdx = sortear([0, 0, 1, 1, 2, 3, 4, 5]);
      const inicio = diasAtras(dias, hora, k * 20);
      nova({
        clienteIdx: inteiro(0, ATIVOS - 1),
        tipoIdx,
        status: 'concluida',
        valor: precoDe(tipoIdx),
        data: inicio,
        conclusao: horarioConclusao(inicio, inteiro(38, 72)),
        user: k % 2 === 0 ? 'usr-operador' : 'usr-admin',
        pagamento: sortear(PAGAMENTOS),
      });
    }
  }
  for (const [k, minutos] of [150, 260].entries()) {
    const inicio = minutosAtras(minutos);
    // Evita "lavagem de hoje" caindo em ontem quando o script roda de madrugada.
    if (ymd(inicio) !== ymd(AGORA)) continue;
    const tipoIdx = sortear([0, 1, 3, 5]);
    nova({
      clienteIdx: inteiro(0, ATIVOS - 1),
      tipoIdx,
      status: 'concluida',
      valor: precoDe(tipoIdx),
      data: inicio,
      conclusao: horarioConclusao(inicio, inteiro(40, 70)),
      user: k === 0 ? 'usr-operador' : 'usr-admin',
      pagamento: sortear(PAGAMENTOS),
    });
  }

  // c) Semana anterior (8 a 14 dias): um pouco abaixo da atual, para o
  //    comparativo percentual do dashboard mostrar crescimento.
  for (const dias of [8, 9, 10, 11, 12, 13]) {
    for (const hora of [10, 16]) {
      if (hora === 16 && dias % 2 === 0) continue;
      const tipoIdx = sortear([0, 1, 1, 2, 3, 5]);
      const inicio = diasAtras(dias, hora, 10);
      nova({
        clienteIdx: inteiro(0, ATIVOS - 1),
        tipoIdx,
        status: 'concluida',
        valor: precoDe(tipoIdx),
        data: inicio,
        conclusao: horarioConclusao(inicio, inteiro(40, 80)),
        user: sortear(['usr-operador', 'usr-admin']),
        pagamento: sortear(PAGAMENTOS),
      });
    }
  }

  // d) 15 a 30 dias: histórico do mix de serviços (janela de 30 dias do BI).
  for (let dias = 15; dias <= 30; dias += 1) {
    const porDia = dias % 3 === 0 ? 2 : 1;
    for (let k = 0; k < porDia; k += 1) {
      const tipoIdx = sortear([0, 0, 1, 1, 2, 3, 4, 5]);
      const inicio = diasAtras(dias, 9 + k * 5, inteiro(0, 50));
      nova({
        clienteIdx: inteiro(0, ATIVOS - 1),
        tipoIdx,
        status: 'concluida',
        valor: precoDe(tipoIdx),
        data: inicio,
        conclusao: horarioConclusao(inicio, inteiro(35, 85)),
        user: sortear(['usr-operador', 'usr-admin']),
        pagamento: sortear(PAGAMENTOS),
      });
    }
  }

  // e) 31 a 120 dias: base de recorrência (taxa de fidelização).
  for (let dias = 31; dias <= 120; dias += 2) {
    if (dias > 60 && dias % 4 !== 0) continue;
    const tipoIdx = sortear([0, 1, 2, 3, 4]);
    const inicio = diasAtras(dias, 10, inteiro(0, 55));
    nova({
      clienteIdx: inteiro(0, 15),
      tipoIdx,
      status: 'concluida',
      valor: precoDe(tipoIdx),
      data: inicio,
      conclusao: horarioConclusao(inicio, inteiro(40, 90)),
      user: sortear(['usr-operador', 'usr-admin']),
      pagamento: sortear(PAGAMENTOS),
    });
  }

  // f) Clientes ausentes: 4 clientes habituais cuja última visita foi há
  //    45–95 dias — é o público do radar de reengajamento via WhatsApp.
  const ausentes = [
    { clienteIdx: 20, dias: 47, visitas: 4 },
    { clienteIdx: 21, dias: 58, visitas: 3 },
    { clienteIdx: 22, dias: 73, visitas: 5 },
    { clienteIdx: 23, dias: 91, visitas: 3 },
  ];
  for (const a of ausentes) {
    for (let v = 0; v < a.visitas; v += 1) {
      const tipoIdx = sortear([0, 1, 1, 3]);
      const inicio = diasAtras(a.dias + v * 9, 11, v * 7);
      nova({
        clienteIdx: a.clienteIdx,
        tipoIdx,
        status: 'concluida',
        valor: precoDe(tipoIdx),
        data: inicio,
        conclusao: horarioConclusao(inicio, inteiro(40, 75)),
        user: 'usr-operador',
        pagamento: sortear(PAGAMENTOS),
      });
    }
  }

  // g) Um cancelamento, porque status "cancelada" também precisa existir na
  //    tabela de lavagens (e não conta em nenhum indicador financeiro).
  nova({
    clienteIdx: 6,
    tipoIdx: 4,
    status: 'cancelada',
    valor: precoDe(4),
    data: diasAtras(4, 14, 30),
    user: 'usr-operador',
    pagamento: 'Pendente',
    observacao: 'Cliente desistiu — veículo já estava limpo',
  });

  for (const l of lavagens) {
    await run(
      `INSERT INTO lavagens
        (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [l.id, l.cliente_id, l.veiculo_id, l.tipo_lavagem_id, l.status, l.valor, l.data, l.user_id, l.pagamento, l.observacao, l.data_conclusao],
    );
  }

  /* ----------------------- Movimentações -------------------------- */
  let movSeq = 1;
  const movimentar = async ({ produto, tipo, quantidade, dias, observacao }) => {
    await run(
      'INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        `mov-${String(movSeq++).padStart(4, '0')}`,
        produto.id,
        tipo,
        quantidade,
        observacao,
        'usr-admin',
        iso(diasAtras(dias, 8, movSeq * 3)),
      ],
    );
  };

  // Saídas espalhadas nos últimos 30 dias: é delas que sai o "consumo diário"
  // e, portanto, o Runway (dias restantes) mostrado no dashboard.
  for (const produto of produtos) {
    if (!produto.saida30d) continue;
    const dias = [28, 24, 20, 15, 10, 6, 3, 1];
    const fatias = Math.min(dias.length, Math.max(2, Math.round(produto.saida30d / 4)));
    const porSaida = Math.max(1, Math.round(produto.saida30d / fatias));
    for (let i = 0; i < fatias; i += 1) {
      await movimentar({
        produto,
        tipo: 'saida',
        quantidade: porSaida,
        dias: dias[i],
        observacao: i % 2 === 0 ? 'Consumo do dia' : 'Baixa por uso no atendimento',
      });
    }
  }
  // Entradas recentes: mostram o histórico com os dois tipos de movimento.
  await movimentar({ produto: produtos[3], tipo: 'entrada', quantidade: 20, dias: 9, observacao: 'Compra de fornecedor' });
  await movimentar({ produto: produtos[5], tipo: 'entrada', quantidade: 12, dias: 5, observacao: 'Reposição de estoque' });
  await movimentar({ produto: produtos[7], tipo: 'entrada', quantidade: 6, dias: 2, observacao: 'Reposição de estoque' });
}

/* ------------------------------------------------------------------ */
/* Execução + resumo (prova de que as telas vão ter o que mostrar)     */
/* ------------------------------------------------------------------ */
try {
  await semear();

  const resumo = {
    clientes: (await get('SELECT COUNT(*) c FROM clientes')).c,
    veiculos: (await get('SELECT COUNT(*) c FROM veiculos')).c,
    lavagens: (await get('SELECT COUNT(*) c FROM lavagens')).c,
    lavagens_semana: (await get("SELECT COUNT(*) c FROM lavagens WHERE status = 'concluida' AND data >= datetime('now','-7 days')")).c,
    receita_semana: (await get("SELECT COALESCE(SUM(valor),0) v FROM lavagens WHERE status = 'concluida' AND data >= datetime('now','-7 days')")).v,
    fila_patio: (await get("SELECT COUNT(*) c FROM lavagens WHERE status IN ('pendente','em_progresso')")).c,
    criticos: (await get('SELECT COUNT(*) c FROM produtos WHERE quantidade <= estoque_minimo')).c,
    ausentes: (await get(`
      SELECT COUNT(*) c FROM (
        SELECT c.id FROM clientes c JOIN lavagens l ON l.cliente_id = c.id
        WHERE l.status = 'concluida' GROUP BY c.id
        HAVING CAST(julianday('now') - julianday(MAX(l.data)) AS INTEGER) >= 30
      )`)).c,
    movimentacoes: (await get('SELECT COUNT(*) c FROM movimentacoes')).c,
  };

  console.log(`Banco de demonstração criado em: ${DB_PATH}`);
  console.table(resumo);

  if (resumo.lavagens_semana === 0 || resumo.fila_patio === 0) {
    console.warn('⚠  Semana ou fila vazias — as capturas do dashboard sairiam sem dados.');
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Falha ao gerar o banco de demonstração:', err);
  process.exitCode = 1;
} finally {
  db.close();
}
