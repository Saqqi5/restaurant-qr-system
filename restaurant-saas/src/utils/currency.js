import { useEffect, useState } from "react";
import { subscribeToRestaurant } from "../config/db";

// Format a price for display. "Rs." shows whole rupees; every other symbol
// keeps 2 decimals (multi-letter codes like AED/SR get a space after them).
export function formatPrice(amount, currency = "$") {
  const value = Number(amount) || 0;
  const symbol = currency || "$";
  if (symbol === "Rs.") return `Rs. ${Math.round(value).toLocaleString("en-US")}`;
  const sep = symbol.length > 1 ? " " : "";
  return `${symbol}${sep}${value.toFixed(2)}`;
}

// Live currency for a staff-side page that only knows the restaurant id.
export function useRestaurantCurrency(restaurantId) {
  const [currency, setCurrency] = useState("$");
  useEffect(() => {
    if (!restaurantId) return;
    return subscribeToRestaurant(restaurantId, (data) => setCurrency(data?.currency || "$"));
  }, [restaurantId]);
  return currency;
}
