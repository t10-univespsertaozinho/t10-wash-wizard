# HISTORY.md — Wash Wizard development log

> Log append-only de todas as alterações no projeto. Novas entradas no topo.
> Cada entrada: data, agente/humano, resumo, arquivos modificados.
>
> **Convenção:** antes de declarar uma tarefa "concluída", qualquer agente AI **deve**
> adicionar uma entrada aqui.

---

## 2026-05-04 — antigravity — Supabase Migration and Optimizations

### Resumo

Migração da camada de nuvem do Firebase para o Supabase, mantendo intacta toda a robusta arquitetura offline (LocalStorage com criptografia e sessões HMAC). Sincronização agora conecta diretamente com PostgreSQL.

### Arquivos modificados

- `src/lib/supabase.ts` *(novo)*
  - Cliente do Supabase implementado (substitui `firebase.ts`)
- `src/services/database.ts`
  - Refatorado para o modelo `supabaseDB` substituindo o `firebaseDB`.
  - Funções atualizadas (`syncLocalToSupabase` em vez de `syncLocalToFirebase`) com suporte ao PostgreSQL.
- `src/contexts/AppContext.tsx`
  - Métodos renomeados para usar terminologia e as funções do Supabase no auto-sync.
- `src/pages/Configuracoes.tsx`
  - Interface remodelada para pedir URL e Anon Key do Supabase, incluindo validações simplificadas.
- `.env` e `.env.example`
  - Variáveis do Firebase substituídas pelas correspondentes do Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
- `vite.config.ts`
  - Atualização do `manualChunks` para suportar `@supabase/supabase-js`.
- Documentação (`SECURITY.md`, `README.md`, `AGENTS.md`)
  - Atualizadas todas as menções de Firestore/Firebase para PostgreSQL/Supabase com RLS.

### Verificação

- `npm run lint` → erros corrigidos
- `npm run build:dev` → build rodando com sucesso.

---

## 2026-05-04 — opencode/minimax-m2.5-free — Schema Alignment and Firebase Cleanup

### Resumo

Alinhamento do schema SQL do Supabase com os tipos TypeScript do projeto e remoção de artefatos obsoletos do Firebase.

### Arquivos modificados

- `tabela_sistema.sql` *(atualizado)*
  - Adicionada coluna `nome` em `users`
  - Adicionadas colunas `cor` e `user_id` em `veiculos`
  - Renomeado `tipo_id` → `tipo_lavagem_id` em `lavagens`
  - Adicionadas colunas `user_id`, `pagamento`, `observacao`, `data_conclusao` em `lavagens`
  - Renomeado `min_quantidade` → `estoque_minimo` em `produtos`
  - Adicionadas colunas `categoria`, `unidade`, `preco_unitario`, `user_id` em `produtos`
  - Adicionadas colunas `observacao`, `user_id` em `movimentacoes`

- `firestore.rules` *(removido)*
  - Arquivo de regras do Firestore removido (obsoleto após migração para Supabase)

- `src/types/index.ts`
  - Alterado `status` de `em_andamento` para `em_progresso` (alinhado com schema SQL)

- `src/contexts/AppContext.tsx`
  - Atualizado `seedTestData` para usar `em_progresso` no status das lavagens

- `src/pages/ClienteDetalhe.tsx`
  - Atualizados labels e mappings de status de lavagens

- `src/pages/Lavagens.tsx`
  - Atualizados filtros, labels e verificações de status de lavagens

- `AGENTS.md`
  - Atualizada referência de "Firestore Rules" para "Supabase RLS"
  - Corrigida referência de "Firebase" para "Supabase" na seção Settings
  - Removida seção duplicada de "Run Commands"

- `README.md`
  - Corrigida menção de "conta Firebase" para "conta Supabase"

- `CLAUDE.md`
  - Corrigido caminho do projeto: `t10-0wash0wizard` → `t10-wash-wizard`
  - Corrigida porta: 80 → 8080

- `docs/DATABASE_SCHEMA.md` *(pendente)*
  - Substituição pelo schema completo do `tabela_sistema.sql`

### Verificação

- `npm run lint` → sem erros (apenas warnings de componentes pré-existentes)

