# Wash Wizard — Política de Segurança

> **Versão:** 2.0
> **Última atualização:** 2026-09-21
> **Escopo:** Projeto Integrador UNIVESP — Engenharia de Computação

---

## 1. Visão Geral

Este documento descreve a arquitetura de segurança implementada no sistema Wash Wizard. O backend (Node.js/Express) é a fronteira de confiança: toda autenticação, autorização e validação de dados é aplicada e reforçada ali — o frontend é tratado como não confiável, nunca como a única linha de defesa.

### 1.1 Princípios de Segurança

- **Defesa em profundidade:** múltiplas camadas de proteção (autenticação, autorização, validação de entrada, sanitização de erros)
- **Mínimo privilégio:** usuários têm acesso apenas ao necessário para seu papel
- **Validação no cliente e no servidor:** o frontend valida por UX, mas o backend é quem decide — nenhuma validação de negócio depende só do cliente
- **Integridade referencial:** foreign keys no banco de dados

---

## 2. Autenticação (JWT)

### 2.1 Arquitetura

O backend emite e valida os tokens de sessão — não há autenticação simulada no cliente.

```
┌──────────┐   POST /api/auth/login    ┌─────────────┐   token JWT   ┌──────────┐
│ Frontend │ ───(email, senha)───────> │   Backend   │ ─────────────>│ Frontend │
└──────────┘                           │ (bcrypt +   │               └──────────┘
                                        │  JWT sign)  │                    │
                                        └─────────────┘                    │
                                                                            v
                                                            Authorization: Bearer <token>
                                                            em toda chamada subsequente
```

- **Login:** `POST /api/auth/login` recebe `{ email, senha }`, busca o usuário pelo e-mail e compara a senha com `password_hash` (bcrypt) armazenado em `users`. Se válido, assina um JWT (`jsonwebtoken`) contendo `{ id, email, role }`.
- **Expiração:** o token expira em 8 horas (`JWT_EXPIRES_IN` em `backend/config.js`).
- **Segredo:** `JWT_SECRET` vem de `backend/.env`. Se não for definido, o servidor gera um segredo aleatório a cada inicialização (com aviso no console) — funcional para desenvolvimento local, mas **`JWT_SECRET` deve ser definido explicitamente em qualquer ambiente que precise manter sessões entre reinicializações do servidor**.
- **Sessão no frontend:** o token é guardado em `localStorage` (`t10_token`). Ao carregar a aplicação, o frontend chama `GET /api/auth/me` com o token salvo para revalidar a sessão no servidor antes de considerar o usuário autenticado — não confia apenas no que está salvo localmente.
- **Logout:** remove o token do `localStorage`. Não há invalidação de token no servidor (JWT é stateless); a expiração de 8h é o limite superior de uma sessão comprometida.

### 2.2 Middleware de Autenticação e Autorização

Implementado em `backend/middleware/auth.js`:

```javascript
requireAuth(req, res, next)   // Exige um JWT válido no header Authorization; popula req.user
requireAdmin(req, res, next)  // Exige req.user.role === 'admin' (usado após requireAuth)
```

`requireAuth` é aplicado a **todas** as rotas de `/api/*`, exceto `POST /api/auth/login` (rota de login, necessariamente pública). `requireAdmin` é aplicado individualmente às rotas administrativas (ver matriz na seção 3).

Toda gravação no banco usa `req.user.id` (extraído do token validado) para o campo `user_id` — nenhuma rota confia em um `user_id` enviado no corpo da requisição, o que impediria um usuário autenticado de forjar ações em nome de outro.

---

## 3. Controle de Acesso (RBAC)

### 3.1 Perfis de Usuário

| Perfil | Descrição | Permissões |
|--------|-----------|------------|
| **admin** | Administrador do sistema | Acesso total a todas as funcionalidades |
| **operador** | Funcionário operacional | Acesso restrito às funcionalidades do dia-a-dia |

```typescript
// frontend/src/contexts/AuthContext.tsx
export type UserRole = 'admin' | 'operador';
export interface AppUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}
```

### 3.2 Matriz de Permissões

O controle é reforçado **nas duas pontas**: o frontend esconde/bloqueia rotas por papel (`ProtectedRoute adminOnly` em `App.tsx`), e o backend aplica `requireAdmin` nos mesmos endpoints — um usuário `operador` não consegue contornar a restrição chamando a API diretamente.

