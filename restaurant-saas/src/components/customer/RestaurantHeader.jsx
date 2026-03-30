export default function RestaurantHeader({ restaurant, tableNumber }) {
  return (
    <header className="restaurant-header">
      <div className="restaurant-header-inner">
        {restaurant.logo_url ? (
          <img src={restaurant.logo_url} alt={restaurant.name} className="restaurant-logo" />
        ) : (
          <div className="restaurant-logo-placeholder">🍽️</div>
        )}
        <div className="restaurant-info">
          <h1 className="restaurant-name">{restaurant.name}</h1>
          <div className="table-indicator">
            <span className="table-icon">🪑</span>
            <span>Table {tableNumber}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
