// Cloudflare Worker for the Restaurant QR System.
// Serves the Vite SPA (static assets) and the /api/admin/* endpoints.
//
// The reset-password endpoint lets ONLY the super admin reset a staff
// member's password with one click. The browser Firebase SDK cannot change
// another user's password, so the Worker does it with a Firebase service
// account — set these two secrets on the Worker (never in the repo):
//   FIREBASE_SERVICE_ACCOUNT_EMAIL — client_email from the service-account JSON
//   FIREBASE_SERVICE_ACCOUNT_KEY   — private_key from the service-account JSON
// NOTE: after (re-)saving these secrets in the dashboard, the Worker must be
// redeployed before the new values are visible to it (redeployed 2026-11-16
// for exactly this reason).
//
// The /api/admin/domain/* endpoints are the one-click custom-domain system
// (super admin only): check a domain's availability + price, BUY it for a
// restaurant through the Cloudflare Registrar API (charged to the account's
// default payment method — non-refundable), and LINK it by attaching the
// domain to this Worker (Cloudflare provisions DNS + SSL automatically),
// then saving the mapping so the menu opens at https://{domain}?table=N.
// They need two more Worker secrets (never in the repo):
//   CLOUDFLARE_API_TOKEN  — token with Account Registrar:Edit, Zone DNS:Edit
//     + Zone:Read, Workers Scripts:Edit
//   CLOUDFLARE_ACCOUNT_ID — the Cloudflare account id
// Until they are set, every domain endpoint answers "not set up yet" and
// nothing is bought or linked.

const FIREBASE_PROJECT_ID = "restaurant-system-d74b1";
const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Short words for memorable generated passwords: word-word-word-1234.
const WORDS = [
  "apple", "river", "mango", "cloud", "tiger", "ocean", "lemon", "eagle",
  "coral", "maple", "falcon", "harbor", "meadow", "rocket", "silver", "velvet",
  "willow", "canyon", "marble", "orchid", "pepper", "quartz", "saffron", "timber",
  "umber", "violet", "walnut", "yonder", "zephyr", "amber", "breeze", "cedar",
  "daisy", "ember", "flint", "grove", "hazel", "ivory", "jasper", "karma",
  "lunar", "minty", "noble", "onyx", "pearl", "raven", "sandy", "topaz",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// CORS for the Capacitor app: the native shell runs on https://localhost
// (Android) or capacitor://localhost (iOS), so its /api/* calls are
// cross-origin. Same-origin web calls never need CORS, but reflecting an
// allowed origin is harmless for them. Only localhost-family origins are
// ever reflected — no other site can call the admin endpoints cross-origin.
const CORS_ALLOWED_ORIGINS = ["https://localhost", "capacitor://localhost"];
function corsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (CORS_ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin === "http://localhost" || origin.startsWith("http://localhost:")) return origin;
  return null;
}
function withCors(request, response) {
  const origin = corsOrigin(request);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function newPassword() {
  const rnd = new Uint32Array(3);
  crypto.getRandomValues(rnd);
  const pick = (i) => WORDS[rnd[i] % WORDS.length];
  return `${pick(0)}-${pick(1)}-${pick(2)}-${1000 + (rnd[0] % 9000)}`;
}

const b64url = (bytes) => {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

// Firebase ID tokens are signed by securetoken.google.com — Google's
// tokeninfo endpoint does NOT accept them (it returns invalid_token).
// Verify the RS256 signature against Google's public keys (JWKS) instead.
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let cachedJwks = null; // { keys, fetchedAtMs }

function b64urlToBytes(s) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function getJwks() {
  if (cachedJwks && Date.now() - cachedJwks.fetchedAtMs < 3600_000) return cachedJwks.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("Could not fetch signing keys.");
  const data = await res.json();
  cachedJwks = { keys: data.keys || [], fetchedAtMs: Date.now() };
  return cachedJwks.keys;
}

// Verify a Firebase ID token: signature (JWKS) + iss/aud/exp checks.
async function verifyIdToken(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  let keys = await getJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Keys rotate — refetch once before giving up.
    cachedJwks = null;
    keys = await getJwks();
    jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
  }
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]),
  );
  if (!valid) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
  if (payload.aud !== FIREBASE_PROJECT_ID) return null;
  if (!payload.sub || (payload.exp * 1000) < Date.now()) return null;
  return { user_id: payload.sub, email: payload.email || null };
}

