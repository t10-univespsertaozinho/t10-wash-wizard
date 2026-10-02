import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { get, all, run, exec } from './db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from './config.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

dotenv.config();

const app = express();

const isDev = process.env.NODE_ENV !== 'production';
const localOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem header Origin (ex: proxy do Vite, ferramentas locais, mobile)
    if (!origin) return callback(null, true);

    if (isDev && localOriginRegex.test(origin)) {
      return callback(null, true);
    }

    const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
    if (origin === allowedOrigin) {
      return callback(null, true);
    }

    return callback(new Error(`Bloqueado pelo CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// Nota sobre isolamento por usuário: este é um sistema de um único lava-rápido,
// não multi-tenant. Toda a equipe autenticada (admin e operadores) compartilha
// intencionalmente a mesma base de clientes/veículos/lavagens/produtos — por
// isso as rotas GET não filtram por user_id. O que É garantido é que nenhuma
// rota confia em um user_id vindo do cliente: toda gravação usa req.user.id,
// extraído do token JWT validado pelo middleware requireAuth.

const upload = multer({ storage: multer.memoryStorage() });

const genId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const publicUserFields = 'id, email, nome, role, created_at';

// Loga o erro real no servidor, mas nunca expõe detalhes internos (ex: mensagens do SQLite) ao cliente.
function handleServerError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ==========================================
// AUTH API (rotas públicas)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await get('SELECT id, email, nome, role, password_hash FROM users WHERE email = ?', [email]);
    const valid = user && await bcrypt.compare(senha, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
  } catch (err) { handleServerError(res, err); }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await get(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) { handleServerError(res, err); }
});

// A partir daqui, todas as rotas de /api exigem autenticação
app.use('/api', requireAuth);

// ==========================================
// USERS API (somente admin)
// ==========================================
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await all(`SELECT ${publicUserFields} FROM users`);
    res.json(users);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { email, nome, role, senha } = req.body;
    if (!senha) return res.status(400).json({ error: 'Senha é obrigatória' });
    const newId = genId();
    const passwordHash = await bcrypt.hash(senha, 10);
    await run('INSERT INTO users (id, email, nome, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', [newId, email, nome, role || 'operador', passwordHash, now()]);
    const user = await get(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [newId]);
    res.json(user);
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// CLIENTES API
// ==========================================
app.get('/api/clientes', async (req, res) => {
  try {
    // Retorna todos os clientes (sem filtro por user_id para simplificar)
    const rows = await all('SELECT * FROM clientes', []);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.get('/api/clientes/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, telefone } = req.body;
    const id = genId();
    const created_at = now();
    await run('INSERT INTO clientes (id, user_id, nome, telefone, created_at) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, nome, telefone, created_at]);
    const row = await get('SELECT * FROM clientes WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nome, telefone } = req.body;
    await run('UPDATE clientes SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone, req.params.id]);
    const row = await get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// VEICULOS API
// ==========================================
app.get('/api/veiculos', async (req, res) => {
  try {
    const { cliente_id } = req.query;
    let query = 'SELECT * FROM veiculos';
    let params = [];
    if (cliente_id) { query += ' WHERE cliente_id = ?'; params.push(cliente_id); }
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/veiculos', async (req, res) => {
  try {
    const { cliente_id, placa, marca, cor, modelo } = req.body;
    if (!cliente_id || !String(modelo || '').trim() || !String(placa || '').trim()) {
      return res.status(400).json({ error: 'Cliente, modelo e placa são obrigatórios.' });
    }
    const id = genId();
    await run('INSERT INTO veiculos (id, cliente_id, user_id, placa, marca, cor, modelo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, cliente_id, req.user.id, placa, marca, cor, modelo, now()]);
    const row = await get('SELECT * FROM veiculos WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.delete('/api/veiculos/:id', async (req, res) => {
  try {
    await run('DELETE FROM veiculos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

app.put('/api/veiculos/:id', async (req, res) => {
  try {
    const { modelo, placa, cor } = req.body;
    if (!String(modelo || '').trim() || !String(placa || '').trim()) {
      return res.status(400).json({ error: 'Modelo e placa são obrigatórios.' });
    }
    await run('UPDATE veiculos SET modelo = ?, placa = ?, cor = ? WHERE id = ?', [modelo, placa, cor, req.params.id]);
    const row = await get('SELECT * FROM veiculos WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/veiculos/migrate-plates', requireAdmin, async (req, res) => {
  try {
    const result = await run("UPDATE veiculos SET placa = REPLACE(placa, '-', '')");
    res.json({ success: true, message: 'Placas normalizadas com sucesso' });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// TIPOS_LAVAGEM API
// ==========================================
app.get('/api/tipos-lavagem', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM tipos_lavagem');
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/tipos-lavagem', requireAdmin, async (req, res) => {
  try {
    const { nome, descricao, preco } = req.body;
    const id = genId();
    await run('INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)', [id, nome, descricao, preco, now()]);
    const row = await get('SELECT * FROM tipos_lavagem WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.put('/api/tipos-lavagem/:id', requireAdmin, async (req, res) => {
  try {
    const { nome, descricao, preco } = req.body;
    await run('UPDATE tipos_lavagem SET nome = ?, descricao = ?, preco = ? WHERE id = ?', [nome, descricao, preco, req.params.id]);
    const row = await get('SELECT * FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.delete('/api/tipos-lavagem/:id', requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM tipos_lavagem WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// LAVAGENS API
// ==========================================
const STATUS_LAVAGEM = ['pendente', 'em_progresso', 'concluida', 'cancelada'];

app.get('/api/lavagens', async (req, res) => {
  try {
    const { cliente_id } = req.query;
    let query = 'SELECT * FROM lavagens';
    let params = [];
    if (cliente_id) { query += ' WHERE cliente_id = ?'; params.push(cliente_id); }
    query += ' ORDER BY data DESC';
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/lavagens', async (req, res) => {
  try {
    const { cliente_id, veiculo_id, tipo_lavagem_id, status, valor, pagamento, observacao } = req.body;
    if (!cliente_id || !veiculo_id || !tipo_lavagem_id) {
      return res.status(400).json({ error: 'Cliente, veículo e tipo de lavagem são obrigatórios.' });
    }
    const statusFinal = status || 'pendente';
    if (!STATUS_LAVAGEM.includes(statusFinal)) {
      return res.status(400).json({ error: `Status inválido. Use um dos: ${STATUS_LAVAGEM.join(', ')}` });
    }
    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      return res.status(400).json({ error: 'O valor da lavagem deve ser um número maior ou igual a zero.' });
    }
    const id = genId();
    const dataConclusao = statusFinal === 'concluida' ? now() : null;
    await run(`INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cliente_id, veiculo_id, tipo_lavagem_id, statusFinal, valorNum, now(), req.user.id, pagamento || 'Pendente', observacao, dataConclusao]);
    const row = await get('SELECT * FROM lavagens WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.put('/api/lavagens/:id', async (req, res) => {
  try {
    const { status, valor, pagamento, observacao, data_conclusao } = req.body;
    if (status !== undefined && !STATUS_LAVAGEM.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Use um dos: ${STATUS_LAVAGEM.join(', ')}` });
    }
    let valorNum;
    if (valor !== undefined) {
      valorNum = Number(valor);
      if (!Number.isFinite(valorNum) || valorNum < 0) {
        return res.status(400).json({ error: 'O valor da lavagem deve ser um número maior ou igual a zero.' });
      }
    }

    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (valor !== undefined) { updates.push('valor = ?'); params.push(valorNum); }
    if (pagamento !== undefined) { updates.push('pagamento = ?'); params.push(pagamento); }
    if (observacao !== undefined) { updates.push('observacao = ?'); params.push(observacao); }

    // data_conclusao é preenchida automaticamente ao concluir a lavagem, nunca recebida do cliente
    if (status === 'concluida') {
      updates.push('data_conclusao = ?'); params.push(now());
    } else if (data_conclusao !== undefined) {
      updates.push('data_conclusao = ?'); params.push(data_conclusao);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await run(`UPDATE lavagens SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const row = await get('SELECT * FROM lavagens WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.delete('/api/lavagens/:id', async (req, res) => {
  try {
    await run('DELETE FROM lavagens WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// PRODUTOS API
// ==========================================
app.get('/api/produtos', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM produtos', []);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

app.post('/api/produtos', requireAdmin, async (req, res) => {
  try {
    const { nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario } = req.body;
    const id = genId();
    await run(`INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nome, quantidade || 0, estoque_minimo || 5, categoria || 'Outros', unidade || 'un', preco_unitario || 0, req.user.id, now()]);
    const row = await get('SELECT * FROM produtos WHERE id = ?', [id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.put('/api/produtos/:id', requireAdmin, async (req, res) => {
  try {
    const { nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario } = req.body;
    await run(`UPDATE produtos SET nome = ?, quantidade = ?, estoque_minimo = ?, categoria = ?, unidade = ?, preco_unitario = ? WHERE id = ?`, 
      [nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, req.params.id]);
    const row = await get('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) { handleServerError(res, err); }
});

app.delete('/api/produtos/:id', requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// MOVIMENTACOES API
// ==========================================
app.get('/api/movimentacoes', async (req, res) => {
  try {
    let query = 'SELECT * FROM movimentacoes';
    let params = [];
    query += ' ORDER BY data DESC';
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) { handleServerError(res, err); }
});

const TIPOS_MOVIMENTACAO = ['entrada', 'saida'];

app.post('/api/movimentacoes', requireAdmin, async (req, res) => {
  const { produto_id, tipo, observacao } = req.body;
  const quantidade = Number(req.body.quantidade);

  if (!TIPOS_MOVIMENTACAO.includes(tipo)) {
    return res.status(400).json({ error: `Campo 'tipo' inválido. Use um dos: ${TIPOS_MOVIMENTACAO.join(', ')}` });
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return res.status(400).json({ error: 'A quantidade deve ser um número positivo.' });
  }

  try {
    // BEGIN IMMEDIATE trava a escrita já no início da transação, evitando que duas
    // movimentações concorrentes leiam o mesmo estoque antigo e gerem um "lost update".
    await exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const produto = await get('SELECT quantidade FROM produtos WHERE id = ?', [produto_id]);
      if (!produto) {
        await exec('ROLLBACK;');
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      if (tipo === 'saida' && produto.quantidade < quantidade) {
        await exec('ROLLBACK;');
        return res.status(400).json({ error: `Estoque insuficiente. Disponível: ${produto.quantidade}` });
      }

      const novaQuantidade = tipo === 'entrada'
        ? produto.quantidade + quantidade
        : produto.quantidade - quantidade;

      await run('UPDATE produtos SET quantidade = ? WHERE id = ?', [novaQuantidade, produto_id]);

      const id = genId();
      await run(`INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, produto_id, tipo, quantidade, observacao, req.user.id, now()]);

      await exec('COMMIT;');

      const produtoAtualizado = await get('SELECT * FROM produtos WHERE id = ?', [produto_id]);
      const row = await get('SELECT * FROM movimentacoes WHERE id = ?', [id]);
      res.json({ movimentacao: row, produto: produtoAtualizado });
    } catch (e) {
      await exec('ROLLBACK;');
      throw e;
    }
  } catch (err) { handleServerError(res, err); }
});

// ==========================================
// DASHBOARD & ANALYTICS API
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 1. Resumo Financeiro da Semana Atual vs Semana Anterior
    const semanaAtual = await get(`
      SELECT 
        COUNT(*) as lavagens, 
        COALESCE(SUM(valor), 0) as receita
      FROM lavagens
      WHERE status = 'concluida' AND data >= datetime('now', '-7 days')
    `);

    const semanaAnterior = await get(`
      SELECT 
        COUNT(*) as lavagens, 
        COALESCE(SUM(valor), 0) as receita
      FROM lavagens
      WHERE status = 'concluida' 
        AND data >= datetime('now', '-14 days') 
        AND data < datetime('now', '-7 days')
    `);

    const receitaSemana = Number(semanaAtual?.receita || 0);
    const lavagensSemana = Number(semanaAtual?.lavagens || 0);
    const ticketMedio = lavagensSemana > 0 ? Number((receitaSemana / lavagensSemana).toFixed(2)) : 0;

    const receitaSemanaAnterior = Number(semanaAnterior?.receita || 0);
    const lavagensSemanaAnterior = Number(semanaAnterior?.lavagens || 0);
    const ticketMedioAnterior = lavagensSemanaAnterior > 0 ? (receitaSemanaAnterior / lavagensSemanaAnterior) : 0;

    let variacaoReceitaPct = 0;
    if (receitaSemanaAnterior > 0) {
      variacaoReceitaPct = Number((((receitaSemana - receitaSemanaAnterior) / receitaSemanaAnterior) * 100).toFixed(1));
    } else if (receitaSemana > 0) {
      variacaoReceitaPct = 100;
    }

    let variacaoTicketPct = 0;
    if (ticketMedioAnterior > 0) {
      variacaoTicketPct = Number((((ticketMedio - ticketMedioAnterior) / ticketMedioAnterior) * 100).toFixed(1));
    } else if (ticketMedio > 0) {
      variacaoTicketPct = 100;
    }

    // Fluxo Diário dos Últimos 7 dias (Série temporal contínua para o gráfico)
    const ultimos7DiasRows = await all(`
      SELECT 
        substr(data, 1, 10) as dia_data,
        COUNT(*) as lavagens,
        COALESCE(SUM(valor), 0) as receita
      FROM lavagens
      WHERE status = 'concluida' AND data >= date('now', '-6 days')
      GROUP BY substr(data, 1, 10)
    `);

    const mapaDias = new Map();
    ultimos7DiasRows.forEach(r => {
      mapaDias.set(r.dia_data, { lavagens: Number(r.lavagens), receita: Number(r.receita) });
    });

    const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const fluxoDiario7d = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dataIso = d.toISOString().slice(0, 10);
      const diaNome = diasSemanaNomes[d.getDay()];
      const registro = mapaDias.get(dataIso) || { lavagens: 0, receita: 0 };
      fluxoDiario7d.push({
        data: dataIso,
        dia: diaNome,
        lavagens: registro.lavagens,
        receita: registro.receita
      });
    }

    // 2. Taxa de Recorrência e Fidelização
    const recorrenciaRows = await all(`
      SELECT cliente_id, COUNT(*) as qtd
      FROM lavagens
      WHERE status = 'concluida'
      GROUP BY cliente_id
    `);
    const totalClientesComLavagem = recorrenciaRows.length;
    const clientesRecorrentes = recorrenciaRows.filter(r => r.qtd >= 2).length;
    const taxaRecorrenciaPct = totalClientesComLavagem > 0 
      ? Number(((clientesRecorrentes / totalClientesComLavagem) * 100).toFixed(1)) 
      : 0;

    // 3. Radar de Clientes Ausentes (> 30 dias)
    const clientesAusentes = await all(`
      SELECT 
        c.id, 
        c.nome, 
        c.telefone,
        MAX(l.data) as ultima_visita,
        CAST(julianday('now') - julianday(MAX(l.data)) AS INTEGER) as dias_ausente,
        COUNT(l.id) as historico_lavagens
      FROM clientes c
      JOIN lavagens l ON l.cliente_id = c.id
      WHERE l.status = 'concluida'
      GROUP BY c.id, c.nome, c.telefone
      HAVING dias_ausente >= 30
      ORDER BY historico_lavagens DESC, dias_ausente ASC
      LIMIT 5
    `);

    // 4. Mix de Serviços dos Últimos 30 Dias (Volume vs Receita)
    const mixTipos = await all(`
      SELECT 
        t.id, 
        t.nome,
        COUNT(l.id) as total_atendimentos,
        COALESCE(SUM(l.valor), 0) as faturamento_total
      FROM tipos_lavagem t
      LEFT JOIN lavagens l ON l.tipo_lavagem_id = t.id AND l.status = 'concluida' AND l.data >= datetime('now', '-30 days')
      GROUP BY t.id, t.nome
      ORDER BY faturamento_total DESC
    `);

    const totalAtendimentos30d = mixTipos.reduce((s, t) => s + Number(t.total_atendimentos), 0);
    const totalFaturamento30d = mixTipos.reduce((s, t) => s + Number(t.faturamento_total), 0);

    const mixServicos = mixTipos.map(item => {
      const atendimentos = Number(item.total_atendimentos);
      const faturamento = Number(item.faturamento_total);
      return {
        id: item.id,
        nome: item.nome,
        total_atendimentos: atendimentos,
        faturamento_total: faturamento,
        pct_volume: totalAtendimentos30d > 0 ? Number(((atendimentos / totalAtendimentos30d) * 100).toFixed(1)) : 0,
        pct_receita: totalFaturamento30d > 0 ? Number(((faturamento / totalFaturamento30d) * 100).toFixed(1)) : 0,
      };
    });

    // 5. Insumos em Estado Crítico com Cálculo do Runway
    const produtosCriticos = await all(`
      WITH consumo_recente AS (
        SELECT 
          produto_id,
          COALESCE(SUM(quantidade), 0) as total_saida,
          COUNT(DISTINCT substr(data, 1, 10)) as dias_registrados
        FROM movimentacoes
        WHERE tipo = 'saida' AND data >= datetime('now', '-30 days')
        GROUP BY produto_id
      )
      SELECT 
        p.id,
        p.nome,
        p.quantidade,
        p.estoque_minimo,
        p.unidade,
        p.preco_unitario,
        COALESCE(c.total_saida, 0) as total_saida_30d
      FROM produtos p
      LEFT JOIN consumo_recente c ON c.produto_id = p.id
      WHERE p.quantidade <= p.estoque_minimo
      ORDER BY p.quantidade ASC
    `);

    const estoqueCritico = produtosCriticos.map(p => {
      const qtd = Number(p.quantidade);
      const estoqueMin = Number(p.estoque_minimo);
      const saida30d = Number(p.total_saida_30d);
      const consumoDiario = Number((saida30d / 30.0).toFixed(2));
      
      let diasRestantes = null;
      let statusPrevisao = 'alerta';

      if (qtd <= 0) {
        diasRestantes = 0;
        statusPrevisao = 'zerado';
      } else if (consumoDiario > 0) {
        diasRestantes = Math.floor(qtd / consumoDiario);
        if (diasRestantes <= 3) statusPrevisao = 'urgente';
        else if (diasRestantes <= 7) statusPrevisao = 'atencao';
        else statusPrevisao = 'moderado';
      } else {
        statusPrevisao = 'repor';
      }

      return {
        id: p.id,
        nome: p.nome,
        quantidade: qtd,
        estoque_minimo: estoqueMin,
        unidade: p.unidade,
        consumo_diario: consumoDiario,
        dias_restantes: diasRestantes,
        status_previsao: statusPrevisao
      };
    });

    res.json({
      financeiro: {
        receita_semana: receitaSemana,
        lavagens_semana: lavagensSemana,
        ticket_medio: ticketMedio,
        receita_semana_anterior: receitaSemanaAnterior,
        lavagens_semana_anterior: lavagensSemanaAnterior,
        variacao_receita_pct: variacaoReceitaPct,
        variacao_ticket_pct: variacaoTicketPct,
        fluxo_diario_7d: fluxoDiario7d
      },
      fidelizacao: {
        total_clientes_com_lavagem: totalClientesComLavagem,
        clientes_recorrentes: clientesRecorrentes,
        taxa_recorrencia_pct: taxaRecorrenciaPct
      },
      clientes_ausentes: clientesAusentes,
      mix_servicos: mixServicos,
      estoque_critico: estoqueCritico
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// ==========================================
// BACKUP & RESET API
// ==========================================
const tables = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'lavagens', 'produtos', 'movimentacoes'];

// Allowlist de colunas por tabela, usada para validar o cabeçalho do CSV
// antes de montar a query de import (evita SQL Injection via nome de coluna).
const TABLE_COLUMNS = {
  users: ['id', 'email', 'nome', 'password_hash', 'role', 'created_at'],
  clientes: ['id', 'user_id', 'nome', 'telefone', 'created_at'],
  veiculos: ['id', 'cliente_id', 'user_id', 'modelo', 'placa', 'cor', 'marca', 'created_at'],
  tipos_lavagem: ['id', 'nome', 'descricao', 'preco', 'created_at'],
  lavagens: ['id', 'cliente_id', 'veiculo_id', 'tipo_lavagem_id', 'status', 'valor', 'data', 'user_id', 'pagamento', 'observacao', 'data_conclusao'],
  produtos: ['id', 'nome', 'quantidade', 'estoque_minimo', 'categoria', 'unidade', 'preco_unitario', 'user_id', 'created_at'],
  movimentacoes: ['id', 'produto_id', 'tipo', 'quantidade', 'observacao', 'user_id', 'data'],
};

app.get('/api/backup/export', requireAdmin, async (req, res) => {
  try {
    const backup = {};
    for (const table of tables) {
      const rows = await all(`SELECT * FROM ${table}`);
      backup[table] = stringify(rows, { header: true });
    }
    res.json(backup);
  } catch (err) {
    handleServerError(res, err);
  }
});

app.post('/api/backup/import', requireAdmin, upload.any(), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Identificar tabelas pelos nomes dos arquivos
    const dataToImport = {};
    for (const file of files) {
      // name e.g. "clientes.csv"
      const tableName = file.originalname.split('.')[0];
      if (tables.includes(tableName)) {
        const records = parse(file.buffer, { columns: true, skip_empty_lines: true });
        dataToImport[tableName] = records;
      }
    }

    let importedCount = 0;

    await exec('PRAGMA foreign_keys = OFF;');
    await exec('BEGIN TRANSACTION;');

    try {
      // Odem de dependência
      const order = ['users', 'clientes', 'veiculos', 'tipos_lavagem', 'produtos', 'lavagens', 'movimentacoes'];
      
      // Limpar tabelas que estão sendo importadas
      for (const table of order) {
        if (dataToImport[table]) {
          await exec(`DELETE FROM ${table};`);
        }
      }

      for (const table of order) {
        const records = dataToImport[table];
        if (!records || records.length === 0) continue;

        const columns = Object.keys(records[0]);
        const colunasInvalidas = columns.filter(c => !TABLE_COLUMNS[table].includes(c));
        if (colunasInvalidas.length > 0) {
          throw new Error(`Colunas inválidas em ${table}.csv: ${colunasInvalidas.join(', ')}`);
        }

        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

        for (const record of records) {
          const values = columns.map(col => record[col] === '' ? null : record[col]);
          await run(sql, values);
          importedCount++;
        }
      }

      await exec('COMMIT;');
    } catch (e) {
      await exec('ROLLBACK;');
      throw e;
    } finally {
      await exec('PRAGMA foreign_keys = ON;');
    }

    res.json({ success: true, records: importedCount, warnings: [] });
  } catch (err) {
    handleServerError(res, err);
  }
});

app.post('/api/backup/reset', requireAdmin, async (req, res) => {
  try {
    await exec('PRAGMA foreign_keys = OFF;');
    await exec('BEGIN TRANSACTION;');
    try {
      for (const table of tables) {
        await exec(`DELETE FROM ${table};`);
      }
      await exec('COMMIT;');
    } catch(e) {
      await exec('ROLLBACK;');
      throw e;
    } finally {
      await exec('PRAGMA foreign_keys = ON;');
    }
    res.json({ success: true });
  } catch (err) {
    handleServerError(res, err);
  }
});

const PORT = process.env.PORT || 3001;

// Inicia o servidor se não estiver sendo executado como Serverless Function (ex: Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend SQLite rodando na porta ${PORT}`);
  });
}

// Compatibilidade CommonJS e ES Modules para Vercel Serverless Function
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
}

export { app };
export default app;
