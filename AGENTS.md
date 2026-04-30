# Wash Wizard - Project Notes

> Este arquivo contém notas para agentes de IA trabalharem no projeto.
> Para histórico detalhado, veja `HISTORY.md`.

## Current Architecture

- **Data Storage**: LocalStorage (browser-based) with encryption, Firebase ready
- **Authentication**: Local credentials with HMAC signature validation
- **Multi-user**: Role-based access (admin/user)
- **Database Layer**: Abstraction layer supporting LocalStorage and Firebase
- **Test Data**: Built-in seedTestData() for demonstrations
- **Settings Page**: Admin-only database configuration interface
- **Performance**: Code splitting with React.lazy + Suspense, memoization with useMemo

## Sync Architecture (Firebase Integration)

O projeto implementa sincronização bidirecional entre dados locais e Firebase:

### Fluxo de Sincronização

1. **Inicialização**: Ao abrir o app, os dados são carregados do Firebase (se configurado)
2. **Trabalho Local**: Todas as alterações ficam no estado local (AppContext)
3. **Detecção de Conflitos**: Timestamps (`updated_at`) comparados para detectar alterações remotas
4. **Sincronização**: Ao fechar a página (`beforeunload`), dados locais são enviados para Firebase
5. **Resolução de Conflitos**: Admin é notificado sobre conflitos e pode escolher qual versão manter

### Campos de Sincronização

Cada entidade possui campos adicionais:
- `updated_at`: Timestamp da última modificação
- `_syncStatus`: Estado de sincronização (`synced` | `pending` | `conflict`)

### UI de Sync

A página de configurações (`/configuracoes`) mostra:
- Status atual de sincronização (synced/pending/conflict)
- Número de alterações pendentes
- Botão para sincronização manual
- Lista de conflitos com opção de resolução

### Funções Principais

```typescript
// Em src/services/database.ts
syncLocalToFirebase(clientes, veiculos, lavagens, produtos, movimentacoes, userId)
// Retorna: { conflicts: Conflict[], synced: number, errors: string[] }

detectConflicts(localClientes, remoteClientes)
// Detecta conflitos por comparação de timestamps

// Em src/contexts/AppContext.tsx
syncToFirebase()  // Sincronização manual
resolveConflict(entityType, entityId, useLocal)  // Resolver conflito
```

## Quick Start

```bash
# Clone o projeto
git clone https://github.com/t10-univespsertaozinho/t10-wash-wizard.git
cd t10-wash-wizard

# Instale dependências
npm install

# Configure o ambiente
cp .env.example .env

# Inicie o desenvolvimento
npm run dev  # Porta: 8080
```

## Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
# Database Type: 'localstorage' or 'firebase'
VITE_DB_TYPE=localstorage

# Firebase Configuration (optional - for production)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id

# Storage Secret (for HMAC signing)
VITE_STORAGE_SECRET=your_secure_secret
```

## Features

- Client and vehicle management
- Wash tracking (pending/in-progress/completed/cancelled)
- Inventory management with stock alerts
- Financial dashboard with charts (Recharts)
- Role-based access control (Admin vs User)
- Data encryption in LocalStorage
- Built-in test data for demonstrations
- **Admin settings page for Firebase configuration**
- **Lazy loading of pages** for better performance
- **Bidirectional Sync**: Auto-sync to Firebase on page close
- **Conflict Detection**: Timestamps-based conflict detection
- **Manual Sync**: Button to force synchronization anytime
- **Conflict Resolution**: Admin can choose local or remote version

## Performance Implementation

- **Code Splitting**: All pages loaded with React.lazy + Suspense
- **Memoization**: Dashboard calculations wrapped in useMemo
- **Loading States**: Animated spinner component (PageLoading)
- **Optimized Charts**: Styles memoized to prevent re-renders

## Security Implementation

- **User Authentication**: HMAC-signed sessions with timestamp validation
- **Data Storage**: Encrypted LocalStorage with integrity verification
- **Input Sanitization**: XSS protection on user inputs
- **Firestore Rules**: Comprehensive security rules (see firestore.rules)
- **Settings Validation**: Input validation to prevent misconfiguration

## Settings Page

The system includes an admin-only settings page (`/configuracoes`) that allows:

### Database Configuration
- **Local Mode**: Data stored in browser (ideal for testing)
- **Firebase Mode**: Cloud data (ideal for production)

### User-Friendly Interface
- Visual selection between Local and Firebase
- Real-time validation fields
- Step-by-step tutorial to get credentials
- Test connection button
- Clear feedback messages
- Tutorial displayed above credential fields

### Security Features
- URL format validation (Firebase domain)
- Project ID validation (lowercase letters, numbers, hyphens only)
- API Key validation (minimum 10 characters)
- Credentials stored securely in browser

## Test Data for Demonstrations

The system includes a **"Carregar Dados"** button on the Dashboard that generates fictitious test data automatically:

- **4 fictitious clients**: João Silva, Maria Oliveira, Carlos Santos, Ana Paula
- **4 vehicles**: Toyota Corolla, Honda Civic, Volkswagen Gol, Ford Ka
- **3 products**: Shampoo Automotivo, Cera de Polimento, Limpa Vidros
- **Wash orders**: Data from the last 6 months with varied dates, values and statuses
- **Stock movements**: Input and output entries

To use for presentation:
1. Login as admin (`admin@washwizard.com` / `admin123`)
2. Click "Carregar Dados" on Dashboard
3. Fictitious data will be created automatically

## Known Limitations

1. **Browser Storage**: Dados locais ficam no localStorage do navegador (com criptografia)
2. **Single Browser**: Dados não sincronizam entre dispositivos (a menos que Firebase esteja ativo)

## Firebase Configuration

### Configuração via .env

```bash
VITE_DB_TYPE=firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Configuração via Interface

O admin pode configurar o Firebase através da página de configurações:
1. Acesse `/configuracoes` (requer acesso admin)
2. Selecione "Firebase (Nuvem)"
3. Preencha as credenciais do Firebase Console
4. Clique em "Testar Conexão" para verificar
5. Salve as configurações

### Regras de Segurança Firestore

No Firebase Console, configure as regras de segurança:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{document} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.user_id;
    }
  }
}
```

## Run Commands

```bash
npm run dev      # Development server (port 8080)
npm run build    # Production build
npm run lint    # Lint code
```

## Run Commands

```bash
npm run dev      # Development server (port 8080)
npm run build    # Production build
npm run lint    # Lint code
```
