/**
 * TableQR — Firebase REST API Seed Script
 * Uses Firebase Auth REST API + Firestore REST API (no SDK needed)
 */

const API_KEY     = "YOUR_FIREBASE_API_KEY";
const PROJECT_ID  = "restaurant-system-d74b1";
const AUTH_URL    = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const FS_BASE     = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Seed Data ─────────────────────────────────────────────────────
// The super admin password is NEVER committed (the old demo password was
// public in this repo — changed 2026-11-14). Pass it when seeding:
//   SUPER_ADMIN_PASSWORD=<password> node scripts/seed-rest.js
const SUPER_ADMIN = {
  email: "superadmin@tableqr.com",
  password: process.env.SUPER_ADMIN_PASSWORD || "CHANGE_ME",
  name: "Platform Admin",
};

const RESTAURANT_ID = "demo_restaurant_001";
const RESTAURANT = {
  id:                RESTAURANT_ID,
  name:              "Bella Italia",
  slug:              "bella-italia",
  table_count:       10,
  logo_url:          null,
  custom_domain:     null,
  theme:             { primary: "#e85d04", accent: "#f48c06" },
  currency:          "$",
  tax_rate:     10,
  discount_rate: 0,
  payment_easypaisa_number: "0300-1234567",
  payment_easypaisa_name: "Bella Italia",
  payment_jazzcash_number: "0311-7654321",
  payment_jazzcash_name: "Bella Italia",
  payment_bank_iban: "PK12 HABB 0000 0012 3456 7890",
  payment_bank_name: "Bella Italia",
  active:            true,
  plan:              "basic",
  plan_expires_at: null,
};

const STAFF = [
  { email: "admin@bellaitalia.com",   password: "Admin@123",   name: "Marco Rossi",   role: "general_admin" },
  { email: "kitchen@bellaitalia.com", password: "Kitchen@123", name: "Chef Luigi",    role: "kitchen" },
  { email: "cash@bellaitalia.com",    password: "Cash@123",    name: "Sofia Bianchi", role: "cash_counter" },
  { email: "server@bellaitalia.com",  password: "Server@123",  name: "Antonio Verde", role: "server" },
];

const MENU = [
  { name: "Bruschetta al Pomodoro", description: "Toasted bread with fresh tomatoes, garlic, and basil",    price: 7.50,  category: "Starters", image_url: "/images/bruschetta.jpg",  prep_time_minutes: 8,  available: true,  sort_order: 1 },
  { name: "Arancini",               description: "Crispy fried risotto balls stuffed with mozzarella",       price: 8.50,  category: "Starters", image_url: "/images/arancini.jpg",  prep_time_minutes: 10, available: true,  sort_order: 2 },
  { name: "Caprese Salad",          description: "Fresh mozzarella, tomatoes, basil, and olive oil",         price: 9.00,  category: "Starters", image_url: "/images/caprese.jpg",  prep_time_minutes: 5,  available: true,  sort_order: 3 },
  { name: "Spaghetti Carbonara",    description: "Classic Roman pasta with egg, pecorino, and guanciale",    price: 14.50, category: "Pasta", image_url: "/images/carbonara.jpg",     prep_time_minutes: 15, available: true,  sort_order: 1 },
  { name: "Penne Arrabbiata",       description: "Penne with spicy tomato sauce, garlic, and parsley",       price: 12.50, category: "Pasta", image_url: "/images/arrabbiata.jpg",     prep_time_minutes: 15, available: true,  sort_order: 2 },
  { name: "Tagliatelle al Ragù",    description: "Hand-rolled pasta with slow-cooked Bolognese sauce",       price: 15.00, category: "Pasta", image_url: "/images/ragu.jpg",     prep_time_minutes: 18, available: true,  sort_order: 3 },
  { name: "Margherita Pizza",       description: "San Marzano tomatoes, fior di latte, fresh basil",         price: 13.00, category: "Pizza", image_url: "/images/margherita.jpg",     prep_time_minutes: 20, available: true,  sort_order: 1 },
  { name: "Diavola Pizza",          description: "Spicy salami, tomato, mozzarella, chili oil",              price: 15.00, category: "Pizza", image_url: "/images/diavola.jpg",     prep_time_minutes: 20, available: true,  sort_order: 2 },
  { name: "Quattro Formaggi",       description: "Mozzarella, gorgonzola, parmesan, and taleggio",           price: 16.00, category: "Pizza", image_url: "/images/quattro-formaggi.jpg",     prep_time_minutes: 20, available: true, sort_order: 3 },
  { name: "Tiramisu",               description: "Classic Italian dessert with mascarpone and espresso",      price: 6.50,  category: "Desserts", image_url: "/images/tiramisu.jpg",  prep_time_minutes: 5,  available: true,  sort_order: 1 },
  { name: "Panna Cotta",            description: "Silky vanilla cream with wild berry coulis",                price: 6.00,  category: "Desserts", image_url: "/images/panna-cotta.jpg",  prep_time_minutes: 5,  available: true,  sort_order: 2 },
  { name: "San Pellegrino",         description: "Sparkling mineral water 500ml",                             price: 3.50,  category: "Beverages", image_url: "/images/san-pellegrino.jpg", prep_time_minutes: 2,  available: true,  sort_order: 1 },
  { name: "House Red Wine (glass)", description: "Chianti Classico DOC",                                      price: 7.00,  category: "Beverages", image_url: "/images/red-wine.jpg", prep_time_minutes: 2,  available: true,  sort_order: 2 },
  { name: "Espresso",               description: "Double shot Italian espresso",                               price: 2.50,  category: "Beverages", image_url: "/images/espresso.jpg", prep_time_minutes: 3,  available: true,  sort_order: 3 },
];