---

## 2026-04-30 — opencode/minimax-m2.5-free — Firebase Sync Integration

### Resumo

Implementação completa de sincronização bidirecional entre dados locais e Firebase, com detecção de conflitos por timestamps e resolução pelo admin.

### Arquivos modificados

- `src/types/index.ts`
  - Adicionados campos `updated_at` e `_syncStatus` em todas as entidades
  - Nova interface `Conflict` e tipo `SyncStatus`

- `src/services/database.ts`
  - Adicionadas funções `syncLocalToFirebase()` para sincronização
  - Adicionada função `detectConflicts()` para detecção de conflitos
  - Adicionada função `isFirebaseActive()` para verificar modo ativo
  - Adicionada função `getDatabaseType()` para detectar tipo configurado

- `src/contexts/AppContext.tsx`
  - Nova inicialização que carrega dados do Firebase ao iniciar
  - Estados: `syncStatus`, `lastSync`, `conflicts`, `hasPendingChanges`
  - Operações CRUD agora marcam `_syncStatus: 'pending'`
  - Listener `beforeunload` para sincronização automática ao fechar
  - Carregamento de conflitos pendentes do localStorage

- `src/pages/Configuracoes.tsx`
  - Nova seção de status de sincronização
  - Botão para sincronização manual
  - Lista de conflitos com opções de resolução (manter local/remoto)

- `AGENTS.md`
  - Nova seção "Sync Architecture" com documentação completa
  - Recursos atualizados (bidirectional sync, conflict detection, manual sync)

### Verificação

- `npm run lint` → sem erros (apenas warnings de componentes pré-existentes)
- `npm run dev` → servidor inicia normalmente

### Fluxo de Sync Implementado

1. **Inicialização**: Carrega dados do Firebase se configurado
2. **Trabalho**: Alterações ficam no estado local com `pending`
3. **Fechar**: Auto-sync ao fechar a página (`beforeunload`)
4. **Conflitos**: Admin notificado e pode resolver na página de configurações

---

## 2026-04-30 — opencode/minimax-m2.5-free — Performance optimization and settings page improvements

### Resumo

Otimizações de performance e melhorias na página de configurações do banco de dados para usuários não-técnicos.

### Arquivos modificados

- `src/App.tsx`
  - Adicionado **React.lazy** para todas as páginas (carregamento sob demanda)
  - Implementado **Suspense** com componente `PageLoading` (spinner animado)
  - Refatorado rotas com `Outlet` para melhor organização
  - Separadas rotas de usuário e admin com `ProtectedRoute` unificado

- `src/pages/Dashboard.tsx`
  - Adicionado **useMemo** para todos os cálculos de estatísticas
  - Estilos de tooltips e ticks memoizados
  - Variável `stats` contendo todos os dados processados

- `src/pages/Configuracoes.tsx`
  - Tutorial simplificado posicionado acima dos campos de credenciais
  - Textos mais claros e acessíveis (recomendações de uso para cada modo)
  - Destaque visual com fundo azul claro e bordas
  - Fonte maior nas instruções
  - Correção de duplicação e erros de sintaxe

- `vite.config.ts`
  - Adicionado **code splitting** com chunks separados:
    - `vendor-firebase`: SDKs do Firebase
    - `vendor-charts`: Recharts
    - `vendor-ui`: Componentes Radix UI e lucide-react

- `README.md`
  - Adicionado TanStack React Query na tech stack
  - Nova seção de Performance (code splitting, memoization, bundle partitioning)
  - Porta atualizada para 8080

- `AGENTS.md`
  - Nova seção "Performance Implementation"
  - Porta atualizada

- `SECURITY.md`
  - Nova seção "Performance Best Practices"

### Verificação

- `npm run dev` → servidor inicia na porta 8080
- `npm run lint` → sem erros (warnings de componentes pré-existentes)

### Próximas ações sugeridas

1. Testar a página de configurações com usuários não-técnicos
2. Criar pull request com as otimizações de performance
3. Documentar mudanças no HISTORY.md

---

## 2026-04-27 — opencode/minimax-m2.5-free — Security improvements and Firebase configuration page

