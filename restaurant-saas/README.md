# 🍽️ TableQR — Multi-Tenant Restaurant Ordering System

A production-ready, QR-based restaurant ordering SaaS platform built with React + Firebase.
Supports both shared SaaS deployment and white-label standalone deployment per restaurant.

---

## 📁 Project Structure

```
src/
├── App.jsx                        # Root router
├── main.jsx                       # Entry point
├── index.css                      # Complete stylesheet
│
├── config/
│   ├── firebase.js                # Firebase initialization
│   ├── db.js                      # Firestore schema + all DB operations
│   └── tenantResolver.js          # ⭐ Core multi-tenancy engine
│
├── contexts/
│   ├── AuthContext.jsx             # Firebase auth + role management
│   └── TenantContext.jsx           # Restaurant data context
│
├── pages/
│   ├── LandingPage.jsx             # SaaS marketing page
│   ├── LoginPage.jsx               # Staff login
│   ├── CustomerMenu.jsx            # QR customer menu
│   ├── SuperAdminDashboard.jsx     # Platform admin
│   ├── GeneralAdminDashboard.jsx   # Restaurant admin
│   ├── KitchenDashboard.jsx        # Kanban order queue
│   ├── CashCounterDashboard.jsx    # Payment processing
│   └── ServerDashboard.jsx         # Manual order creation
│
├── components/
│   ├── ProtectedRoute.jsx
│   ├── admin/
│   │   ├── AdminLayout.jsx         # Shared admin shell + sidebar
│   │   ├── StatsBar.jsx
│   │   ├── RestaurantCard.jsx
│   │   ├── CreateRestaurantModal.jsx
│   │   ├── MenuItemModal.jsx       # CRUD with image upload
│   │   ├── StaffModal.jsx          # Role-based staff creation
│   │   ├── QRModal.jsx             # QR generator + bulk print
│   │   ├── OrdersTable.jsx
│   │   └── AnalyticsPanel.jsx
│   └── customer/
│       ├── RestaurantHeader.jsx
│       ├── MenuGrid.jsx            # Category-filtered menu
│       ├── CartDrawer.jsx          # Slide-up cart with notes
│       └── OrderTracker.jsx        # Live order status tracker
│
├── firestore.rules                 # Security rules
├── storage.rules
├── .env.example
└── vite.config.js
```

---

## 🚀 Quick Start

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable:
   - **Firestore Database** (start in test mode, then apply rules)
   - **Firebase Authentication** (enable Email/Password)
   - **Firebase Storage**
4. Copy your Firebase config

### 2. Install & Configure

```bash
cd restaurant-saas
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your Firebase credentials
```

### 3. Apply Security Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login
firebase init

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 4. Create First Super Admin

In Firebase Console → Authentication → Add user, then in Firestore add a document:

**Collection:** `users`  
**Document ID:** (the Firebase Auth UID)
```json
{
  "email": "admin@yourapp.com",
  "name": "Super Admin",
  "role": "super_admin",
  "restaurant_id": null,
  "active": true
}
```

### 5. Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🌐 Deployment Modes

### Mode 1: SaaS (Multiple Restaurants)

Default mode. Multiple restaurants share one deployment.

```bash
# .env
VITE_DEPLOYMENT_MODE=saas
VITE_APP_URL=https://yourapp.com
```

- Customer menu: `https://yourapp.com/r/{restaurant_id}?table=1`
- QR codes generated with this URL pattern

### Mode 2: Standalone / White-Label (Single Restaurant)

Deploy for just one restaurant, e.g. on their own domain.

```bash
# .env
VITE_DEPLOYMENT_MODE=standalone
VITE_RESTAURANT_ID=your_restaurant_firestore_id
VITE_APP_URL=https://myrestaurant.com
```

```bash
npm run build:standalone
# or
VITE_DEPLOYMENT_MODE=standalone npm run build
```

- Customer menu: `https://myrestaurant.com?table=1`
- No restaurant selection — loads that restaurant directly

### Mode 3: Custom Domain (per restaurant)

In Super Admin dashboard → Domain tab for a restaurant:
1. Enter `myrestaurant.com`
2. Configure DNS: `A record @ → your server IP`
3. The system maps domain → restaurant_id via Firestore

For dynamic resolution, also update `DOMAIN_MAP` in `tenantResolver.js`:
```js
const DOMAIN_MAP = {
  "myrestaurant.com": "rest_abc123",
};
```

---

## 👥 Roles & Access

| Role | Access |
|------|--------|
| `super_admin` | All restaurants, all data, create/delete restaurants |
| `general_admin` | Own restaurant: menu CRUD, staff, orders view, QR gen |
| `kitchen` | Own restaurant: incoming orders queue, status updates |
| `cash_counter` | Own restaurant: ready orders, payment processing |
| `server` | Own restaurant: create manual orders, view active orders |

### Login URLs
- `/login` — All staff
- After login, users are redirected to their role's dashboard

---

## 📱 QR Code System

QR codes are generated in the **QR tab** of the General Admin or Super Admin dashboard.

**URL Format (SaaS):**
```
https://yourapp.com/r/{restaurant_id}?table={table_number}
```

**URL Format (Standalone):**
```
https://myrestaurant.com?table={table_number}
```

**URL Format (Custom Domain):**
```
https://myrestaurant.com?table={table_number}
```

- **Bulk print:** Opens a print-ready page with all table QR codes
- **Download:** Downloads individual QR as PNG

---

## 🗄️ Firestore Data Structure

```
restaurants/{restaurantId}
  name, slug, logo_url, table_count, custom_domain, theme, active, plan

restaurants/{restaurantId}/menu/{itemId}
  name, description, price, category, image_url, available, prep_time_minutes

restaurants/{restaurantId}/orders/{orderId}
  table_number, items[], status, total, payment_status, payment_method,
  created_at, estimated_ready, notes, created_by

users/{userId}
  email, name, role, restaurant_id, active

domain_mappings/{domain}
  restaurant_id, verified
```

---

## 🚢 Production Deployment (Firebase Hosting)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize hosting
firebase init hosting
# Public directory: dist
# Single page app: Yes
# Overwrite index.html: No

# Build
npm run build

# Deploy
firebase deploy --only hosting
```

### Custom Domain on Firebase Hosting
1. Firebase Console → Hosting → Add Custom Domain
2. Add your domain
3. Update DNS records as instructed
4. Certificate is auto-provisioned

---

## 🔧 Converting SaaS Instance to Standalone

Minimal changes required:

1. Set in `.env`:
   ```
   VITE_DEPLOYMENT_MODE=standalone
   VITE_RESTAURANT_ID=<your_restaurant_id>
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Deploy `dist/` folder to any static host (Netlify, Vercel, Firebase Hosting, etc.)

4. Point the restaurant's domain to the deployment.

No code changes needed — the tenant resolver handles everything automatically.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6 |
| Bundler | Vite 5 |
| Backend | Firebase (Firestore, Auth, Storage) |
| Styling | Pure CSS with CSS variables |
| QR Codes | qrserver.com API (replace with `qrcode` npm package for offline) |
| Fonts | Google Fonts (Sora + DM Sans) |
