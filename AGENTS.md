# Wash Wizard - Project Notes

## Current Architecture

- **Data Storage**: LocalStorage (browser-based)
- **Authentication**: Simple username/password check with environment variables
- **Multi-user**: Limited (data is isolated by user_id but stored locally)

## Environment Configuration

Create a `.env` file based on `.env.example`:

```
VITE_ADMIN_USER=admin
VITE_ADMIN_PASSWORD=your_secure_password
VITE_USER_USER=user
VITE_USER_PASSWORD=your_secure_password
```

## Known Limitations

1. **LocalStorage Only**: All data is stored in browser localStorage
2. **No Real Backend**: No API, no database
3. **Single Browser**: Data doesn't sync across devices
4. **No Password Security**: Passwords are compared in plain text (needs hashing for production)

## Future Plans

- **MySQL Integration**: Backend with REST API
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt or similar
- **Multi-tenant**: Support for multiple wash shops

## Run Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Lint code
```
