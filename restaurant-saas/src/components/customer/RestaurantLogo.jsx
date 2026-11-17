// The restaurant's own mark, everywhere the customer sees its name:
// menu header, cart, My Orders, payment sheet, demo cards. Falls back
// to the name's first letter when no logo was uploaded.
export default function RestaurantLogo({ restaurant, size = 44 }) {
  if (!restaurant) return null;
  if (restaurant.logo_url) {
    return (
      <img
        src={restaurant.logo_url}
        alt={restaurant.name}
        className="restaurant-logo"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="restaurant-logo-monogram"
      style={{ width: size, height: size, fontSize: Math.max(13, Math.round(size * 0.45)) }}
      aria-hidden="true"
    >
      {(restaurant.name || "?").trim()[0]?.toUpperCase()}
    </div>
  );
}