async function getUserDoc(uid, callerToken) {
  const res = await fetch(`${FIRESTORE_BASE}/users/${uid}`, {
    headers: { Authorization: `Bearer ${callerToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to read user record.");
  const doc = await res.json();
  const f = doc.fields || {};
  return {
    role: f.role?.stringValue || null,
    is_platform_owner: f.is_platform_owner?.booleanValue === true,
    is_demo_user: f.is_demo_user?.booleanValue === true,
    email: f.email?.stringValue || null,
    name: f.name?.stringValue || null,
    restaurant_id: f.restaurant_id?.stringValue || null,
    restaurant_ids: (f.restaurant_ids?.arrayValue?.values || []).map((v) => v.stringValue).filter(Boolean),
  };
}

// ---- Service-account access token (cached in Worker memory) ----
let cachedAccessToken = null; // { token, expiresAtMs }

async function getServiceAccessToken(env) {
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > Date.now() + 60000) {
    return cachedAccessToken.token;
  }
  const email = env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  const key = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  // Granular errors: they name the exact missing secret, so a live probe
  // tells us whether a name is mistyped or the deploy predates the secrets.
  if (!email && !key) {
    throw new Error("Service account is not configured on this Worker yet (both secrets missing).");
  }
  if (!email) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_EMAIL is missing on this Worker.");
  }
  if (!key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing on this Worker.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    sub: email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // The stored key has literal \n escapes — restore real newlines.
  const pem = key.replace(/\\n/g, "\n");
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error("Could not mint a service-account token.");
  const data = await res.json();
  cachedAccessToken = { token: data.access_token, expiresAtMs: Date.now() + data.expires_in * 1000 };
  return cachedAccessToken.token;
}

// Returns { caller, callerDoc, idToken } or a Response error to return.
// Every /api/admin/* endpoint uses this — only the super admin may call them.
async function requireSuperAdmin(request, action = "do this") {
  const auth = request.headers.get("Authorization") || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!idToken) return json({ error: "Sign-in required." }, 401);

  let caller;
  try {
    caller = await verifyIdToken(idToken);
  } catch {
    return json({ error: "Could not verify the sign-in." }, 401);
  }
  if (!caller) return json({ error: "Sign-in expired or invalid. Please sign in again." }, 401);

  let callerDoc;
  try {
    callerDoc = await getUserDoc(caller.user_id, idToken);
  } catch {
    return json({ error: "Could not verify the caller." }, 500);
  }
  if (!callerDoc || callerDoc.role !== "super_admin") {
    return json({ error: `Only the administrator can ${action}.` }, 403);
  }
  return { caller, callerDoc, idToken };
}

async function handleResetPassword(request, env) {
  const admin = await requireSuperAdmin(request, "reset passwords");
  if (admin instanceof Response) return admin;
  const { idToken } = admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const targetUid = typeof body?.uid === "string" ? body.uid.trim() : "";
  if (!targetUid) return json({ error: "Missing staff account." }, 400);

  let targetDoc;
  try {
    targetDoc = await getUserDoc(targetUid, idToken);
  } catch {
    return json({ error: "Could not read the staff account." }, 500);
  }
  if (!targetDoc) return json({ error: "Staff account not found." }, 404);
  if (targetDoc.role === "super_admin" || targetDoc.is_platform_owner || targetDoc.is_demo_user) {
    return json({ error: "This account's password cannot be reset here." }, 403);
  }

  const password = newPassword();
  let accessToken;
  try {
    accessToken = await getServiceAccessToken(env);
  } catch (e) {
    return json({ error: e.message || "Password reset is not set up yet." }, 500);
  }
  // accounts:update with the service-account token. validSince revokes the
  // staff member's existing sessions, so the old password stops working.
  const res = await fetch(`${IDENTITY_TOOLKIT}/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      localId: targetUid,
      password,
      validSince: Math.floor(Date.now() / 1000),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return json({ error: err?.error?.message || "Google rejected the password change." }, 500);
  }
  return json({ ok: true, password });
}

// ── Edit a staff login (SUPER ADMIN ONLY) ─────────────────────────────
// His 2026-11-19 order: a restaurant admin or a branch manager may NOT
// edit staff logins — only the super admin. The browser SDK cannot change
// ANOTHER user's email/name, so the Worker does it with the service
// account: Firebase Auth (email + displayName) and the Firestore users
// doc (email + name + role) together, so the login and the staff record
// never disagree. A mistyped username at creation is fixed here instead
// of delete + recreate.
//   caller: super_admin only. Never a super_admin / platform owner /
//   demo account as the target, and never the caller's own login.
const STAFF_ROLES = ["general_admin", "kitchen", "cash_counter", "server"];

async function handleUpdateStaff(request, env) {
  // SUPER ADMIN ONLY (his 2026-11-19 order — a restaurant admin or a
  // branch manager may NOT edit staff logins). The browser SDK cannot
  // change another user's email/name, so the Worker does it with the
  // service account.
  const admin = await requireSuperAdmin(request, "edit staff logins");
  if (admin instanceof Response) return admin;
  const { idToken } = admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const targetUid = typeof body?.uid === "string" ? body.uid.trim() : "";
  if (!targetUid) return json({ error: "Missing staff account." }, 400);
  if (targetUid === admin.caller.user_id) return json({ error: "You cannot edit your own login here." }, 400);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role.trim() : "";
  if (!name) return json({ error: "Enter a name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!STAFF_ROLES.includes(role)) return json({ error: "Pick a valid role." }, 400);

  let targetDoc;
  try {
    targetDoc = await getUserDoc(targetUid, idToken);
  } catch {
    return json({ error: "Could not read the staff account." }, 500);
  }
  if (!targetDoc) return json({ error: "Staff account not found." }, 404);
  if (targetDoc.role === "super_admin" || targetDoc.is_platform_owner || targetDoc.is_demo_user) {
    return json({ error: "This account cannot be edited here." }, 403);
  }

  let accessToken;
  try {
    accessToken = await getServiceAccessToken(env);
  } catch (e) {
    return json({ error: e.message || "Staff editing is not set up yet." }, 500);
  }
  // 1. Firebase Auth login: email (the username) + display name.
  const res = await fetch(`${IDENTITY_TOOLKIT}/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ localId: targetUid, email, displayName: name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || "";
    if (msg.includes("EMAIL_EXISTS")) return json({ error: "That email is already used by another login." }, 400);
    return json({ error: msg || "Google rejected the change." }, 500);
  }
  // 2. Firestore staff record: same email + name + role.
  try {
    await fsPatch(env, `/users/${targetUid}`, {
      email: { stringValue: email },
      name: { stringValue: name },
      role: { stringValue: role },
    });
  } catch {
    return json({ error: "Login updated, but the staff record could not be saved. Try again." }, 500);
  }
  return json({ ok: true });
}

// ── Custom domains (Cloudflare Registrar + Workers Custom Domains) ──────
// One-click buy & link for a restaurant (Premium feature, super admin
// only). Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID on the Worker;
// until they are set, every endpoint below answers "not set up yet" and
// nothing is bought or linked.
//
//   check → Registrar domain-check: availability + live price.
//   buy   → check again, then POST /registrar/registrations (charged to the
//           account's default payment method — NON-REFUNDABLE), poll until
//           it succeeds, then attach + save the mapping.
//   link  → idempotent finish: attach a domain the customer already owns
//           (or a bought one whose attach never finished). If the domain
//           has no zone in our account yet, the zone is created and the
//           nameservers are returned — the customer sets them at their
//           registrar first, then Link runs again.
//   unlink → detach the domain from the Worker + clear the mapping.
//
// Attach = PUT /accounts/{id}/workers/domains (one call; Cloudflare
// provisions DNS + SSL for the hostname automatically). The app resolves
// the restaurant from Firestore domain_mappings, so the menu opens at
// https://{domain}?table=N with no other change.
const CF_API = "https://api.cloudflare.com/client/v4";
const WORKER_SERVICE = "restaurant-qr-system";

function validDomain(domain) {
  const d = (domain || "").trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/.test(d)) return null;
  if (d.endsWith(".workers.dev")) return null;
  return d;
}

function cfConfig(env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token && !accountId) {
    throw new Error("Custom domains are not set up yet: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are missing on this Worker.");
  }
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is missing on this Worker.");
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is missing on this Worker.");
  return { token, accountId };
}

async function cf(env, method, path, body) {
  const { token } = cfConfig(env);
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = (data.errors || []).map((e) => e.message).join("; ") || `Cloudflare request failed (${res.status}).`;
    throw new Error(msg);
  }
  return data.result;
}

// Firestore REST with the service-account token (bypasses rules — the
// caller was already verified as super admin).
async function fsGet(env, path) {
  const token = await getServiceAccessToken(env);
  const res = await fetch(`${FIRESTORE_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not read the restaurant record.");
  return res.json();
}

async function fsPatch(env, path, fields) {
  const token = await getServiceAccessToken(env);
  const qs = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fetch(`${FIRESTORE_BASE}${path}?${qs}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error("Could not save the restaurant record.");
  return res.json();
}

async function fsCreate(env, path, documentId, fields) {
  const token = await getServiceAccessToken(env);
  const res = await fetch(`${FIRESTORE_BASE}${path}?documentId=${encodeURIComponent(documentId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error("Could not save the domain mapping.");
  return res.json();
}

async function fsDelete(env, path) {
  const token = await getServiceAccessToken(env);
  const res = await fetch(`${FIRESTORE_BASE}${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) throw new Error("Could not remove the domain mapping.");
}

async function getRestaurantDoc(env, restaurantId) {
  const doc = await fsGet(env, `/restaurants/${restaurantId}`);
  if (!doc) return null;
  const f = doc.fields || {};
  return { id: restaurantId, name: f.name?.stringValue || "", custom_domain: f.custom_domain?.stringValue || null };
}

async function saveDomainMapping(env, restaurantId, domain) {
  await fsPatch(env, `/restaurants/${restaurantId}`, { custom_domain: { stringValue: domain } });
  await fsCreate(env, "/domain_mappings", domain, {
    restaurant_id: { stringValue: restaurantId },
    verified: { booleanValue: true },
    created_at: { timestampValue: new Date().toISOString() },
  });
}

async function clearDomainMapping(env, restaurantId, domain) {
  await fsPatch(env, `/restaurants/${restaurantId}`, { custom_domain: { nullValue: null } });
  if (domain) await fsDelete(env, `/domain_mappings/${domain}`);
}

// Zone for a domain in our account (created when missing). A zone that is
// not "active" yet means the nameservers are not set — the caller returns
// them so the customer can set them at their registrar first.
async function ensureZone(env, domain) {
  const { accountId } = cfConfig(env);
  const zones = await cf(env, "GET", `/zones?name=${encodeURIComponent(domain)}`);
  let zone = (zones || [])[0];
  if (!zone) {
    zone = await cf(env, "POST", "/zones", { name: domain, account: { id: accountId }, jump_start: false });
  }
  if (zone.status !== "active") {
    return { needsNameservers: true, nameservers: zone.name_servers || [], zoneStatus: zone.status };
  }
  return { zone };
}

async function attachWorkerDomain(env, domain) {
  const { accountId } = cfConfig(env);
  const existing = await cf(env, "GET", `/accounts/${accountId}/workers/domains`);
  if ((existing || []).some((d) => (d.hostname || "").toLowerCase() === domain)) {
    return { alreadyAttached: true };
  }
  const zone = await ensureZone(env, domain);
  if (zone.needsNameservers) return zone;
  return cf(env, "PUT", `/accounts/${accountId}/workers/domains`, {
    environment: "production",
    hostname: domain,
    service: WORKER_SERVICE,
    zone_id: zone.zone.id,
  });
}

async function parseDomainBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: "Invalid request." };
  }
  const domain = validDomain(body?.domain);
  if (!domain) return { error: "Enter a valid domain, e.g. myrestaurant.com." };
  const restaurantId = typeof body?.restaurantId === "string" ? body.restaurantId.trim() : "";
  return { domain, restaurantId };
}

function domainError(e) {
  return json({ error: e?.message || "Custom domain failed." }, 500);
}

async function handleDomainCheck(request, env) {
  const admin = await requireSuperAdmin(request, "manage custom domains");
  if (admin instanceof Response) return admin;
  const parsed = await parseDomainBody(request);
  if (parsed.error) return json({ error: parsed.error }, 400);
  try {
    const { accountId } = cfConfig(env);
    const result = await cf(env, "POST", `/accounts/${accountId}/registrar/domain-check`, { domains: [parsed.domain] });
    const list = Array.isArray(result) ? result : result?.domains || [];
    const info = list.find((r) => (r.domain_name || "").toLowerCase() === parsed.domain) || list[0];
    if (!info) return json({ error: "Could not check this domain." }, 500);
    const available = info.available ?? info.is_available ?? null;
    const price = info.price ?? info.registration_price ?? info.prices?.registration ?? null;
    return json({
      ok: true,
      domain: parsed.domain,
      available: available === true,
      price: typeof price === "number" ? price : null,
      currency: info.currency || "USD",
      premium: info.premium === true || info.is_premium === true,
    });
  } catch (e) {
    return domainError(e);
  }
}

async function pollRegistration(env, accountId, domain, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const reg = await cf(env, "GET", `/accounts/${accountId}/registrar/registrations/${encodeURIComponent(domain)}`);
    const state = reg?.state || reg?.status;
    if (state === "succeeded" || state === "success") return { state: "succeeded" };
    if (state === "failed" || state === "error") throw new Error("Domain registration failed at the registrar.");
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { state: "pending" };
}

async function handleDomainBuy(request, env) {
  const admin = await requireSuperAdmin(request, "manage custom domains");
  if (admin instanceof Response) return admin;
  const parsed = await parseDomainBody(request);
  if (parsed.error) return json({ error: parsed.error }, 400);
  if (!parsed.restaurantId) return json({ error: "Missing restaurant." }, 400);
  const { domain, restaurantId } = parsed;
  try {
    const { accountId } = cfConfig(env);
    const restaurant = await getRestaurantDoc(env, restaurantId);
    if (!restaurant) return json({ error: "Restaurant not found." }, 404);
    if (restaurant.custom_domain) {
      return json({ error: `This restaurant already has a domain: ${restaurant.custom_domain}. Unlink it first.` }, 400);
    }
    // Fresh price check right before charging — registrations are
    // non-refundable, and a premium name needs explicit approval.
    const check = await cf(env, "POST", `/accounts/${accountId}/registrar/domain-check`, { domains: [domain] });
    const list = Array.isArray(check) ? check : check?.domains || [];
    const info = list.find((r) => (r.domain_name || "").toLowerCase() === domain) || list[0];
    if (info && (info.available === false || info.is_available === false)) {
      return json({ error: "This domain is no longer available." }, 400);
    }
    if (info && (info.premium === true || info.is_premium === true)) {
      return json({ error: "This is a premium domain — buy it from the Cloudflare dashboard, where the price is shown before you pay." }, 400);
    }
    await cf(env, "POST", `/accounts/${accountId}/registrar/registrations`, { domain_name: domain });
    const poll = await pollRegistration(env, accountId, domain);
    if (poll.state !== "succeeded") {
      return json({ ok: true, pending: true, domain, state: poll.state, message: "Registration is still processing at the registrar. Press Link once it completes." });
    }
    const attached = await attachWorkerDomain(env, domain);
    if (attached.needsNameservers) {
      return json({ ok: true, domain, bought: true, needsNameservers: true, nameservers: attached.nameservers, zoneStatus: attached.zoneStatus });
    }
    await saveDomainMapping(env, restaurantId, domain);
    return json({ ok: true, domain, bought: true, attached: true });
  } catch (e) {
    return domainError(e);
  }
}

async function handleDomainLink(request, env) {
  const admin = await requireSuperAdmin(request, "manage custom domains");
  if (admin instanceof Response) return admin;
  const parsed = await parseDomainBody(request);
  if (parsed.error) return json({ error: parsed.error }, 400);
  if (!parsed.restaurantId) return json({ error: "Missing restaurant." }, 400);
  const { domain, restaurantId } = parsed;
  try {
    const restaurant = await getRestaurantDoc(env, restaurantId);
    if (!restaurant) return json({ error: "Restaurant not found." }, 404);
    if (restaurant.custom_domain && restaurant.custom_domain !== domain) {
      return json({ error: `This restaurant already has a domain: ${restaurant.custom_domain}. Unlink it first.` }, 400);
    }
    const attached = await attachWorkerDomain(env, domain);
    if (attached.needsNameservers) {
      return json({ ok: true, domain, needsNameservers: true, nameservers: attached.nameservers, zoneStatus: attached.zoneStatus });
    }
    await saveDomainMapping(env, restaurantId, domain);
    return json({ ok: true, domain, attached: true });
  } catch (e) {
    return domainError(e);
  }
}

async function handleDomainUnlink(request, env) {
  const admin = await requireSuperAdmin(request, "manage custom domains");
  if (admin instanceof Response) return admin;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const restaurantId = typeof body?.restaurantId === "string" ? body.restaurantId.trim() : "";
  if (!restaurantId) return json({ error: "Missing restaurant." }, 400);
  try {
    const restaurant = await getRestaurantDoc(env, restaurantId);
    if (!restaurant) return json({ error: "Restaurant not found." }, 404);
    const domain = restaurant.custom_domain;
    if (!domain) return json({ ok: true, detached: false });
    const { accountId } = cfConfig(env);
    let warning = null;
    try {
      await cf(env, "DELETE", `/accounts/${accountId}/workers/domains/${encodeURIComponent(domain)}`);
    } catch (e) {
      warning = `Cloudflare could not detach the domain: ${e.message}`;
    }
    await clearDomainMapping(env, restaurantId, domain);
    return json({ ok: true, detached: true, domain, warning });
  } catch (e) {
    return domainError(e);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // CORS preflight for /api/* (Capacitor app only — web calls are
    // same-origin and never preflight). Unknown origins get no CORS headers,
    // so the browser blocks them; auth still happens in the handlers.
    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      const origin = corsOrigin(request);
      if (!origin) return json({ error: "Forbidden." }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, content-type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }
    if (url.pathname === "/api/admin/reset-password") {
      if (request.method !== "POST") return withCors(request, json({ error: "Method not allowed." }, 405));
      try {
        return withCors(request, await handleResetPassword(request, env));
      } catch (e) {
        return withCors(request, json({ error: e?.message || "Password reset failed." }, 500));
      }
    }
    if (url.pathname === "/api/admin/update-staff") {
      if (request.method !== "POST") return withCors(request, json({ error: "Method not allowed." }, 405));
      try {
        return withCors(request, await handleUpdateStaff(request, env));
      } catch (e) {
        return withCors(request, json({ error: e?.message || "Staff update failed." }, 500));
      }
    }
    const domainHandlers = {
      "/api/admin/domain/check": handleDomainCheck,
      "/api/admin/domain/buy": handleDomainBuy,
      "/api/admin/domain/link": handleDomainLink,
      "/api/admin/domain/unlink": handleDomainUnlink,
    };
    if (domainHandlers[url.pathname]) {
      if (request.method !== "POST") return withCors(request, json({ error: "Method not allowed." }, 405));
      try {
        return withCors(request, await domainHandlers[url.pathname](request, env));
      } catch (e) {
        return withCors(request, json({ error: e?.message || "Custom domain failed." }, 500));
      }
    }
    // Serve static assets; fall back to index.html for SPA routes.
    // The ASSETS binding THROWS for paths with no matching file (it does
    // not return a 404 and not_found_handling does not cover it), so the
    // single-page fallback has to happen here — otherwise every deep link
    // (/demo, /login, /r/...) dies with Error 1101 while / still works.
    // NOTE: the fallback request must be a PLAIN new Request — copying the
    // original request as init (new Request(url, request)) makes the
    // fallback fetch throw too, which is why /admin/super showed
    // "Site unavailable" even after the first fix deployed.
    // The binding itself must exist: wrangler.toml [assets] needs
    // binding = "ASSETS" or env.ASSETS is undefined on the live Worker.
    try {
      return await env.ASSETS.fetch(request);
    } catch {
      try {
        return await env.ASSETS.fetch(new Request(new URL("/", request.url)));
      } catch {
        return new Response("Site unavailable. Please try again.", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
  },
};
