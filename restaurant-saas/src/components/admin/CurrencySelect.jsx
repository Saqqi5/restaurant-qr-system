import { CURRENCIES, DEFAULT_CURRENCY } from "../../config/currencies";

// Currency picker (super admin only — used in the Create + Edit modals).
export default function CurrencySelect({ value, onChange }) {
  return (
    <select value={value || DEFAULT_CURRENCY} onChange={(e) => onChange(e.target.value)}>
      {CURRENCIES.map((c) => (
        <option key={c.symbol} value={c.symbol}>{c.label}</option>
      ))}
    </select>
  );
}
