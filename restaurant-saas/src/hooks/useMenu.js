import { useState, useEffect } from "react";
import { subscribeToMenu } from "../config/db";

export function useMenu(restaurantId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    const unsub = subscribeToMenu(restaurantId, (data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, [restaurantId]);

  const categories = [...new Set(items.map(i => i.category))];
  const available = items.filter(i => i.available);

  return { items, available, categories, loading };
}
