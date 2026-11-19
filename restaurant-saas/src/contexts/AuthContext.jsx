import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  getAuth,
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { auth, firebaseConfig } from "../config/firebase";
import { getUser, createUser, getRestaurant, subscribeToRestaurant, subscribeToUser, getAccessibleRestaurantIds, getRestaurantsByIds } from "../config/db";
import { getExpiryInfo, formatExpiryDate, getPlanLabel } from "../config/plans";

const AuthContext = createContext(null);

// One message for every disabled login — a disabled staff account and a
// frozen restaurant both show exactly this.
export const ACCOUNT_DISABLED_MESSAGE = "Your account is disabled. Please contact your administrator.";

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Live trial/expiry state of the signed-in user's restaurant (null for
  // the super admin, and for restaurants with no expiry). trialBlocked is
  // true once the period has ended — the login is then blocked until the
  // super admin continues the plan.
  const [trialInfo, setTrialInfo] = useState(null);
  const trialBlocked = trialInfo?.expired === true;
  // Live freeze/disable state. frozenBlocked = the signed-in user's
  // restaurant is frozen by the super admin; accountDisabled = this login
  // itself was disabled. Either one blocks every dashboard (ProtectedRoute)
  // with the disabled message — the super admin is never blocked.
  const frozenBlocked = trialInfo?.is_frozen === true;
  const accountDisabled = userProfile?.is_disabled === true;
  const accountBlocked = frozenBlocked || accountDisabled;

  useEffect(() => {
    // Never hang the whole site on Firebase: if the auth state has not
    // arrived within 5s (slow/blocked network to Firebase), render anyway.
    // The listener stays subscribed, so the user/profile still land when
    // Firebase answers — the landing page just does not wait for it.
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setLoading(false); } };
    const timer = setTimeout(finish, 5000);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await getUser(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      finish();
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, []);

  // ── Multi-branch owner state ──────────────────────────────────────────
  // An owner (general_admin) can run 2+ branches from ONE login: their
  // users doc keeps restaurant_id (first branch) + restaurant_ids (every
  // branch). activeRestaurantId is the branch the dashboards show — a
  // branch id, "all" (combined view), or null (first branch). It persists
  // per user in localStorage. Single-branch users never see the switcher.
  const [activeRestaurantId, setActiveRestaurantIdState] = useState(null);
  const [branches, setBranches] = useState([]);
  const accessibleRestaurantIds = getAccessibleRestaurantIds(userProfile);
  const accessibleKey = accessibleRestaurantIds.join(",");
  const isMultiBranch = accessibleRestaurantIds.length > 1;
  // The branch every dashboard reads: the active one, or the user's own.
  // "all" means the combined All-branches view (Admin dashboard + Order
  // History); single-branch pages show a branch picker for it.
  const activeId = activeRestaurantId || userProfile?.restaurant_id || null;

  // Load the branch docs (names for the switcher) once the owner is known.
  useEffect(() => {
    if (accessibleRestaurantIds.length <= 1) { setBranches([]); return; }
    let live = true;
    getRestaurantsByIds(accessibleRestaurantIds).then((docs) => { if (live) setBranches(docs); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessibleKey]);

  // Restore the saved branch choice on sign-in; fall back to the first
  // branch when the saved one is no longer accessible (e.g. unlinked).
  useEffect(() => {
    if (!userProfile) { setActiveRestaurantIdState(null); return; }
    let saved = null;
    try { saved = localStorage.getItem(`saqlyn_active_restaurant_${userProfile.id}`); } catch { /* ignore */ }
    if (saved === "all" || accessibleRestaurantIds.includes(saved)) setActiveRestaurantIdState(saved);
    else setActiveRestaurantIdState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id, accessibleKey]);

  function setActiveRestaurantId(id) {
    setActiveRestaurantIdState(id || null);
    if (userProfile?.id) {
      try {
        if (id) localStorage.setItem(`saqlyn_active_restaurant_${userProfile.id}`, id);
        else localStorage.removeItem(`saqlyn_active_restaurant_${userProfile.id}`);
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    const rid = activeId;
    if (!rid || rid === "all" || userProfile?.role === "super_admin") {
      setTrialInfo(null);
      return;
    }
    const unsub = subscribeToRestaurant(rid, (doc) => setTrialInfo({ ...getExpiryInfo(doc), plan: doc?.plan, is_frozen: doc?.is_frozen === true }));
    return unsub;
  }, [activeId, userProfile?.role]);

  // Live-watch the signed-in user's own doc: if the super admin disables
  // this login while the user is signed in, the profile updates here and
  // ProtectedRoute blocks them immediately (no re-login needed).
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToUser(currentUser.uid, (doc) => {
      if (doc) setUserProfile(doc);
    });
    return unsub;
  }, [currentUser]);

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUser(result.user.uid);
    // A disabled login may not sign in at all — not even to see a dashboard.
    if (profile?.is_disabled === true) {
      await signOut(auth);
      setUserProfile(null);
      throw new Error(ACCOUNT_DISABLED_MESSAGE);
    }
    // A restaurant frozen by the super admin may not sign in at all.
    // Multi-branch owners skip this login-time block: the block applies
    // per branch instead — when they open a frozen/expired branch, that
    // branch's screen blocks them (with a switcher to their other
    // branches), instead of locking them out of every branch at once.
    const accessible = getAccessibleRestaurantIds(profile);
    if (profile?.restaurant_id && profile?.role !== "super_admin" && accessible.length <= 1) {
      const restaurant = await getRestaurant(profile.restaurant_id);
      // Safety net for a deleted restaurant: the delete disables its
      // staff, but if a login somehow still points at a restaurant that
      // no longer exists, block it here with a clear message instead of
      // landing on an empty dashboard (his 2026-11-19 catch).
      if (!restaurant) {
        await signOut(auth);
        setUserProfile(null);
        throw new Error("This restaurant no longer exists. Please contact your administrator.");
      }
      if (restaurant?.is_frozen === true) {
        await signOut(auth);
        setUserProfile(null);
        throw new Error(ACCOUNT_DISABLED_MESSAGE);
      }
      const info = getExpiryInfo(restaurant);
      if (info.expired) {
        await signOut(auth);
        setUserProfile(null);
        throw new Error(`Your ${getPlanLabel(restaurant?.plan)} plan ended on ${formatExpiryDate(info.expiresAt)}. To continue, please pay the subscription fee and contact the administrator.`);
      }
    }
    setUserProfile(profile);
    return { user: result.user, profile };
  }

  async function logout() {
    await signOut(auth);
    setUserProfile(null);
    setActiveRestaurantIdState(null);
  }

  // Staff registration must NOT sign out the admin creating the account.
  // The old code used the main auth instance, so creating staff signed the
  // creator out and signed in as the new user — and the profile write then
  // failed (the new user is not a super admin), leaving an orphaned Auth
  // account with no staff record. A throwaway second app instance keeps the
  // creator signed in, and the profile is written with the creator's session.
  function getSecondaryAuth() {
    const name = "staff-registration";
    const existing = getApps().find((a) => a.name === name);
    const secondaryApp = existing || initializeApp(firebaseConfig, name);
    return getAuth(secondaryApp);
  }

  async function registerStaff(email, password, name, role, restaurantId) {
    const secondaryAuth = getSecondaryAuth();
    const result = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    try {
      await createUser(result.user.uid, { email, name, role, restaurant_id: restaurantId });
    } finally {
      await signOut(secondaryAuth);
    }
    return result.user;
  }

  // New restaurants get the same 4 staff logins the demo restaurants have
  // (admin / kitchen / cashier / waiter) with the same default passwords.
  // Each account is attempted independently — one failure never blocks the
  // others or the restaurant creation. Returns per-role results.
  const DEFAULT_STAFF = [
    { prefix: "admin", password: "Admin@123", name: "Restaurant Admin", role: "general_admin" },
    { prefix: "kitchen", password: "Kitchen@123", name: "Chef", role: "kitchen" },
    { prefix: "cash", password: "Cash@123", name: "Cashier", role: "cash_counter" },
    { prefix: "server", password: "Server@123", name: "Waiter", role: "server" },
  ];

  async function createDefaultStaff(restaurantId, slug) {
    const domain = `${String(slug || "").replace(/-/g, "")}.com`;
    const results = [];
    for (const s of DEFAULT_STAFF) {
      const email = `${s.prefix}@${domain}`;
      try {
        await registerStaff(email, s.password, s.name, s.role, restaurantId);
        results.push({ ...s, email, ok: true });
      } catch (e) {
        results.push({ ...s, email, ok: false, error: e?.code || e?.message || "failed" });
      }
    }
    return results;
  }

  // Change password for the signed-in user (any role). Re-authenticating
  // with the current password also satisfies Firebase's recent-login
  // requirement. Forgot password is NOT self-service by design: only the
  // super admin resets a forgotten password (delete + recreate the login).
  async function changePassword(currentPassword, newPassword) {
    if (!currentUser?.email) throw new Error("Not signed in.");
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  }

  // Worker API base: the Capacitor app runs on https://localhost, so relative
  // /api/... calls would hit the app itself instead of the Worker. VITE_APP_URL
  // (set in .env for local/Capacitor builds) points them at the live Worker;
  // on the web build it is unset and calls stay same-origin relative.
  const WORKER_API_BASE = (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");

  // One-click staff password reset (super admin only). The browser SDK
  // cannot change another user's password, so this calls the Worker
  // endpoint, which uses the Firebase service account. Returns the new
  // password (generated server-side) so the super admin can share it.
  async function resetStaffPassword(staffUid) {
    const token = await currentUser.getIdToken();
    const res = await fetch(`${WORKER_API_BASE}/api/admin/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ uid: staffUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Password reset failed.");
    return data.password;
  }

  // Generic Worker admin call (super-admin endpoints: custom domains).
  // Returns the parsed JSON; throws with the server's error message.
  async function callWorkerApi(path, body) {
    if (!currentUser) throw new Error("Not signed in.");
    const token = await currentUser.getIdToken();
    const res = await fetch(`${WORKER_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function hasRole(...roles) {
    return userProfile && roles.includes(userProfile.role);
  }

  function canAccessRestaurant(restaurantId) {
    if (!userProfile) return false;
    if (userProfile.role === "super_admin") return true;
    return getAccessibleRestaurantIds(userProfile).includes(restaurantId);
  }

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    logout,
    registerStaff,
    createDefaultStaff,
    changePassword,
    resetStaffPassword,
    callWorkerApi,
    hasRole,
    canAccessRestaurant,
    isAuthenticated: !!currentUser,
    role: userProfile?.role,
    // The branch the dashboards show: the active branch, "all" for the
    // combined view, or the user's own restaurant when nothing is picked.
    restaurantId: activeId,
    activeRestaurantId,
    setActiveRestaurantId,
    accessibleRestaurantIds,
    branches,
    isMultiBranch,
    trialInfo,
    trialBlocked,
    accountBlocked,
    frozenBlocked,
    accountDisabled,
  };

  // While Firebase Auth is still resolving, show a real loading screen
  // (SAQLYN logo + spinner) — NEVER a blank/black screen. A blank screen
  // looks like a dead app. The 5s fallback below caps this wait.
  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#070C0C" }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, color: "#E2F0F0" }}>SAQLYN</div>
          <div className="spinner" />
          <div style={{ fontSize: 14, color: "#8AA8A6" }}>Loading...</div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
