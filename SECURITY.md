# Wash Wizard — Política de Segurança (Versão Acadêmica)

> **Versão:** 1.0  
> **Última atualização:** 2026-05-12  
> **Escopo:** Projeto Integrador UNIVESP — Engenharia de Computação

---

## 1. Visão Geral

Este documento descreve a arquitetura de segurança implementada no sistema Wash Wizard. O projeto utiliza uma abordagem de segurança em camadas, combinando proteção no frontend (autenticação HMAC) e no backend (validação de dados), com um banco de dados SQLite local como repositório principal.

### 1.1 Princípios de Segurança

- **Defesa em profundidade:** Múltiplas camadas de proteção
- **Mínimo privilégio:** Usuários têm acesso apenas ao necessário
- **Validação no cliente e servidor:** Dupla validação de inputs
- **Integridade referencial:** Foreign keys no banco de dados

---

## 2. Controle de Acesso (RBAC)

### 2.1 Perfis de Usuário

O sistema implementa controle de acesso baseado em papéis (Role-Based Access Control):

| Perfil | Descrição | Permissões |
|--------|-----------|------------|
| **Admin** | Administrador do sistema | Acesso total a todas as funcionalidades |
| **Operador** | Funcionário operacional | Acesso restrito a funcionalidades do dia-a-dia |

### 2.2 Matriz de Permissões

| Recurso | Admin | Operador |
|---------|:-----:|:--------:|
| Dashboard | ✓ | ✓ |
| Clientes (listar, adicionar, editar) | ✓ | ✓ |
| Lavagens (registrar, visualizar) | ✓ | ✓ |
| Tipos de Lavagem | ✓ | ✗ |
| Estoque | ✓ | ✗ |
| Movimentações | ✓ | ✗ |
| Configurações | ✓ | ✗ |
| Backup/Restore | ✓ | ✗ |

### 2.3 Implementação de RBAC

```typescript
// frontend/src/contexts/AuthContext.tsx
interface AppUser {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'user';
}
```

- O perfil é armazenado na sessão do usuário
- Rotas protegidas verificam o perfil antes de renderizar
- Componentes condicionais mostram/escondem funcionalidades

---

## 3. Segurança de Sessões (HMAC)

### 3.1 Arquitetura

Por ser um projeto acadêmico sem autenticação backendcomplexa, o frontend implementa sessões HMAC-signed:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Usuário   │ →   │  LocalStorage │ →  │  Verificação  │
│   Login     │     │  (Signed)     │     │  HMAC        │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 3.2 Funções de Segurança (`src/utils/security.ts`)

```typescript
// Criação de sessão signed
createSignedUser(user: AppUser): Promise<SignedUser>

// Verificação de integridade
verifySignedUser(signed: SignedUser): Promise<AppUser | null>

// Criptografia de dados
encryptStorage(data: string): Promise<string>
decryptStorage(data: string): Promise<string>

// Sanitização de inputs
sanitizeInput(input: string): string
```

### 3.3 Características de Segurança

- **Assinatura SHA-256:** Qualquer alteração no LocalStorage invalida a sessão
- **Timestamp de expiração:** Sessões expiram após 30 dias
- **Verificação automática:** Ao carregar a página, a integridade é verificada
- **Logout limpo:** Remove sessão e dados do LocalStorage

### 3.4 Validação de Sessão

```typescript
// frontend/src/contexts/AuthContext.tsx
const verifySession = async () => {
  const savedUser = localStorage.getItem('t10_user');
  if (savedUser) {
    const signed = JSON.parse(savedUser) as SignedUser;
    const verified = await verifySignedUser(signed);
    if (verified) {
      const { _signature, _timestamp, ...userData } = verified;
      setAppUser(userData);
    }
  }
};
```

---

## 4. Validação de Entrada

### 4.1 Máscaras de Input

O sistema implementa máscaras automáticas para garantir formatação correta:

**Telefone:** `(XX) XXXXX-XXXX`
```typescript
// frontend/src/hooks/useTelefoneMask.ts
formatTelefone(input) → (XX) XXXXX-XXXX
```

**Placa de Veículo:** Aceita padrões Mercosul e Antigo
```typescript
// frontend/src/hooks/usePlacaMask.ts
// Mercosul: ABC1D23 (7 caracteres)
// Antigo: ABC1234 (8 caracteres)
formatPlaca(input) → Normaliza para formato sem hífen
```

### 4.2 Sanitização XSS