// ── Pakistani demo restaurant (Lahori Dastarkhwan) ─────────────────
const RESTAURANT2_ID = "demo_restaurant_002";
const RESTAURANT2 = {
  id:                RESTAURANT2_ID,
  name:              "Lahori Dastarkhwan",
  slug:              "lahori-dastarkhwan",
  table_count:       10,
  logo_url:          null,
  custom_domain:     null,
  theme:             { primary: "#2d6a4f", accent: "#52b788" },
  currency:          "Rs.",
  tax_rate:     16,
  discount_rate: 0,
  payment_easypaisa_number: "0300-1234567",
  payment_easypaisa_name: "Lahori Dastarkhwan",
  payment_jazzcash_number: "0311-7654321",
  payment_jazzcash_name: "Lahori Dastarkhwan",
  payment_bank_iban: "PK12 HABB 0000 0012 3456 7890",
  payment_bank_name: "Lahori Dastarkhwan",
  active:            true,
  plan:              "basic",
  plan_expires_at: null,
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

// ── Helpers ────────────────────────────────────────────────────────

// Convert a JS value to Firestore REST field format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean")          return { booleanValue: val };
  if (typeof val === "number")           return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string")           return { stringValue: val };
  if (typeof val === "object" && !Array.isArray(val)) {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

async function createUser(email, password) {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) {
    if (data.error.message === "EMAIL_EXISTS") return { existed: true, localId: null };
    throw new Error(`Auth error for ${email}: ${data.error.message}`);
  }
  return { existed: false, localId: data.localId, idToken: data.idToken };
}

async function writeDocument(path, fields, idToken) {
  const url = `${FS_BASE}/${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Firestore error at ${path}: ${JSON.stringify(data.error)}`);
  return data;
}

async function addDocument(collectionPath, fields, idToken) {
  const url = `${FS_BASE}/${collectionPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Firestore error at ${collectionPath}: ${JSON.stringify(data.error)}`);
  return data;
}

