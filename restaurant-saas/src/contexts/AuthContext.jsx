import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { getUser, createUser } from "../config/db";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUser(result.user.uid);
    setUserProfile(profile);
    return { user: result.user, profile };
  }

  async function logout() {
    await signOut(auth);
    setUserProfile(null);
  }

  async function registerStaff(email, password, name, role, restaurantId) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createUser(result.user.uid, { email, name, role, restaurant_id: restaurantId });
    return result.user;
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
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
    resetPassword,
    hasRole,
    canAccessRestaurant,
    isAuthenticated: !!currentUser,
    role: userProfile?.role,
    restaurantId: userProfile?.restaurant_id,
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