```typescript
// frontend/src/utils/security.ts
sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### 4.3 Validação no Backend

O backend valida todos os inputs recebidos:

```javascript
// backend/server.js
app.post('/api/movimentacoes', async (req, res) => {
  // Validação de estoque
  if (tipo === 'saida' && produto.quantidade < quantidade) {
    return res.status(400).json({ error: 'Estoque insuficiente' });
  }
});
```

---

## 5. Proteção de Dados

### 5.1 Banco de Dados SQLite

O banco `wash_wizard.db` é armazenado localmente e **não é commitado** no versionamento.

**Estrutura de segurança:**
- Integridade referencial ativada: `PRAGMA foreign_keys = ON;`
- Prevenção de registros órfãos
- Transações para operações críticas

### 5.2 Schema de Relacionamentos

```
users (1) ──── (N) clientes (1) ──── (N) veiculos (1) ──── (N) lavagens
  │                                          │
  │                                          │
  └────────────────── (N) produtos (1) ──── (N) movimentacoes
        │
        └──────────── (N) tipos_lavagem
```

### 5.3 Foreign Keys

```sql
-- backend/schema.sql
CREATE TABLE clientes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

---

## 6. Backup e Restore

### 6.1 Exportação CSV

O sistema permite exportar todos os dados em formato CSV:

1.依次导出：users → clientes → veiculos → tipos_lavagem → produtos → lavagens → movimentacoes
2. Arquivos `.csv` por tabela
3. Encoding UTF-8

### 6.2 Importação com Integridade

```javascript
// backend/server.js
app.post('/api/backup/import', async (req, res) => {
  await exec('PRAGMA foreign_keys = OFF;');
  await exec('BEGIN TRANSACTION;');
  try {
    // Limpa tabelas em ordem
    for (const table of tables) {
      await exec(`DELETE FROM ${table};`);
    }
    // Insere dados em ordem de dependência
    await exec('COMMIT;');
  } catch (e) {
    await exec('ROLLBACK;');
    throw e;
  } finally {
    await exec('PRAGMA foreign_keys = ON;');
  }
});
```

### 6.3 Ordem de Dependências

```
1. users (sem dependências)
2. tipos_lavagem (sem dependências)
3. clientes (depende de users)
4. produtos (depende de users)
5. veiculos (depende de clientes)
6. lavagens (depende de clientes, veiculos, tipos_lavagem)
7. movimentacoes (depende de produtos)
```

---

## 7. Segurança da API

### 7.1 Configuração CORS

```javascript
// backend/server.js
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
```

### 7.2 Validação de Inputs

Todos os endpoints validam os inputs recebidos:

```javascript
// Exemplo: POST /api/clientes
app.post('/api/clientes', async (req, res) => {
  try {
    const { user_id, nome, telefone } = req.body;
    if (!nome?.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    // ... inserção
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 7.3 Recomendações para Produção

Para ambientes de produção, recomenda-se:

1. **JWT Authentication:** Substituir HMAC por tokens JWT no backend
2. **HTTPS:** Configurar certificado SSL
3. **Rate Limiting:** Limitar requisições por IP
4. **CORS:** Configurar origens específicas
5. **Logging:** Implementar logs de auditoria
6. **Validação Zod no Backend:** Replicar validações do frontend

---

## 8. Notificações de Segurança

### 8.1 Alertas de Estoque Baixo

O sistema notifica quando produtos atingem estoque mínimo:

```typescript
// frontend/src/pages/Movimentacao.tsx
if (novoEstoque <= estoqueMinimo && tipo === 'saida') {
  toast.warning(`⚠️ Estoque baixo: ${produto?.nome} agora tem ${novoEstoque} ${produto?.unidade}`);
}
```

### 8.2 Toast Notifications

O sistema utiliza `sonner` para feedback visual:
- **Sucesso:** Operações concluídas
- **Erro:** Falhas de validação
- **Aviso:** Alertas de estoque

---

## 9. Limitações e Escopo Acadêmico

### 9.1 Escopo Atual

- Autenticação simulada via HMAC no frontend
- Banco de dados local (SQLite)
- Sem middleware de autenticação no backend

### 9.2 Não Implementado (Produção)

- Autenticação JWT no backend
- HTTPS
- Rate limiting
- Logs de auditoria
- Criptografia de banco de dados
- Two-Factor Authentication (2FA)

### 9.3 Recomendação

Para ambientes de produção, é obrigatória a implementação de:
- Autenticação backend com JWT
- HTTPS com certificado válido
- Validação de inputs no backend (replicar Zod schemas)
- Rate limiting para prevenir ataques

---

## 10. Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SQLite Foreign Keys](https://www.sqlite.org/foreignkeys.html)
- [HMAC - Wikipedia](https://en.wikipedia.org/wiki/HMAC)
- [Node.js Security Best Practices](https://nodejs.dev/learn/nodejs-security-best-practices)

---

*Documento elaborado para o Projeto Integrador UNIVESP - Engenharia de Computação*