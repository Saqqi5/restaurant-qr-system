// Cloudflare Worker for the Restaurant QR System.
// Serves the Vite SPA (static assets) and the /api/admin/* endpoints.
//
// The reset-password endpoint lets ONLY the super admin reset a staff
// member's password with one click. The browser Firebase SDK cannot change
// another user's password, so the Worker does it with a Firebase service
// account — set these two secrets on the Worker (never in the repo):
//   FIREBASE_SERVICE_ACCOUNT_EMAIL — client_email from the service-account JSON
//   FIREBASE_SERVICE_ACCOUNT_KEY   — private_key from the service-account JSON

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
  if (!email || !key) {
    throw new Error("Service account is not configured on this Worker yet.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    sub: email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/identitytoolkit",
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

async function handleResetPassword(request, env) {
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
    return json({ error: "Only the super admin can reset passwords." }, 403);
  }

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/admin/reset-password") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      try {
        return await handleResetPassword(request, env);
      } catch (e) {
        return json({ error: e?.message || "Password reset failed." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
