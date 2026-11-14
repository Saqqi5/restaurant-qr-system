# TableQR — Multi-Tenant Restaurant Ordering System

## Overview
A production-ready, QR-based restaurant ordering SaaS platform built with React + Firebase. Supports both shared SaaS deployment and white-label standalone deployment per restaurant.

## Architecture
- **Frontend**: React 18 + Vite 5, located in `restaurant-saas/`
- **Backend**: Firebase (Firestore, Auth, Storage) — no separate backend server
- **Port**: 5000 (frontend dev server)

## Project Layout
```
restaurant-saas/
├── src/
│   ├── App.jsx                  # Root router
│   ├── main.jsx                 # Entry point
│   ├── index.css                # Global styles
│   ├── config/
│   │   ├── firebase.js          # Firebase initialization
│   │   ├── db.js                # Firestore schema + DB operations
│   │   └── tenantResolver.js    # Multi-tenancy engine
│   ├── contexts/
│   │   ├── AuthContext.jsx      # Firebase auth + role management
│   │   └── TenantContext.jsx    # Restaurant data context
│   ├── pages/                   # Page-level components
│   └── components/              # Shared UI components
├── vite.config.js               # Vite config (port 5000, host 0.0.0.0)
├── firebase.json                # Firebase hosting config
├── firestore.rules              # Firestore security rules
└── .env.example                 # Environment variable template
```

## Environment Variables
Firebase credentials must be set as environment variables (see `.env.example`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_DEPLOYMENT_MODE` — `saas` or `standalone`
- `VITE_APP_URL` — Public URL for QR code generation

## Development
```bash
cd restaurant-saas
npm run dev  # Starts on port 5000
```

## Key Notes
- Vite config uses `include: /\.(jsx|js|tsx|ts)$/` in the react plugin and `optimizeDeps.esbuildOptions.loader['.js'] = 'jsx'` because some `.js` files contain JSX syntax
- `allowedHosts: true` is set so the Replit proxy works correctly
- Firebase is used for all data storage — no SQL database
