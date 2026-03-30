import { useState, useRef, useEffect } from "react";
import { buildQrUrl } from "../../config/tenantResolver";

// We use the qrcode library approach but build our own simple SVG QR
// In production, install: npm install qrcode
// For now, we use a public QR API fallback

export default function QRModal({ restaurant, onClose }) {
  const [selectedTable, setSelectedTable] = useState(1);
  const [qrSize, setQrSize] = useState(200);
  const tableCount = restaurant?.table_count || 20;
  const customDomain = restaurant?.custom_domain;

  const qrUrl = buildQrUrl(restaurant?.id, selectedTable, "saas", customDomain);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrUrl)}&format=png&qzone=2`;

  function downloadQR() {
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.download = `table-${selectedTable}-qr.png`;
    link.click();
  }

  async function printAllQRs() {
    const win = window.open("", "_blank");
    const baseUrl = window.location.origin;
    let html = `<html><head><title>QR Codes — ${restaurant?.name || "Restaurant"}</title>
    <style>
      body { font-family: sans-serif; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; }
      .qr-cell { text-align: center; padding: 20px; border: 2px solid #eee; border-radius: 12px; page-break-inside: avoid; }
      h2 { color: #e85d04; }
      p { color: #666; font-size: 14px; }
      img { width: 160px; height: 160px; }
    </style></head><body>
    <h1 style="text-align:center;color:#e85d04">${restaurant?.name || "Restaurant"} — QR Codes</h1>
    <div class="grid">`;

    for (let i = 1; i <= tableCount; i++) {
      const url = buildQrUrl(restaurant?.id, i, "saas", customDomain);
      const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&format=png&qzone=2`;
      html += `<div class="qr-cell">
        <img src="${imgSrc}" alt="Table ${i} QR" />
        <h2>Table ${i}</h2>
        <p>${restaurant?.name || "Restaurant"}</p>
      </div>`;
    }

    html += `</div></body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 1500);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>QR Code Generator</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body qr-modal-body">
          {/* Controls */}
          <div className="qr-controls">
            <div className="form-group">
              <label>Select Table</label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(parseInt(e.target.value))}
              >
                {[...Array(tableCount)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Table {i + 1}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>QR Size</label>
              <select value={qrSize} onChange={(e) => setQrSize(parseInt(e.target.value))}>
                <option value={150}>Small (150px)</option>
                <option value={200}>Medium (200px)</option>
                <option value={300}>Large (300px)</option>
              </select>
            </div>
          </div>

          {/* QR Preview */}
          <div className="qr-preview-section">
            <div className="qr-card">
              <div className="qr-card-header">
                <span className="qr-restaurant-name">{restaurant?.name || "Restaurant"}</span>
              </div>
              <img
                src={qrImageUrl}
                alt={`Table ${selectedTable} QR Code`}
                className="qr-image"
              />
              <div className="qr-table-label">Table {selectedTable}</div>
              <div className="qr-url">{qrUrl}</div>
            </div>
          </div>

          {/* URL display */}
          <div className="qr-url-box">
            <label>Order URL:</label>
            <div className="url-copy">
              <input readOnly value={qrUrl} />
              <button onClick={() => navigator.clipboard.writeText(qrUrl)}>Copy</button>
            </div>
          </div>

          {/* Domain info */}
          {customDomain && (
            <div className="domain-info-box">
              ✅ Custom domain active: <strong>{customDomain}</strong>
            </div>
          )}
          {!customDomain && (
            <div className="domain-info-box warn">
              💡 No custom domain configured. QR uses shared SaaS URL.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={printAllQRs}>
            🖨️ Print All Tables
          </button>
          <button className="btn-primary" onClick={downloadQR}>
            ⬇️ Download QR
          </button>
        </div>
      </div>
    </div>
  );
}
