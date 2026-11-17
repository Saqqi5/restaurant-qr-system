import RestaurantLogo from "./RestaurantLogo";

export default function RestaurantHeader({ restaurant, tableNumber, modeLabel, hideIndicator }) {
  return (
    <header className="restaurant-header">
      <a href="/" className="header-back-btn" aria-label="Back to home">←</a>
      <div className="restaurant-header-inner">
        <RestaurantLogo restaurant={restaurant} size={44} />
        <div className="restaurant-info">
          <h1 className="restaurant-name">{restaurant.name}</h1>
          {!hideIndicator && (
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
          )}
        </div>
      </div>
    </header>
  );
}
