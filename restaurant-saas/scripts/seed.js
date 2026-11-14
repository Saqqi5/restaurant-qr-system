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
  currency:     "$",
  tax_rate:     10,
  discount_rate: 0,
  payment_easypaisa_number: "0300-1234567",
  payment_easypaisa_name: "Saqlyn Payments",
  payment_jazzcash_number: "0311-7654321",
  payment_jazzcash_name: "Saqlyn Payments",
  payment_bank_iban: "PK12 HABB 0000 0012 3456 7890",
  payment_bank_name: "Saqlyn Restaurant Ltd",
  payment_easypaisa_number: "0300-1234567",
  payment_easypaisa_name: "Saqlyn Payments",
  payment_jazzcash_number: "0311-7654321",
  payment_jazzcash_name: "Saqlyn Payments",
  payment_bank_iban: "PK12 HABB 0000 0012 3456 7890",
  payment_bank_name: "Saqlyn Restaurant Ltd",
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
  { name: "Bruschetta al Pomodoro", description: "Toasted bread with fresh tomatoes, garlic, and basil", price: 7.50,  category: "Starters", image_url: "/images/bruschetta.jpg",     prep_time_minutes: 8,  available: true,  sort_order: 1 },
  { name: "Arancini",               description: "Crispy fried risotto balls stuffed with mozzarella",  price: 8.50,  category: "Starters", image_url: "/images/arancini.jpg",     prep_time_minutes: 10, available: true,  sort_order: 2 },
  { name: "Caprese Salad",          description: "Fresh mozzarella, tomatoes, basil, and olive oil",    price: 9.00,  category: "Starters", image_url: "/images/caprese.jpg",     prep_time_minutes: 5,  available: true,  sort_order: 3 },
  // Pasta
  { name: "Spaghetti Carbonara",    description: "Classic Roman pasta with egg, pecorino, and guanciale", price: 14.50, category: "Pasta", image_url: "/images/carbonara.jpg",       prep_time_minutes: 15, available: true,  sort_order: 1 },
  { name: "Penne Arrabbiata",       description: "Penne with spicy tomato sauce, garlic, and parsley",  price: 12.50, category: "Pasta", image_url: "/images/arrabbiata.jpg",        prep_time_minutes: 15, available: true,  sort_order: 2 },
  { name: "Tagliatelle al Ragù",    description: "Hand-rolled pasta with slow-cooked Bolognese sauce",  price: 15.00, category: "Pasta", image_url: "/images/ragu.jpg",        prep_time_minutes: 18, available: true,  sort_order: 3 },
  // Mains
  { name: "Margherita Pizza",       description: "San Marzano tomatoes, fior di latte, fresh basil",    price: 13.00, category: "Pizza", image_url: "/images/margherita.jpg",        prep_time_minutes: 20, available: true,  sort_order: 1 },
  { name: "Diavola Pizza",          description: "Spicy salami, tomato, mozzarella, chili oil",         price: 15.00, category: "Pizza", image_url: "/images/diavola.jpg",        prep_time_minutes: 20, available: true,  sort_order: 2 },
  { name: "Quattro Formaggi",       description: "Mozzarella, gorgonzola, parmesan, and taleggio",      price: 16.00, category: "Pizza", image_url: "/images/quattro-formaggi.jpg",        prep_time_minutes: 20, available: true, sort_order: 3 },
  // Desserts
  { name: "Tiramisu",               description: "Classic Italian dessert with mascarpone and espresso", price: 6.50,  category: "Desserts", image_url: "/images/tiramisu.jpg",    prep_time_minutes: 5,  available: true,  sort_order: 1 },
  { name: "Panna Cotta",            description: "Silky vanilla cream with wild berry coulis",           price: 6.00,  category: "Desserts", image_url: "/images/panna-cotta.jpg",    prep_time_minutes: 5,  available: true,  sort_order: 2 },
  // Beverages
  { name: "San Pellegrino",         description: "Sparkling mineral water 500ml",                        price: 3.50,  category: "Beverages", image_url: "/images/san-pellegrino.jpg",   prep_time_minutes: 2,  available: true,  sort_order: 1 },
  { name: "House Red Wine (glass)", description: "Chianti Classico DOC",                                 price: 7.00,  category: "Beverages", image_url: "/images/red-wine.jpg",   prep_time_minutes: 2,  available: true,  sort_order: 2 },
  { name: "Espresso",               description: "Double shot Italian espresso",                         price: 2.50,  category: "Beverages", image_url: "/images/espresso.jpg",   prep_time_minutes: 3,  available: true,  sort_order: 3 },
];