| Recurso | Rota(s) da API | admin | operador |
|---------|-----------------|:-----:|:--------:|
| Dashboard, Clientes, Veículos, Lavagens (listar/criar/editar/excluir) | `/api/clientes*`, `/api/veiculos*`, `/api/lavagens*` | ✓ | ✓ |
| Tipos de Lavagem (criar/editar/excluir) — leitura é liberada para todos | `POST/PUT/DELETE /api/tipos-lavagem*` | ✓ | ✗ |
| Estoque (produtos) — leitura é liberada para todos | `POST/PUT/DELETE /api/produtos*` | ✓ | ✗ |
| Movimentações de estoque | `POST /api/movimentacoes` | ✓ | ✗ |
| Normalização de placas | `POST /api/veiculos/migrate-plates` | ✓ | ✗ |
| Gestão de usuários | `GET/POST /api/users` | ✓ | ✗ |
| Backup/Restore | `/api/backup/export`, `/api/backup/import`, `/api/backup/reset` | ✓ | ✗ |

> Nota de escopo: este é um sistema de um único lava-rápido, não multi-tenant — toda a equipe autenticada compartilha intencionalmente a mesma base de clientes/veículos/lavagens/produtos. RBAC aqui controla **o que cada papel pode fazer**, não isolamento de dados por usuário.

---

## 4. Segurança de Rede (CORS)

```javascript
// backend/server.js
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8080' }));
```

O backend aceita requisições apenas da origem configurada em `FRONTEND_URL` (`backend/.env`). Nenhuma outra origem recebe os headers `Access-Control-Allow-Origin` necessários para que um navegador libere a leitura da resposta — isso impede que uma página maliciosa hospedada em outro domínio use o token de um usuário logado para chamar a API em nome dele (CSRF via fetch/XHR).

---

## 5. Validação de Entrada

### 5.1 Backend (autoridade final)

O backend valida e rejeita entradas inválidas com `400` antes de tocar no banco, em vez de deixar a constraint do SQLite estourar como erro genérico:

| Recurso | Validações aplicadas |
|---|---|
| Veículos | `cliente_id`, `modelo` e `placa` obrigatórios e não vazios |
| Lavagens | `cliente_id`, `veiculo_id`, `tipo_lavagem_id` obrigatórios; `status` restrito ao enum (`pendente`, `em_progresso`, `concluida`, `cancelada`); `valor` numérico e ≥ 0 |
| Movimentações de estoque | `tipo` restrito a `entrada`/`saida`; `quantidade` numérica e > 0; saída bloqueada se maior que o estoque disponível |
| Import de backup (CSV) | Nome de cada coluna do cabeçalho validado contra uma allowlist por tabela antes de compor a query `INSERT` (ver seção 7.2) |

`data_conclusao` de uma lavagem nunca é aceita do cliente — é preenchida automaticamente pelo servidor no momento em que o `status` muda para `concluida`.

### 5.2 Máscaras de Input (Frontend)

**Telefone:** `(XX) XXXXX-XXXX` — `frontend/src/hooks/useTelefoneMask.ts`
**Placa de Veículo:** aceita padrões Mercosul (`ABC1D23`) e Antigo (`ABC1234`) — `frontend/src/hooks/usePlacaMask.ts`

### 5.3 Sanitização XSS

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

---

## 6. Proteção de Dados

### 6.1 Senhas

Senhas nunca são armazenadas em texto plano. `users.password_hash` guarda o hash gerado por `bcryptjs` (fator de custo 10). A rota `GET /api/users` seleciona explicitamente as colunas públicas (nunca `SELECT *`), garantindo que o hash jamais é incluído em uma resposta da API.

### 6.2 Banco de Dados SQLite

O banco `wash_wizard.db` é armazenado localmente e **não é commitado** no versionamento (`.gitignore`). O schema (`backend/schema.sql`), por outro lado, **é versionado** — é a definição de código do banco, necessária para inicializar um ambiente do zero.

**Estrutura de segurança:**
- Integridade referencial ativada: `PRAGMA foreign_keys = ON;`
- Prevenção de registros órfãos
- `CHECK` constraints no schema para enums (`status`, `role`, `tipo`) e valores não-negativos (`valor`, `quantidade`, `preco`)
- Transações para operações críticas (ver seção 6.3)

### 6.3 Transações e Condições de Corrida

A movimentação de estoque (`POST /api/movimentacoes`) envolve ler o estoque atual, calcular o novo valor e gravar — uma sequência clássica sujeita a *lost update* se duas requisições concorrentes lerem o mesmo valor antes de qualquer uma escrever. Essa rota executa a leitura, a atualização do produto e a inserção da movimentação dentro de uma única transação `BEGIN IMMEDIATE`, que trava a escrita já no início, serializando movimentações concorrentes sobre o mesmo produto.

### 6.4 Schema de Relacionamentos

