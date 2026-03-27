# Wash Wizard

Wash Wizard is a management system for car wash businesses, featuring client management, wash tracking, inventory control, and financial reporting.

## Project Info

**Project Name**: Wash Wizard  
**Type**: Web Application (SPA)

## How to Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn-ui + Tailwind CSS
- **Charts**: Recharts
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod
- **Data Persistence**: LocalStorage

## Features

### Dashboard
- Daily stats (washes, revenue, clients, monthly washes)
- Pending washes and recent clients
- 7-day revenue and wash charts
- Low stock alerts
- Monthly stats (revenue, completed, by type)
- 6-month evolution charts

### Client Management
- Complete client registration
- Wash history per client
- Vehicle management per client

### Wash Tracking
- New wash registration
- Service type, vehicle, and client selection
- Status tracking (pending/completed)
- Filterable listing

### Service Types (Admin)
- Service type configuration
- Price definition per type

### Inventory (Admin)
- Chemical and supplies management
- Quantity and unit tracking
- Automatic low stock alerts
- Stock movement tracking (in/out)

### Authentication
- Login with username and password
- Roles: admin and employee
- Protected routes by access level

## Authentication

The application uses environment variables for authentication. Copy `.env.example` to `.env` and configure your credentials:

```bash
# Default credentials (development only - change for production)
VITE_ADMIN_USER=admin
VITE_ADMIN_PASSWORD=admin
VITE_USER_USER=user
VITE_USER_PASSWORD=user
```

**Important**: For production use, change the default credentials in your `.env` file.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Recharts
- React Router DOM
- React Hook Form
- Zod

## Current Limitations

This version uses **LocalStorage** for data persistence, which means:

- Data is stored in the browser only
- No multi-user support (all data is local to each browser)
- No real-time synchronization between devices
- Data is lost when browser cache is cleared
- Not suitable for production use with multiple employees

## Future: MySQL Integration

For production use, this project is designed to be integrated with a MySQL database. The planned changes include:

1. **Backend API**: REST API with Node.js/Express
2. **Database**: MySQL with the following tables:
   - `users` - System users (admin/employees)
   - `clients` - Client information
   - `vehicles` - Client vehicles
   - `wash_types` - Service types and prices
   - `washes` - Wash records
   - `products` - Inventory items
   - `stock_movements` - Inventory tracking

3. **Authentication**: JWT-based authentication
4. **Security**: Password hashing, input validation, SQL injection prevention

## How to Configure

1. Copy `.env.example` to `.env`
2. Configure your credentials
3. For development, the default credentials are: admin/admin
