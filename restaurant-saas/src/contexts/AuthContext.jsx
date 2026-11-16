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
import { getUser, createUser, getRestaurant, subscribeToRestaurant, subscribeToUser } from "../config/db";
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await getUser(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const rid = userProfile?.restaurant_id;
    if (!rid || userProfile?.role === "super_admin") {
      setTrialInfo(null);
      return;
    }
    const unsub = subscribeToRestaurant(rid, (doc) => setTrialInfo({ ...getExpiryInfo(doc), plan: doc?.plan, is_frozen: doc?.is_frozen === true }));
    return unsub;
  }, [userProfile?.restaurant_id, userProfile?.role]);

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
    if (profile?.restaurant_id && profile?.role !== "super_admin") {
      const restaurant = await getRestaurant(profile.restaurant_id);
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

  // One-click staff password reset (super admin only). The browser SDK
  // cannot change another user's password, so this calls the Worker
  // endpoint, which uses the Firebase service account. Returns the new
  // password (generated server-side) so the super admin can share it.
  async function resetStaffPassword(staffUid) {
    const token = await currentUser.getIdToken();
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ uid: staffUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Password reset failed.");
    return data.password;
  }

  function hasRole(...roles) {
    return userProfile && roles.includes(userProfile.role);
  }

  function canAccessRestaurant(restaurantId) {
    if (!userProfile) return false;
    if (userProfile.role === "super_admin") return true;
    return userProfile.restaurant_id === restaurantId;
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
    hasRole,
    canAccessRestaurant,
    isAuthenticated: !!currentUser,
    role: userProfile?.role,
    restaurantId: userProfile?.restaurant_id,
    trialInfo,
    trialBlocked,
    accountBlocked,
    frozenBlocked,
    accountDisabled,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
