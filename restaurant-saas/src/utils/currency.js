import { useEffect, useState } from "react";
import { subscribeToRestaurant } from "../config/db";

// Format a price for display. "$" keeps 2 decimals; "Rs." shows whole rupees.
export function formatPrice(amount, currency = "$") {
  const value = Number(amount) || 0;
  if (currency === "Rs.") return `Rs. ${Math.round(value).toLocaleString("en-US")}`;
  return `$${value.toFixed(2)}`;
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
