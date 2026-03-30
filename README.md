# Restaurant QR Ordering System 🍽️

This repository now contains a complete multi-tenant restaurant QR ordering application in `restaurant-saas/`.

## What is included

- Customer QR menu and cart experience.
- Live order flow for kitchen, cash counter, and servers.
- General admin dashboard for menu/staff/table operations.
- Super admin dashboard for SaaS tenant management.
- Firebase-backed auth, Firestore data model, and security rules.

## Repository layout

- `restaurant-saas/` → Full Vite + React + Firebase application.
- `tableqr-restaurant-saas.zip` → Original source archive used to bootstrap the app.

## Quick start

```bash
cd restaurant-saas
cp .env.example .env
# fill Firebase values in .env
npm install
npm run dev
```

## Security hardening added

Compared to the original scaffold, Firestore rules now enforce stronger constraints on customer order creation and staff updates (status/payment transitions and immutable financial/order-line fields).

For full setup and deployment docs, see: `restaurant-saas/README.md`.
