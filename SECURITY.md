# Wash Wizard - Security Guidelines

## Overview

This is a car wash management system. When making the code public, it's essential to ensure that sensitive information is not exposed.

## Security Implementation

### 1. Environment Variables

**NEVER commit `.env` files with real credentials!**

The project uses `.gitignore` to block:
- `.env` - production variables
- `.env.local` - local variables
- Any file with Supabase credentials

### 2. LocalStorage Security

The application implements multiple security layers for LocalStorage mode:

- **HMAC Signing**: User sessions are signed with HMAC to prevent tampering
- **Timestamp Validation**: Signatures expire after 30 days
- **Data Encryption**: Application data is encrypted before storage

### 3. Performance Best Practices

When deploying, ensure:

- **Code Splitting**: Enabled via React.lazy + Suspense
- **Lazy Loading**: Only necessary pages load on demand
- **Memoization**: Dashboard calculations are memoized with useMemo

```typescript
// Security utilities in src/utils/security.ts
- createSignedUser()    // Creates HMAC-signed user session
- verifySignedUser()    // Verifies session integrity
- encryptStorage()      // Encrypts data before storage
- decryptStorage()      // Decrypts and validates data
- sanitizeInput()       // XSS protection for user inputs
```

### 3. Supabase Configuration (Production)

When configuring Supabase for production:

1. **Supabase Dashboard** → Project Settings → API
2. Get the Project URL and Anon Public Key
3. **Database** → Create tables (`clientes`, `veiculos`, `lavagens`, `produtos`, `tipos_lavagem`, `movimentacoes`)
4. **Deploy Rules**: Use RLS (Row Level Security) on Supabase

### 4. Supabase RLS Security Rules

The project relies on comprehensive Supabase Row Level Security (RLS) rules:

| Collection | Read | Write |
|------------|------|-------|
| `clientes` | Owner or Admin | Owner or Admin |
| `veiculos` | Via cliente owner | Via cliente owner |
| `lavagens` | Via cliente owner | Via cliente owner |
| `produtos` | Auth users | Admin only |
| `movimentacoes` | Auth users | Admin only |
| `tipos_lavagem` | Auth users | Admin only |
| `users` | Own profile | Own profile (no role change) |

### 5. Access Control

| Route | Access |
|-------|--------|
| `/login` | Public |
| `/` (Dashboard) | Authenticated |
| `/clientes` | Authenticated |
| `/lavagens` | Authenticated |
| `/tipos-lavagem` | Admin only |
| `/estoque` | Admin only |
| `/novo-produto` | Admin only |
| `/movimentacao` | Admin only |

### 6. Security Checklist

- [x] `.env` is in `.gitignore`
- [x] No Supabase credentials in code
- [x] Supabase RLS rules prevent cross-user access
- [x] User sessions are HMAC-signed
- [x] LocalStorage data is encrypted
- [x] Input sanitization available
- [x] Test data contains no real information

## Environment Variables

### LocalStorage Mode (Default)
```bash
VITE_DB_TYPE=localstorage
VITE_STORAGE_SECRET=your_secret_key
```

### Supabase Mode
```bash
VITE_DB_TYPE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## FAQ

**Can I make the project public?**
Yes, as long as:
- No real credentials included
- Supabase security RLS configured
- Use test data for demos

**How to test without exposing data?**
Use `localstorage` mode (default) or Firebase Emulator.

**What if credentials leak?**
1. Change passwords immediately
2. Revoke API keys in Supabase Dashboard
3. Check for unauthorized access
4. Review PostgreSQL logs

## Vulnerability Mitigation

| Vulnerability | Status |
|---------------|--------|
| LocalStorage tampering | ✅ Mitigated with HMAC |
| Privilege escalation | ✅ Server-side validation |
| XSS injection | ✅ Sanitization available |
| Supabase IDOR | ✅ Comprehensive RLS rules |
| Sensitive data exposure | ✅ Encryption implemented |

## Sync Security

A implementação de sincronização adiciona camadas adicionais de segurança:

### Campos de Sincronização
Cada entidade agora inclui:
- `updated_at`: Timestamp da última modificação (protegido contra manipulação)
- `_syncStatus`: Estado de sincronização (`synced` | `pending` | `conflict`)

### Fluxo de Sync Seguro
1. **Inicialização**: Dados são validados antes de serem carregados
2. **Detecção de Conflitos**: Usa timestamps para identificar alterações remotas
3. **Sincronização**: Apenas dados do usuário atual são sincronizados (user_id)
4. **Resolução de Conflitos**: Admin decide qual versão manter

### Configuração de Segurança para Sync
- Supabase credentials nunca expostas no código
- Dados são associados ao user_id em todas as operações
- Sync automático apenas se houver alterações pendentes

## Data for Testing

The system includes demonstration data generated automatically (`seedTestData`). These are safe fictitious data for testing.
