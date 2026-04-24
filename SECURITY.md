# Wash Wizard - Security Guidelines

## Overview

This is a car wash management system. When making the code public, it's essential to ensure that sensitive information is not exposed.

## Security Implementation

### 1. Environment Variables

**NEVER commit `.env` files with real credentials!**

The project uses `.gitignore` to block:
- `.env` - production variables
- `.env.local` - local variables
- Any file with Firebase credentials

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

### 3. Firebase Configuration (Production)

When configuring Firebase for production:

1. **Firebase Console** → Project Settings → Add app
2. **Authentication** → Enable Email/Password
3. **Firestore Database** → Create database (Production mode)
4. **Deploy Rules**: Use `firestore.rules` file

```bash
# Deploy rules to Firebase
firebase deploy --only firestore:rules
```

### 4. Firestore Security Rules

The project includes comprehensive Firestore rules in `firestore.rules`:

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
- [x] No Firebase credentials in code
- [x] Firestore rules prevent cross-user access
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

### Firebase Mode
```bash
VITE_DB_TYPE=firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

## FAQ

**Can I make the project public?**
Yes, as long as:
- No real credentials included
- Firebase security rules configured
- Use test data for demos

**How to test without exposing data?**
Use `localstorage` mode (default) or Firebase Emulator.

**What if credentials leak?**
1. Change passwords immediately
2. Revoke API keys in Firebase Console
3. Check for unauthorized access
4. Review Firestore logs

## Vulnerability Mitigation

| Vulnerability | Status |
|---------------|--------|
| LocalStorage tampering | ✅ Mitigated with HMAC |
| Privilege escalation | ✅ Server-side validation |
| XSS injection | ✅ Sanitization available |
| Firestore IDOR | ✅ Comprehensive rules |
| Sensitive data exposure | ✅ Encryption implemented |

## Data for Testing

The system includes demonstration data generated automatically (`seedTestData`). These are safe fictitious data for testing.
