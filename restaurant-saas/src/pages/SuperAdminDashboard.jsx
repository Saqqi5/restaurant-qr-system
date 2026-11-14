import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getAllRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  getRestaurantUsers, mapDomain
} from "../config/db";
import { PLANS, getPlanLimit, normalizePlan } from "../config/plans";
import { buildQrUrl } from "../config/tenantResolver";
import AdminLayout from "../components/admin/AdminLayout";
import RestaurantCard from "../components/admin/RestaurantCard";
import CreateRestaurantModal from "../components/admin/CreateRestaurantModal";
import StaffModal from "../components/admin/StaffModal";
import QRModal from "../components/admin/QRModal";
import StatsBar from "../components/admin/StatsBar";

export default function SuperAdminDashboard() {
  const { userProfile, logout } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [modalType, setModalType] = useState(null); // "staff" | "qr" | "edit" | "domain"
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState(null); // restaurant awaiting delete confirm
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    getAllRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  async function handleCreateRestaurant(formData) {
    const newRestaurant = await createRestaurant(formData);
    setRestaurants((prev) => [newRestaurant, ...prev]);
    setShowCreate(false);
  }

  async function handleUpdateRestaurant(id, data) {
    await updateRestaurant(id, data);
    setRestaurants((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
    setModalType(null);
  }

  async function handleDeleteRestaurant() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteRestaurant(deleting.id);
      setRestaurants((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleMapDomain(restaurantId, domain) {
    await mapDomain(domain, restaurantId);
    await updateRestaurant(restaurantId, { custom_domain: domain });
    setRestaurants((prev) =>
      prev.map((r) => r.id === restaurantId ? { ...r, custom_domain: domain } : r)
    );
  }

  function openModal(restaurant, type) {
    setSelectedRestaurant(restaurant);
    setModalType(type);
  }

  const filtered = restaurants.filter((r) =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: restaurants.length,
    active: restaurants.filter((r) => r.active).length,
    withCustomDomain: restaurants.filter((r) => r.custom_domain).length,
  };

  return (
    <AdminLayout
      title="Super Admin"
      subtitle="Manage all restaurants on the platform"
      onLogout={logout}
      userProfile={userProfile}
    >
      <StatsBar stats={[
        { label: "Total Restaurants", value: stats.total, icon: "🏪" },
        { label: "Active", value: stats.active, icon: "✅" },
        { label: "Custom Domains", value: stats.withCustomDomain, icon: "🌐" },
      ]} />

      <div className="dashboard-actions">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search restaurants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Restaurant
        </button>
      </div>

      {loading ? (
        <div className="grid-skeleton">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton-card-lg" />)}
        </div>
      ) : (
        <div className="restaurant-grid">
          {filtered.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onEdit={() => openModal(restaurant, "edit")}
              onManageStaff={() => openModal(restaurant, "staff")}
              onViewQR={() => openModal(restaurant, "qr")}
              onMapDomain={() => openModal(restaurant, "domain")}
              onDelete={() => setDeleting(restaurant)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <p>No restaurants found.</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateRestaurantModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateRestaurant}
        />
      )}

      {modalType === "staff" && selectedRestaurant && (
        <StaffModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === "qr" && selectedRestaurant && (
        <QRModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === "edit" && selectedRestaurant && (
        <EditRestaurantModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
          onSave={(data) => handleUpdateRestaurant(selectedRestaurant.id, data)}
        />
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Delete Restaurant</h3>
              <button className="modal-close" onClick={() => setDeleting(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                Delete <strong>{deleting.name}</strong>? This permanently removes the
                restaurant, its menu, orders and payments. Staff accounts are not
                deleted. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleDeleteRestaurant} disabled={deleteBusy}
                style={{ background: "#c0392b" }}>
                {deleteBusy ? "Deleting..." : "🗑️ Delete Restaurant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === "domain" && selectedRestaurant && (
        <DomainModal
          restaurant={selectedRestaurant}
          onClose={() => setModalType(null)}
          onSave={(domain) => handleMapDomain(selectedRestaurant.id, domain)}
        />
      )}
    </AdminLayout>
  );
}

function EditRestaurantModal({ restaurant, onClose, onSave }) {
  const [form, setForm] = useState({
    name: restaurant.name || "",
    table_count: restaurant.table_count || 10,
    logo_url: restaurant.logo_url || "",
    active: restaurant.active !== false,
    plan: normalizePlan(restaurant.plan),
  });
  const editLimit = getPlanLimit(form.plan, null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Restaurant</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Restaurant Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Plan</label>
            <select value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              {Object.values(PLANS).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}{p.defaultTableLimit === null ? " (no table limit)" : ` (up to ${p.defaultTableLimit} tables)`}
                </option>
              ))}
            </select>
            {editLimit !== null && form.table_count > editLimit && (
              <p className="form-hint">
                This restaurant has {form.table_count} tables, above the {form.plan} limit of {editLimit}.
                Existing tables stay, but no new tables can be added until the plan is upgraded.
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Table Count</label>
            <input type="number" value={form.table_count}
              onChange={(e) => setForm({ ...form, table_count: parseInt(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>Logo URL</label>
            <input value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..." />
          </div>
          <div className="form-group-inline">
            <label>
              <input type="checkbox" checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function DomainModal({ restaurant, onClose, onSave }) {
  const [domain, setDomain] = useState(restaurant.custom_domain || "");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Custom Domain Mapping</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-info">
            Point your domain's DNS A record to this server's IP, then enter the domain below.
          </p>
          <div className="form-group">
            <label>Custom Domain</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="myrestaurant.com"
            />
          </div>
          <div className="domain-instructions">
            <h4>DNS Setup Instructions:</h4>
            <ol>
              <li>Log into your domain registrar</li>
              <li>Create an A record: <code>@ → {window.location.hostname}</code></li>
              <li>Create a CNAME: <code>www → {window.location.hostname}</code></li>
              <li>Wait for DNS propagation (up to 48 hours)</li>
              <li>Enter your domain above and save</li>
            </ol>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { onSave(domain); onClose(); }}>
            Map Domain
          </button>
        </div>
      </div>
    </div>
  );
}
