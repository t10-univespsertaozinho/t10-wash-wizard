# Wash Wizard - Project Notes

## Current Architecture

- **Data Storage**: LocalStorage (browser-based) with encryption, Firebase ready
- **Authentication**: Local credentials with HMAC signature validation
- **Multi-user**: Role-based access (admin/user)
- **Database Layer**: Abstraction layer supporting LocalStorage and Firebase
- **Test Data**: Built-in seedTestData() for demonstrations

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
- **Built-in test data for demonstrations**

## Security Implementation

- **User Authentication**: HMAC-signed sessions with timestamp validation
- **Data Storage**: Encrypted LocalStorage with integrity verification
- **Input Sanitization**: XSS protection on user inputs
- **Firestore Rules**: Comprehensive security rules (see firestore.rules)

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

1. **LocalStorage Only**: All data is stored in browser localStorage (with encryption)
2. **No Real Backend**: Optional Firebase integration for production
3. **Single Browser**: Data doesn't sync across devices (unless Firebase enabled)

## Future Plans

- **Firebase Integration**: Full Firestore + Auth integration
- **Real-time Sync**: Multi-device support
- **Cloud Functions**: Backend logic for security

## Run Commands

```bash
npm run dev      # Development server (port 8080)
npm run build    # Production build
npm run lint     # Lint code
```

## Features

- Client and vehicle management
- Wash tracking (pending/in-progress/completed/cancelled)
- Inventory management with stock alerts
- Financial dashboard with charts (Recharts)
- Role-based access control (Admin vs User)
- Data encryption in LocalStorage

## Security Implementation

- **User Authentication**: HMAC-signed sessions with timestamp validation
- **Data Storage**: Encrypted LocalStorage with integrity verification
- **Input Sanitization**: XSS protection on user inputs
- **Firestore Rules**: Comprehensive security rules (see firestore.rules)

## Known Limitations

1. **LocalStorage Only**: All data is stored in browser localStorage (with encryption)
2. **No Real Backend**: Optional Firebase integration for production
3. **Single Browser**: Data doesn't sync across devices (unless Firebase enabled)

## Future Plans

- **Firebase Integration**: Full Firestore + Auth integration
- **Real-time Sync**: Multi-device support
- **Cloud Functions**: Backend logic for security

## Run Commands

```bash
npm run dev      # Development server (port 8080)
npm run build    # Production build
npm run lint     # Lint code
```