// ── Pakistani demo restaurant (Lahori Dastarkhwan) ─────────────────
const RESTAURANT2_ID = "demo_restaurant_002";
const RESTAURANT2 = {
  id:                RESTAURANT2_ID,
  name:              "Lahori Dastarkhwan",
  slug:              "lahori-dastarkhwan",
  table_count:       12,
  logo_url:          null,
  custom_domain:     null,
  theme:             { primary: "#2d6a4f", accent: "#52b788" },
  currency:          "Rs.",
  tax_rate:     16,
  discount_rate: 0,
  active:            true,
  plan:              "saas",
};

const STAFF2 = [
  { email: "admin@lahoridastarkhwan.com",   password: "Admin@123",   name: "Ahmed Raza",  role: "general_admin" },
  { email: "kitchen@lahoridastarkhwan.com", password: "Kitchen@123", name: "Chef Bilal",  role: "kitchen" },
  { email: "cash@lahoridastarkhwan.com",    password: "Cash@123",    name: "Fatima Khan", role: "cash_counter" },
  { email: "server@lahoridastarkhwan.com",  password: "Server@123",  name: "Usman Ali",   role: "server" },
];

const MENU2 = [
  // Starters
  { name: "Samosa Chaat",       description: "Crispy samosa topped with chana, yogurt, chutneys and sev", price: 250,  category: "Starters", image_url: "/images/samosa-chaat.jpg", prep_time_minutes: 8,  available: true,  sort_order: 1 },
  { name: "Dahi Bhalla",        description: "Soft lentil dumplings in yogurt with tamarind chutney",     price: 300,  category: "Starters", image_url: "/images/dahi-bhalla.jpg", prep_time_minutes: 8,  available: true,  sort_order: 2 },
  // BBQ
  { name: "Chicken Tikka (Leg)", description: "Charcoal-grilled chicken leg, desi masala, lemon and onion", price: 550, category: "BBQ", image_url: "/images/tikka.jpg",      prep_time_minutes: 20, available: true,  sort_order: 1 },
  { name: "Seekh Kabab (4 pc)",  description: "Hand-minced beef kabab, smoky, with naan and raita",       price: 500,  category: "BBQ", image_url: "/images/seekh-kabab.jpg",      prep_time_minutes: 15, available: true,  sort_order: 2 },
  { name: "Chapli Kabab (2 pc)", description: "Peshawari-style flat kabab, tomato, onion, green chilli",   price: 350,  category: "BBQ", image_url: "/images/chapli-kabab.jpg",      prep_time_minutes: 12, available: true,  sort_order: 3 },
  { name: "Malai Boti",          description: "Creamy, mild chicken boti, grilled over charcoal",           price: 650,  category: "BBQ", image_url: "/images/malai-boti.jpg",      prep_time_minutes: 18, available: true,  sort_order: 4 },
  // Desi
  { name: "Chicken Biryani",     description: "Fragrant basmati, chicken, aloo bukhara, raita and salad",   price: 450,  category: "Desi", image_url: "/images/biryani.jpg",     prep_time_minutes: 15, available: true,  sort_order: 1 },
  { name: "Beef Nihari",         description: "Slow-cooked beef shank stew, ginger, lemon, green chilli",   price: 850,  category: "Desi", image_url: "/images/nihari.jpg",     prep_time_minutes: 25, available: true,  sort_order: 2 },
  { name: "Chicken Karahi (Half)", description: "Desi ghee karahi, tomato, ginger, green chilli",          price: 900,  category: "Desi", image_url: "/images/karahi.jpg",     prep_time_minutes: 20, available: true,  sort_order: 3 },
  { name: "Chicken Karahi (Full)", description: "Desi ghee karahi, tomato, ginger, green chilli",          price: 1650, category: "Desi", image_url: "/images/karahi.jpg",     prep_time_minutes: 25, available: true,  sort_order: 4 },
  { name: "Daal Fry",            description: "Yellow daal with garlic tarka, rice or naan",                price: 300,  category: "Desi", image_url: "/images/daal-fry.jpg",     prep_time_minutes: 12, available: true,  sort_order: 5 },
  { name: "Tawa Qeema",          description: "Spiced minced beef on tawa, green chilli and coriander",     price: 700,  category: "Desi", image_url: "/images/tawa-qeema.jpg",     prep_time_minutes: 18, available: true,  sort_order: 6 },
  { name: "Mix Sabzi",           description: "Seasonal vegetables, light masala",                          price: 350,  category: "Desi", image_url: "/images/mix-sabzi.jpg",     prep_time_minutes: 12, available: true,  sort_order: 7 },
  // Breads
  { name: "Naan",                description: "Tandoor-baked plain naan",                                   price: 40,   category: "Breads", image_url: "/images/naan.jpg",   prep_time_minutes: 5,  available: true,  sort_order: 1 },
  { name: "Roghni Naan",         description: "Sesame-topped soft naan",                                    price: 80,   category: "Breads", image_url: "/images/naan.jpg",   prep_time_minutes: 5,  available: true,  sort_order: 2 },
  { name: "Garlic Naan",         description: "Naan brushed with garlic butter",                            price: 120,  category: "Breads", image_url: "/images/naan.jpg",   prep_time_minutes: 5,  available: true,  sort_order: 3 },
  // Desserts
  { name: "Gulab Jamun (2 pc)",  description: "Warm syrup-soaked jamun",                                    price: 150,  category: "Desserts", image_url: "/images/gulab-jamun.jpg", prep_time_minutes: 5,  available: true,  sort_order: 1 },
  { name: "Kheer",               description: "Slow-cooked rice pudding, cardamom and pistachio",            price: 180,  category: "Desserts", image_url: "/images/kheer.jpg", prep_time_minutes: 5,  available: true,  sort_order: 2 },
  { name: "Rasmalai",            description: "Soft cheese discs in chilled saffron milk",                   price: 200,  category: "Desserts", image_url: "/images/rasmalai.jpg", prep_time_minutes: 5,  available: true,  sort_order: 3 },
  // Beverages
  { name: "Sweet Lassi",         description: "Thick yogurt lassi, sweetened",                               price: 150,  category: "Beverages", image_url: "/images/sweet-lassi.jpg", prep_time_minutes: 3,  available: true,  sort_order: 1 },
  { name: "Kashmiri Chai",       description: "Pink tea with crushed nuts",                                   price: 120,  category: "Beverages", image_url: "/images/kashmiri-chai.jpg", prep_time_minutes: 8,  available: true,  sort_order: 2 },
  { name: "Doodh Patti",         description: "Slow-brewed milky chai",                                       price: 100,  category: "Beverages", image_url: "/images/doodh-patti.jpg", prep_time_minutes: 8,  available: true,  sort_order: 3 },
  { name: "Soft Drink",          description: "Chilled soft drink 345ml",                                     price: 120,  category: "Beverages", image_url: "/images/soft-drink.jpg", prep_time_minutes: 2,  available: true,  sort_order: 4 },
  { name: "Mineral Water",       description: "Mineral water 500ml",                                          price: 60,   category: "Beverages", image_url: "/images/mineral-water.jpg", prep_time_minutes: 2,  available: true,  sort_order: 5 },
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


  // 4b. Pakistani demo restaurant (Lahori Dastarkhwan) — Bella Italia stays as-is
  console.log("\n🏪 Creating Pakistani demo restaurant...");
  await signInWithEmailAndPassword(auth, SUPER_ADMIN.email, SUPER_ADMIN.password);
  await setDoc(doc(db, "restaurants", RESTAURANT2.id), {
    ...RESTAURANT2, created_at: serverTimestamp(),
  });
  console.log(`   ✅ Restaurant ID: ${RESTAURANT2.id}`);

  console.log("\n🍽️  Seeding Pakistani menu...");
  for (const item of MENU2) {
    const ref = doc(collection(db, "restaurants", RESTAURANT2.id, "menu"));
    await setDoc(ref, { ...item, id: ref.id, created_at: serverTimestamp() });
    console.log(`   ✅ ${item.name} — Rs. ${item.price}`);
  }

  console.log("\n👥 Creating Pakistani staff accounts...");
  for (const member of STAFF2) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, member.email, member.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: member.email, name: member.name,
        role: member.role, restaurant_id: RESTAURANT2.id,
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
  STAFF2.forEach(s => console.log(`  ${s.role.padEnd(14)} ${s.email} / ${s.password}`));
  console.log("\nCUSTOMER QR URL:");
  const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";
  console.log(`  ${baseUrl}/r/${RESTAURANT.id}?table=1`);
  console.log(`  ${baseUrl}/r/${RESTAURANT2.id}?table=1`);
  console.log("═".repeat(60));

  process.exit(0);
}

seed().catch(err => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
