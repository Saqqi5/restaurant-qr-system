import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import AdminLayout from "../components/admin/AdminLayout";
import BranchRequired from "../components/admin/BranchRequired";
import {
  subscribeToMenu, getItemPrice, getItemOriginalPrice, isItemPromoActive,
} from "../config/db";
import { formatPrice, useRestaurantCurrency } from "../utils/currency";

// Staff Menu — a read-only menu for the waiter/server (and the other
// order-taking roles). The server shows a customer the dishes, or checks
// a price, without placing an order. To place an order for a customer,
// use Take Order (/admin/order-taker). Unavailable dishes are shown
// dimmed with a "Not available" label so the server never offers them.
export default function StaffMenuPage() {
  const { userProfile, restaurantId, logout } = useAuth();
  const currency = useRestaurantCurrency(restaurantId);
  const [menuItems, setMenuItems] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!restaurantId || restaurantId === "all") return;
    const unsub = subscribeToMenu(restaurantId, setMenuItems);
    return () => unsub();
  }, [restaurantId]);

  // Group the (already category-sorted) items by category, in order.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? menuItems.filter((it) => (it.name || "").toLowerCase().includes(q))
      : menuItems;
    const out = [];
    for (const it of list) {
      const cat = it.category || "Other";
      let g = out.find((x) => x.category === cat);
      if (!g) { g = { category: cat, items: [] }; out.push(g); }
      g.items.push(it);
    }
    return out;
  }, [menuItems, search]);

  if (restaurantId === "all") {
    return (
      <AdminLayout
        title="Menu"
        subtitle={userProfile?.name || ""}
        onLogout={logout}
        userProfile={userProfile}
      >
        <BranchRequired title="Menu is per branch" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Menu"
      subtitle={userProfile?.name || ""}
      onLogout={logout}
      userProfile={userProfile}
    >
      <div className="staff-menu-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a dish..."
          aria-label="Search menu"
        />
      </div>
      {groups.length === 0 && (
        <p className="empty-state">
          {search ? "No dish matches your search." : "No dishes in the menu yet."}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.category} className="staff-menu-group">
          <h2 className="staff-menu-category">{g.category}</h2>
          <ul className="staff-menu-list">
            {g.items.map((it) => {
              const price = getItemPrice(it);
              const original = getItemOriginalPrice(it);
              const available = it.is_available !== false;
              return (
                <li
                  key={it.id}
                  className={`staff-menu-item${available ? "" : " unavailable"}`}
                >
                  <span className="staff-menu-item-info">
                    <span className="staff-menu-item-name">{it.name}</span>
                    {it.description ? (
                      <span className="staff-menu-item-desc">{it.description}</span>
                    ) : null}
                    {!available && (
                      <span className="staff-menu-item-off">Not available</span>
                    )}
                  </span>
                  <span className="staff-menu-item-price">
                    {original !== null && (
                      <span className="price-was">{formatPrice(original, currency)}</span>
                    )}
                    {isItemPromoActive(it) && <span className="promo-badge">🎉</span>}
                    {formatPrice(price, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </AdminLayout>
  );
}
