import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_ALGORITHM } from '../config.js';
import { get } from '../db.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente' });
  }

  try {
    // algorithms explícito: rejeita alg "none" e fecha a classe de ataques de
    // confusão de algoritmo caso o projeto migre para chaves assimétricas.
    req.user = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      clockTolerance: 5,
    });
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// O claim `role` do token reflete o estado do login, que pode ter até 8h de
// idade. Para operações administrativas o banco é a autoridade final: confirma
// que o usuário ainda existe e ainda é admin, de forma que uma remoção ou um
// rebaixamento de perfil tenha efeito imediato em vez de esperar o token expirar.
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