// Sign in to get an idToken (needed for authenticated Firestore writes)
async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Sign-in error: ${data.error.message}`);
  return data.idToken;
}

// ── Seed Runner ────────────────────────────────────────────────────
async function seed() {
  console.log("🌱 Starting TableQR seed...\n");

  // 1. Super Admin
  console.log("👑 Creating Super Admin...");
  const saResult = await createUser(SUPER_ADMIN.email, SUPER_ADMIN.password);
  if (saResult.existed) {
    console.log("   ⚠️  Auth user already exists, signing in...");
  }
  const superAdminToken = saResult.existed
    ? await signIn(SUPER_ADMIN.email, SUPER_ADMIN.password)
    : saResult.idToken;
  const saUid = saResult.existed
    ? (await (async () => {
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: superAdminToken }),
        });
        return (await r.json()).users[0].localId;
      })())
    : saResult.localId;

  // Always upsert the Firestore doc (handles the case where auth existed but doc was missing)
  await writeDocument(`users/${saUid}`, toFirestoreFields({
    email: SUPER_ADMIN.email,
    name: SUPER_ADMIN.name,
    role: "super_admin",
    restaurant_id: null,
    active: true,
  }), superAdminToken);
  console.log(`   ✅ ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password} (uid: ${saUid})`);

  // 2. Restaurant
  console.log("\n🏪 Creating demo restaurant...");
  const { id, ...restaurantData } = RESTAURANT;
  await writeDocument(`restaurants/${RESTAURANT_ID}`, toFirestoreFields({
    ...restaurantData,
    id: RESTAURANT_ID,
  }), superAdminToken);
  console.log(`   ✅ Restaurant ID: ${RESTAURANT_ID}`);

  // 3. Menu items
  console.log("\n🍽️  Seeding menu...");
  for (const item of MENU) {
    const doc = await addDocument(
      `restaurants/${RESTAURANT_ID}/menu`,
      toFirestoreFields(item),
      superAdminToken
    );
    const docId = doc.name.split("/").pop();
    // Patch the id field into the doc
    await writeDocument(
      `restaurants/${RESTAURANT_ID}/menu/${docId}`,
      toFirestoreFields({ ...item, id: docId }),
      superAdminToken
    );
    console.log(`   ✅ ${item.name} — $${item.price}`);
  }

  // 4. Staff accounts
  console.log("\n👥 Creating staff accounts...");
  // Re-fetch super admin token once for all staff writes
  const saWriteToken = await signIn(SUPER_ADMIN.email, SUPER_ADMIN.password);
  for (const member of STAFF) {
    const result = await createUser(member.email, member.password);
    if (result.existed) {
      console.log(`   ⚠️  ${member.email} auth exists, ensuring Firestore doc...`);
    }
    // Resolve UID: use result.localId when newly created, otherwise look up via token
    let memberUid = result.localId;
    if (!memberUid) {
      const memberToken = await signIn(member.email, member.password);
      const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: memberToken }),
      });
      memberUid = (await lookupRes.json()).users[0].localId;
    }
    // Always upsert the Firestore doc (idempotent)
    await writeDocument(`users/${memberUid}`, toFirestoreFields({
      email: member.email,
      name: member.name,
      role: member.role,
      restaurant_id: RESTAURANT_ID,
      active: true,
    }), saWriteToken);
    console.log(`   ✅ [${member.role.padEnd(14)}] ${member.email} / ${member.password}`);
  }


  // 4b. Pakistani demo restaurant (Lahori Dastarkhwan) — Bella Italia stays as-is
  console.log("\n🏪 Creating Pakistani demo restaurant...");
  await writeDocument(`restaurants/${RESTAURANT2_ID}`, toFirestoreFields({
    ...RESTAURANT2,
  }), saWriteToken);
  console.log(`   ✅ Restaurant ID: ${RESTAURANT2_ID}`);

  console.log("\n🍽️  Seeding Pakistani menu...");
  for (const item of MENU2) {
    const doc = await addDocument(
      `restaurants/${RESTAURANT2_ID}/menu`,
      toFirestoreFields(item),
      saWriteToken
    );
    const docId = doc.name.split("/").pop();
    await writeDocument(
      `restaurants/${RESTAURANT2_ID}/menu/${docId}`,
      toFirestoreFields({ ...item, id: docId }),
      saWriteToken
    );
    console.log(`   ✅ ${item.name} — Rs. ${item.price}`);
  }

  console.log("\n👥 Creating Pakistani staff accounts...");
  for (const member of STAFF2) {
    const result = await createUser(member.email, member.password);
    if (result.existed) {
      console.log(`   ⚠️  ${member.email} auth exists, ensuring Firestore doc...`);
    }
    let memberUid = result.localId;
    if (!memberUid) {
      const memberToken = await signIn(member.email, member.password);
      const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: memberToken }),
      });
      memberUid = (await lookupRes.json()).users[0].localId;
    }
    await writeDocument(`users/${memberUid}`, toFirestoreFields({
      email: member.email,
      name: member.name,
      role: member.role,
      restaurant_id: RESTAURANT2_ID,
      active: true,
    }), saWriteToken);
    console.log(`   ✅ [${member.role.padEnd(14)}] ${member.email} / ${member.password}`);
  }

  // 5. Summary
  console.log("\n" + "═".repeat(60));
  console.log("✅ SEED COMPLETE — TableQR is ready!\n");
  console.log("CREDENTIALS:");
  console.log(`  Super Admin:    ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password}`);
  STAFF.forEach(s => console.log(`  ${s.role.padEnd(15)} ${s.email} / ${s.password}`));
  STAFF2.forEach(s => console.log(`  ${s.role.padEnd(15)} ${s.email} / ${s.password}`));
  console.log("\nCUSTOMER QR URL:");
  console.log(`  http://localhost:5000/r/${RESTAURANT_ID}?table=1`);
  console.log(`  http://localhost:5000/r/${RESTAURANT2_ID}?table=1`);
  console.log("═".repeat(60));
}

seed().catch(err => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
