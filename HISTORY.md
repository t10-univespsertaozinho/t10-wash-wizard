# HISTORY.md — Wash Wizard development log

> Log append-only de todas as alterações no projeto. Novas entradas no topo.
> Cada entrada: data, agente/humano, resumo, arquivos modificados.
>
> **Convenção:** antes de declarar uma tarefa "concluída", qualquer agente AI **deve**
> adicionar uma entrada aqui.

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