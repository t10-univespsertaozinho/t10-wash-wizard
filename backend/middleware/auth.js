import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_ALGORITHM } from '../config.js';
import { get } from '../db.js';

// O token carrega `role` e vale até 8h. Revalidar o usuário no banco a cada
// requisição faz com que remoção de cadastro ou rebaixamento de perfil tenham
// efeito imediato, em vez de esperar o token expirar (FA-06).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente' });
  }

  let payload;
  try {
    // algorithms explícito: rejeita alg "none" e fecha a classe de ataques de
    // confusão de algoritmo caso o projeto migre para chaves assimétricas.
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      clockTolerance: 5,
    });
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  try {
    const atual = await get('SELECT id, role FROM users WHERE id = ?', [payload.id]);
    if (!atual) {
      return res.status(401).json({ error: 'Usuário não encontrado ou removido' });
    }
    if (atual.role !== payload.role) {
      // Perfil mudou depois do login: o token não reflete mais a autorização
      // real e precisa ser trocado por um novo.
      return res.status(401).json({ error: 'Perfil alterado. Faça login novamente.' });
    }

    req.user = { ...payload, role: atual.role };
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// O banco é a autoridade final sobre o perfil. Usado tanto pelo middleware de
// rota quanto por handlers que só restringem parte da operação (ex.: alterar
// valor/pagamento de uma lavagem).
export async function ehAdmin(req) {
  const atual = await get('SELECT role FROM users WHERE id = ?', [req.user?.id]);
  return atual?.role === 'admin';
}

export async function requireAdmin(req, res, next) {
  try {
    const atual = await get('SELECT role FROM users WHERE id = ?', [req.user?.id]);

    if (!atual) {
      return res.status(401).json({ error: 'Usuário não encontrado ou removido' });
    }
    if (atual.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }

    req.user.role = atual.role;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