```
users (1) ──── (N) clientes (1) ──── (N) veiculos (1) ──── (N) lavagens
  │                                          │
  │                                          │
  └────────────────── (N) produtos (1) ──── (N) movimentacoes
        │
        └──────────── (N) tipos_lavagem
```

---

## 7. Backup e Restore

### 7.1 Exportação CSV

`GET /api/backup/export` (admin) exporta todas as tabelas em CSV, na ordem `users → clientes → veiculos → tipos_lavagem → produtos → lavagens → movimentacoes`, encoding UTF-8.

### 7.2 Importação com Integridade e Prevenção de SQL Injection

```javascript
// backend/server.js
const TABLE_COLUMNS = {
  clientes: ['id', 'user_id', 'nome', 'telefone', 'created_at'],
  // ...allowlist por tabela...
};

app.post('/api/backup/import', requireAdmin, upload.any(), async (req, res) => {
  // ...
  const columns = Object.keys(records[0]);
  const colunasInvalidas = columns.filter(c => !TABLE_COLUMNS[table].includes(c));
  if (colunasInvalidas.length > 0) {
    throw new Error(`Colunas inválidas em ${table}.csv: ${colunasInvalidas.join(', ')}`);
  }
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  // ...
});
```

O nome das colunas do CSV importado **não pode** ser passado para valores parametrizados (`?`) do SQLite, pois nomes de coluna fazem parte da estrutura da query, não de seus valores — por isso, antes deste controle, um cabeçalho de CSV malicioso (ex: `telefone); DROP TABLE clientes;--`) seria concatenado diretamente na query `INSERT`. Cada coluna do cabeçalho é validada contra uma allowlist fixa por tabela antes de montar a query; qualquer coluna fora da lista rejeita o import inteiro e reverte a transação (`ROLLBACK`), sem tocar o banco.

A rota inteira exige `requireAdmin` — importar ou resetar o banco não é uma operação de usuário comum.

### 7.3 Ordem de Dependências

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

## 8. Sanitização de Erros

Nenhuma resposta de erro (`500`) expõe a mensagem interna do driver SQLite ao cliente:

```javascript
// backend/server.js
function handleServerError(res, err) {
  console.error(err);                                     // detalhe completo só no log do servidor
  res.status(500).json({ error: 'Erro interno do servidor' }); // mensagem genérica ao cliente
}
```

Isso evita vazar detalhes de schema, nomes de tabela/coluna ou stack traces que ajudariam um atacante a mapear a estrutura do banco a partir de respostas de erro.

---

## 9. Notificações de Segurança (Aplicação)

### 9.1 Alertas de Estoque Baixo

```typescript
// frontend/src/pages/Movimentacao.tsx
if (novoEstoque <= estoqueMinimo && tipo === 'saida') {
  toast.warning(`⚠️ Estoque baixo: ${produto?.nome} agora tem ${novoEstoque} ${produto?.unidade}`);
}
```

### 9.2 Toast Notifications

O sistema utiliza `sonner` para feedback visual de sucesso, erro e alertas de estoque.

---

## 10. Limitações Conhecidas e Fora de Escopo

Este é um sistema de porte acadêmico com um backend real de autenticação/autorização — as limitações abaixo são deliberadas para este escopo, não lacunas de segurança não tratadas:

- **HTTPS:** não configurado neste repositório; é responsabilidade do ambiente de deploy (reverse proxy com TLS).
- **Rate limiting:** não implementado — não há proteção contra força bruta no login além do custo do bcrypt.
- **Logs de auditoria:** erros são logados no console do servidor, mas não há trilha de auditoria estruturada (quem fez o quê, quando).
- **Revogação de token:** JWT é stateless; não há lista de revogação — um token comprometido permanece válido até expirar (8h) ou até o `JWT_SECRET` ser rotacionado.
- **Two-Factor Authentication (2FA):** não implementado.
- **Isolamento multi-tenant:** não existe — é uma decisão de produto (loja única), não uma limitação técnica pendente.

### 10.1 Recomendação para um ambiente de produção real

Se este sistema saísse do escopo acadêmico para produção real, o próximo investimento de segurança deveria ser, nesta ordem: HTTPS obrigatório, rate limiting no login, rotação de `JWT_SECRET` fora do código-fonte (secret manager), e logs de auditoria estruturados.

---

## 11. Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SQLite Foreign Keys](https://www.sqlite.org/foreignkeys.html)
- [JWT — jwt.io](https://jwt.io/)
- [Node.js Security Best Practices](https://nodejs.dev/learn/nodejs-security-best-practices)

---

*Documento elaborado para o Projeto Integrador UNIVESP - Engenharia de Computação*
