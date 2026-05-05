# Wash Wizard Security Policy (Academic Version)

## 1. Overview

This document outlines the security architecture and mechanisms implemented in the Wash Wizard project.
In this academic version, the primary data source is a local SQLite database served by a Node.js backend. The frontend handles authentication locally with HMAC.

## 2. Authentication & Authorization

### 2.1 Role-Based Access Control (RBAC)
The system implements strict role-based access control:
- **Admin**: Full access to all features (Clients, Washes, Inventory, Settings, CSV Backup/Restore).
- **User (Operator)**: Restricted access to operational features (Clients, Washes). Cannot access Inventory, Settings, or Backup.

### 2.2 Local Session Security (HMAC)
Since there is no complex Auth backend, the frontend simulates JWT-like behavior using Web Crypto API.
- Sessions are stored in LocalStorage but signed with a SHA-256 HMAC signature.
- Any tampering with the LocalStorage content invalidates the session.
- Expiration: Sessions automatically expire after 30 days.

## 3. Data Protection

### 3.1 SQLite Database (Backend)
The database `wash_wizard.db` is stored locally within the project folder. It is not committed to version control.
The database schema (`backend/schema.sql`) enforces relational integrity (`PRAGMA foreign_keys = ON;`) to prevent orphan records.

### 3.2 CSV Backup Integrity
The application supports CSV import/export.
- The import feature clears the database and replaces it with the CSV contents.
- Strict ordering is maintained during import (users -> clientes -> veiculos -> etc) to satisfy foreign key constraints.
- Foreign keys are temporarily disabled (`PRAGMA foreign_keys = OFF`) during the import transaction and re-enabled afterward.

### 3.3 Input Validation (Frontend)
- **Zod Validation**: All forms use React Hook Form integrated with Zod schemas to validate data before sending to the backend.
- **XSS Protection**: React automatically escapes strings rendered in the DOM, mitigating XSS risks. Input sanitation is explicitly applied to text fields where applicable.

## 4. API Security

- The Express backend uses the `cors` middleware to accept requests from the frontend.
- While it lacks authentication middlewares (due to the academic/local scope of the project), production implementations must introduce JWT validation inside Express.
