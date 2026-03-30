import { useState, useEffect } from "react";
import { subscribeToRestaurant, getRestaurant } from "../config/db";

/**
 * useRestaurant(restaurantId)
 * ════════════════════════════
 * Subscribes to a restaurant document in real-time.
 * Falls back to a one-time fetch if restaurantId is not yet known.
 */
export function useRestaurant(restaurantId) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToRestaurant(restaurantId, (data) => {
      setRestaurant(data);
      setLoading(false);
      if (!data) setError("Restaurant not found.");
    });
    return unsub;
  }, [restaurantId]);

  return { restaurant, loading, error };
}

/**
 * useAllRestaurants()
 * ════════════════════
 * One-time load of all restaurants. Used by Super Admin.
 */
export function useAllRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { getAllRestaurants } = await import("../config/db");
    const data = await getAllRestaurants();
    setRestaurants(data);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  return { restaurants, loading, refresh, setRestaurants };
}
