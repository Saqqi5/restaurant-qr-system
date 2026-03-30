import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToMenu, subscribeToOrders,
  createMenuItem, updateMenuItem, deleteMenuItem,
  getRestaurantUsers
} from "../config/db";
import { storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import AdminLayout from "../components/admin/AdminLayout";
import MenuItemModal from "../components/admin/MenuItemModal";
import OrdersTable from "../components/admin/OrdersTable";
import StatsBar from "../components/admin/StatsBar";
import StaffModal from "../components/admin/StaffModal";
import QRModal from "../components/admin/QRModal";
import AnalyticsPanel from "../components/admin/AnalyticsPanel";

const TABS = ["menu", "orders", "analytics", "staff", "qr"];

export default function GeneralAdminDashboard() {
  const { userProfile, restaurantId, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("menu");
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    const unsubMenu = subscribeToMenu(restaurantId, (items) => {
      setMenuItems(items);
      setLoading(false);
    });
    const unsubOrders = subscribeToOrders(restaurantId, (data) => {
      setOrders(data);
    });
    getRestaurantUsers(restaurantId).then(setStaff);
    return () => { unsubMenu(); unsubOrders(); };
  }, [restaurantId]);

  async function handleSaveItem(formData, imageFile) {
    let image_url = formData.image_url;
    if (imageFile) {
      const storageRef = ref(storage, `restaurants/${restaurantId}/menu/${Date.now()}_${imageFile.name}`);
      const snapshot = await uploadBytes(storageRef, imageFile);
      image_url = await getDownloadURL(snapshot.ref);
    }
    const data = { ...formData, image_url };

    if (editingItem) {
      await updateMenuItem(restaurantId, editingItem.id, data);
      setMenuItems((prev) => prev.map((i) => i.id === editingItem.id ? { ...i, ...data } : i));
    } else {
      const newItem = await createMenuItem(restaurantId, data);
      setMenuItems((prev) => [...prev, newItem]);
    }
    setShowItemModal(false);
    setEditingItem(null);
  }

  async function handleDeleteItem(itemId) {
    if (!confirm("Delete this menu item?")) return;
    await deleteMenuItem(restaurantId, itemId);
    setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function handleEditItem(item) {
    setEditingItem(item);
    setShowItemModal(true);
  }

  const todayOrders = orders.filter((o) => {
    const today = new Date();
    const orderDate = o.created_at?.toDate?.() || new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const todayRevenue = todayOrders
    .filter((o) => o.payment_status === "paid")
    .reduce((s, o) => s + (o.total || 0), 0);

  const pendingOrders = orders.filter((o) =>
    ["pending", "confirmed", "preparing"].includes(o.status)
  ).length;

  const categories = [...new Set(menuItems.map((i) => i.category))];

  return (
    <AdminLayout
      title="Restaurant Admin"
      subtitle={userProfile?.name || "General Admin"}
      onLogout={logout}
      userProfile={userProfile}
    >
      <StatsBar stats={[
        { label: "Menu Items", value: menuItems.length, icon: "🍽️" },
        { label: "Today's Orders", value: todayOrders.length, icon: "📋" },
        { label: "Today's Revenue", value: `$${todayRevenue.toFixed(2)}`, icon: "💰" },
        { label: "Pending Orders", value: pendingOrders, icon: "⏳", alert: pendingOrders > 5 },
      ]} />

      {/* Tab Navigation */}
      <div className="tab-nav">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "orders" && pendingOrders > 0 && (
              <span className="badge-alert">{pendingOrders}</span>
            )}
          </button>
        ))}
      </div>

      {/* Menu Tab */}
      {activeTab === "menu" && (
        <div className="tab-content">
          <div className="content-header">
            <h3>Menu Management</h3>
            <button className="btn-primary" onClick={() => { setEditingItem(null); setShowItemModal(true); }}>
              + Add Item
            </button>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="menu-category-section">
              <h4 className="category-label">{cat}</h4>
              <div className="menu-items-list">
                {menuItems.filter((i) => i.category === cat).map((item) => (
                  <div key={item.id} className={`menu-item-row ${!item.available ? "unavailable" : ""}`}>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="item-thumb" />
                    )}
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-desc">{item.description}</span>
                      <div className="item-meta">
                        <span className="item-price">${item.price?.toFixed(2)}</span>
                        <span className="item-prep">⏱ {item.prep_time_minutes}min</span>
                        <span className={`item-status ${item.available ? "available" : "sold-out"}`}>
                          {item.available ? "Available" : "Sold Out"}
                        </span>
                      </div>
                    </div>
                    <div className="item-actions">
                      <button className="btn-icon" onClick={() => handleEditItem(item)}>✏️</button>
                      <button className="btn-icon btn-danger" onClick={() => handleDeleteItem(item.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {menuItems.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">🍽️</div>
              <h3>No menu items yet</h3>
              <p>Add your first menu item to get started.</p>
              <button className="btn-primary" onClick={() => setShowItemModal(true)}>
                Add First Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="tab-content">
          <OrdersTable orders={orders} restaurantId={restaurantId} showActions={false} />
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="tab-content">
          <AnalyticsPanel orders={orders} menuItems={menuItems} />
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === "staff" && (
        <div className="tab-content">
          <div className="content-header">
            <h3>Staff Management</h3>
            <button className="btn-primary" onClick={() => setShowStaffModal(true)}>
              + Add Staff
            </button>
          </div>
          <div className="staff-list">
            {staff.map((member) => (
              <div key={member.id} className="staff-row">
                <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                <div className="staff-info">
                  <span className="staff-name">{member.name}</span>
                  <span className="staff-email">{member.email}</span>
                </div>
                <span className={`role-badge role-${member.role}`}>
                  {ROLE_LABELS[member.role] || member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Tab */}
      {activeTab === "qr" && (
        <div className="tab-content">
          <button className="btn-primary" onClick={() => setShowQrModal(true)}>
            Open QR Generator
          </button>
        </div>
      )}

      {showItemModal && (
        <MenuItemModal
          item={editingItem}
          categories={categories}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
          onSave={handleSaveItem}
        />
      )}

      {showStaffModal && (
        <StaffModal
          restaurant={{ id: restaurantId }}
          onClose={() => setShowStaffModal(false)}
        />
      )}

      {showQrModal && (
        <QRModal
          restaurant={{ id: restaurantId, table_count: 20 }}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </AdminLayout>
  );
}

const ROLE_LABELS = {
  general_admin: "General Admin",
  kitchen: "Kitchen",
  cash_counter: "Cash Counter",
  server: "Server",
};
