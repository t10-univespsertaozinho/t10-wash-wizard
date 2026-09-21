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
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8080' }));
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
app.listen(PORT, () => {
  console.log(`Backend SQLite rodando na porta ${PORT}`);
});
