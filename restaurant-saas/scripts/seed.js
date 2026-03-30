/**
 * SEED SCRIPT — TableQR
 * ══════════════════════
 * Run this ONCE after setting up Firebase to bootstrap:
 *   - 1 Super Admin account
 *   - 1 Demo Restaurant
 *   - Full demo menu (4 categories, 12 items)
 *   - 4 Staff accounts (one per role)
 *
 * Usage:
 *   1. npm install (in project root)
 *   2. Fill in your Firebase credentials below OR set env vars
 *   3. node scripts/seed.js
 *
 * Requires: Node.js 18+
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, collection, serverTimestamp, Timestamp
} from "firebase/firestore";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "firebase/auth";

// ── Config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        || "your-app.firebaseapp.com",
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID         || "your-project-id",
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     || "your-app.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId:             process.env.VITE_FIREBASE_APP_ID             || "1:000:web:xxx",
};

// ── Seed Data ─────────────────────────────────────────────────────
const SUPER_ADMIN = {
  email:    "superadmin@tableqr.com",
  password: "SuperAdmin@123",
  name:     "Platform Admin",
};

const RESTAURANT = {
  id:           "demo_restaurant_001",
  name:         "Bella Italia",
  slug:         "bella-italia",
  table_count:  12,
  logo_url:     null,
  custom_domain: null,
  theme:        { primary: "#e85d04", accent: "#f48c06" },
  active:       true,
  plan:         "saas",
};

const STAFF = [
  { email: "admin@bellaitalia.com",   password: "Admin@123",   name: "Marco Rossi",    role: "general_admin" },
  { email: "kitchen@bellaitalia.com", password: "Kitchen@123", name: "Chef Luigi",     role: "kitchen" },
  { email: "cash@bellaitalia.com",    password: "Cash@123",    name: "Sofia Bianchi",  role: "cash_counter" },
  { email: "server@bellaitalia.com",  password: "Server@123",  name: "Antonio Verde",  role: "server" },
];

const MENU = [
  // Starters
  { name: "Bruschetta al Pomodoro", description: "Toasted bread with fresh tomatoes, garlic, and basil", price: 7.50,  category: "Starters",     prep_time_minutes: 8,  available: true,  sort_order: 1 },
  { name: "Arancini",               description: "Crispy fried risotto balls stuffed with mozzarella",  price: 8.50,  category: "Starters",     prep_time_minutes: 10, available: true,  sort_order: 2 },
  { name: "Caprese Salad",          description: "Fresh mozzarella, tomatoes, basil, and olive oil",    price: 9.00,  category: "Starters",     prep_time_minutes: 5,  available: true,  sort_order: 3 },
  // Pasta
  { name: "Spaghetti Carbonara",    description: "Classic Roman pasta with egg, pecorino, and guanciale", price: 14.50, category: "Pasta",       prep_time_minutes: 15, available: true,  sort_order: 1 },
  { name: "Penne Arrabbiata",       description: "Penne with spicy tomato sauce, garlic, and parsley",  price: 12.50, category: "Pasta",        prep_time_minutes: 15, available: true,  sort_order: 2 },
  { name: "Tagliatelle al Ragù",    description: "Hand-rolled pasta with slow-cooked Bolognese sauce",  price: 15.00, category: "Pasta",        prep_time_minutes: 18, available: true,  sort_order: 3 },
  // Mains
  { name: "Margherita Pizza",       description: "San Marzano tomatoes, fior di latte, fresh basil",    price: 13.00, category: "Pizza",        prep_time_minutes: 20, available: true,  sort_order: 1 },
  { name: "Diavola Pizza",          description: "Spicy salami, tomato, mozzarella, chili oil",         price: 15.00, category: "Pizza",        prep_time_minutes: 20, available: true,  sort_order: 2 },
  { name: "Quattro Formaggi",       description: "Mozzarella, gorgonzola, parmesan, and taleggio",      price: 16.00, category: "Pizza",        prep_time_minutes: 20, available: false, sort_order: 3 },
  // Desserts
  { name: "Tiramisu",               description: "Classic Italian dessert with mascarpone and espresso", price: 6.50,  category: "Desserts",    prep_time_minutes: 5,  available: true,  sort_order: 1 },
  { name: "Panna Cotta",            description: "Silky vanilla cream with wild berry coulis",           price: 6.00,  category: "Desserts",    prep_time_minutes: 5,  available: true,  sort_order: 2 },
  // Beverages
  { name: "San Pellegrino",         description: "Sparkling mineral water 500ml",                        price: 3.50,  category: "Beverages",   prep_time_minutes: 2,  available: true,  sort_order: 1 },
  { name: "House Red Wine (glass)", description: "Chianti Classico DOC",                                 price: 7.00,  category: "Beverages",   prep_time_minutes: 2,  available: true,  sort_order: 2 },
  { name: "Espresso",               description: "Double shot Italian espresso",                         price: 2.50,  category: "Beverages",   prep_time_minutes: 3,  available: true,  sort_order: 3 },
];

// ── Seed Runner ───────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  console.log("🌱 Starting TableQR seed...\n");

  // 1. Super Admin
  console.log("👑 Creating Super Admin...");
  try {
    const cred = await createUserWithEmailAndPassword(auth, SUPER_ADMIN.email, SUPER_ADMIN.password);
    await setDoc(doc(db, "users", cred.user.uid), {
      email: SUPER_ADMIN.email, name: SUPER_ADMIN.name,
      role: "super_admin", restaurant_id: null,
      active: true, created_at: serverTimestamp(),
    });
    console.log(`   ✅ ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password}`);
  } catch (e) {
    if (e.code === "auth/email-already-in-use") console.log("   ⚠️  Super admin already exists, skipping.");
    else throw e;
  }

  // 2. Restaurant
  console.log("\n🏪 Creating demo restaurant...");
  await setDoc(doc(db, "restaurants", RESTAURANT.id), {
    ...RESTAURANT, created_at: serverTimestamp(),
  });
  console.log(`   ✅ Restaurant ID: ${RESTAURANT.id}`);

  // 3. Menu items
  console.log("\n🍽️  Seeding menu...");
  for (const item of MENU) {
    const ref = doc(collection(db, "restaurants", RESTAURANT.id, "menu"));
    await setDoc(ref, { ...item, id: ref.id, created_at: serverTimestamp() });
    console.log(`   ✅ ${item.name} — $${item.price}`);
  }

  // 4. Staff accounts
  console.log("\n👥 Creating staff accounts...");
  // Need to sign in as super admin first (Auth context)
  await signInWithEmailAndPassword(auth, SUPER_ADMIN.email, SUPER_ADMIN.password);
  for (const member of STAFF) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, member.email, member.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: member.email, name: member.name,
        role: member.role, restaurant_id: RESTAURANT.id,
        active: true, created_at: serverTimestamp(),
      });
      console.log(`   ✅ [${member.role.padEnd(14)}] ${member.email} / ${member.password}`);
    } catch (e) {
      if (e.code === "auth/email-already-in-use") console.log(`   ⚠️  ${member.email} already exists.`);
      else throw e;
    }
  }

  // 5. Summary
  console.log("\n" + "═".repeat(60));
  console.log("✅ SEED COMPLETE — TableQR is ready!\n");
  console.log("CREDENTIALS:");
  console.log(`  Super Admin:   ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password}`);
  STAFF.forEach(s => console.log(`  ${s.role.padEnd(14)} ${s.email} / ${s.password}`));
  console.log("\nCUSTOMER QR URL:");
  const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";
  console.log(`  ${baseUrl}/r/${RESTAURANT.id}?table=1`);
  console.log("═".repeat(60));

  process.exit(0);
}

seed().catch(err => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