### Resumo

Implementação de melhorias de segurança e criação da página de configurações do Firebase acessível para administradores.

### Arquivos modificados

- `src/utils/security.ts` *(novo)*
  - `createSignedUser()`: Cria sessão HMAC-signed
  - `verifySignedUser()`: Verifica integridade da sessão
  - `encryptStorage()`: Criptografa dados antes do armazenamento
  - `decryptStorage()`: Descriptografa e valida dados
  - `sanitizeInput()`: Proteção XSS

- `src/contexts/AuthContext.tsx`
  - Integrada assinatura HMAC para sessões de usuário
  - Validação de timestamp (expiração após 30 dias)

- `src/contexts/AppContext.tsx`
  - Criptografia de dados antes do armazenamento local
  - Verificação de integridade

- `src/pages/Configuracoes.tsx` *(novo)*
  - Página de configurações acessível apenas para admin
  - Seleção visual entre Local e Firebase
  - Validação em tempo real dos campos
  - Tutorial passo-a-passo para obter credenciais
  - Botão de testar conexão
  - Mensagens de feedback

- `firestore.rules` *(novo)*
  - Regras completas de segurança do Firestore
  - Controle de acesso por coleção
  - Proteção contra IDOR

- `src/lib/firebase.ts`
  - Verificação de configuração (`isFirebaseConfigured()`)
  - Suporte a credenciais do navegador

### Verificação

- `npm run lint` → sem erros críticos

---

## 2026-04-20 — opencode/minimax-m2.5-free — Client editing and BaaS integration

### Resumo

Implementação da página de edição de clientes e integração com Firebase como BaaS.

### Arquivos modificados

- `src/pages/EditarCliente.tsx` *(novo)*
  - Formulário de edição de dados do cliente
  - Validação com Zod
  - Redirecionamento após sucesso

- `src/lib/firebase.ts` *(novo)*
  - Configuração do Firebase SDK
  - Autenticação e Firestore

- `src/services/database.ts`
  - Interface abstrata `Database`
  - Suporte a LocalStorage e Firebase
  - `getDatabase()` factory

### Build verification

- `npm run dev` → servidor inicia normalmente

---

## 2026-04-15 — opencode/minimax-m2.5-free — Color scheme adjustment for dark/light mode

### Resumo

Correção do esquema de cores para funcionar corretamente nos modos claro e escuro.

### Arquivos modificados

- `src/components/ui/card.tsx`
- `src/components/providers/ThemeProvider.tsx`
- Diversos componentes de UI

### Verificação

- Testado em ambos os modos (light/dark)

---

## 2026-04-10 — opencode/minimax-m2.5-free — Security analysis and fixes

### Resumo

Análise de segurança e correções de vulnerabilidades identificadas.

### Correções implementadas

- Proteção contra manipulação de LocalStorage
- Assinatura HMAC para sessões
- Criptografia de dados sensíveis
- Regras de Firestore
- Sanitização de inputs

### Arquivos modificados

- `src/contexts/AuthContext.tsx`
- `src/contexts/AppContext.tsx`
- `.gitignore` (proteção do .env)

---

## 2026-04-05 — opencode/minimax-m2.5-free — Financial dashboard improvements

### Resumo

Melhorias no dashboard financeiro com novos gráficos e métricas.

### Arquivos modificados

- `src/pages/Dashboard.tsx`
  - Gráficos de receita por período
  - Estatísticas de lavagens
  - Alertas de estoque baixo
  - Dados de teste (seedTestData)

---

## 2026-03-01 — GitHub Actions — Project setup

### Resumo

Setup inicial do projeto a partir do template vite-react-shadcn-ts.

### Arquivos criados

- Estrutura base React 18 + TypeScript
- shadcn-ui components
- React Router DOM
- Recharts
- Contextos de autenticação e app

---

## How to resume

```bash
cd /home/labiocom-abel/Documentos/t10-wash-wizard

# 1. Read the agent notes
cat AGENTS.md HISTORY.md

# 2. Check current changes
git status
git diff

# 3. Build to verify
npm run dev

# 4. Run lint
npm run lint
```