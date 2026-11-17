export default function RestaurantHeader({ restaurant, tableNumber, modeLabel }) {
  return (
    <header className="restaurant-header">
      <a href="/" className="header-back-btn" aria-label="Back to home">←</a>
      <div className="restaurant-header-inner">
        {restaurant.logo_url ? (
          <img src={restaurant.logo_url} alt={restaurant.name} className="restaurant-logo" />
        ) : (
          <div className="restaurant-logo-monogram" aria-hidden="true">
            {(restaurant.name || "?").trim()[0]?.toUpperCase()}
          </div>
        )}
        <div className="restaurant-info">
          <h1 className="restaurant-name">{restaurant.name}</h1>
          <div className="table-indicator">
            {modeLabel ? (
              <>
                <span className="table-icon">🛵</span>
                <span>{modeLabel}</span>
              </>
            ) : (
              <>
                <span className="table-icon">🪑</span>
                <span>Table {tableNumber}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
