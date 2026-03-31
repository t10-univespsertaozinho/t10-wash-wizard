# Wash Wizard - Security Guidelines

## Visão Geral

Este projeto é um sistema de gerenciamento para lava rápido. Ao disponibilizar o código publicamente, é necessário garantir que informações sensíveis não sejam expostas.

## Configurações de Segurança

### 1. Variáveis de Ambiente

**NUNCA commite arquivos `.env` com credenciais reais!**

O projeto usa `.gitignore` para bloquear:
- `.env` - variáveis de produção
- `.env.local` - variáveis locais
- Qualquer arquivo com credenciais do Firebase

### 2. Modo de Desenvolvimento Seguro

Para desenvolvimento local sem Firebase:
```bash
# No arquivo .env
VITE_DB_TYPE=localstorage

# Credenciais locais (apenas para teste)
VITE_ADMIN_EMAIL=admin@washwizard.com
VITE_ADMIN_PASSWORD=sua_senha_teste
VITE_USER_EMAIL=user@washwizard.com
VITE_USER_PASSWORD=sua_senha_teste
```

### 3. Configuração Firebase (Produção)

Ao configurar o Firebase para produção:

1. **Firebase Console** → Project Settings → Add app
2. **Authentication** → Enable Email/Password
3. **Firestore Database** → Create database (Production mode)
4. **Regras do Firestore** (firestore.rules):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       
       // Usuários só veem seus próprios dados
       match /clientes/{clienteId} {
         allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
         allow create: if request.auth != null;
       }
       
       match /veiculos/{veiculoId} {
         allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
         allow create: if request.auth != null;
       }
       
       match /lavagens/{lavagemId} {
         allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
         allow create: if request.auth != null;
       }
       
       match /produtos/{produtoId} {
         allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
         allow create: if request.auth != null;
       }
       
       // Tipos de lavagem são públicos (lidos por todos)
       match /tipos_lavagem/{tipoId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }
       
       // Usuários (apenas leitura do próprio perfil)
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

5. **Authentication** → Authorized domains → Adicione seu domínio

### 4. Regras de Produção Recomendadas

Se o projeto for público no GitHub:

1. **Criar arquivo `.env` local** com credenciais de teste
2. **NUNCA fazer push** de credenciais reais
3. **Usar Firebase Emulator** para desenvolvimento local
4. **Documentar apenas a estrutura** do banco (não dados reais)

### 5. Checklist de Segurança

- [ ] `.env` está no `.gitignore`
- [ ] Credenciais do Firebase não estão no código
- [ ] Regras do Firestore bloqueiam acesso entre usuários
- [ ] Senhas não são armazenadas em plain text
- [ ] Dados de teste não contêm informações reais

## Dados de Teste

O sistema inclui dados de demonstração gerados automaticamente (`seedTestData`). Estes são dados fictícios seguros para testes.

## FAQ

**Posso fazer o projeto público?**
Sim, desde que:
- Não inclua credenciais reais
- Configure regras de segurança no Firebase
- Use dados de teste para demos

**Como testar sem expor dados?**
Use o modo `localstorage` (padrão) ou Firebase Emulator.

**O que fazer seCredenciais vazarem?**
1. Alterar senhas imediatamente
2. Revogar chaves API no console do Firebase
3. Verificar se não houve acesso não autorizado
