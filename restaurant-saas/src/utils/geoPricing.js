// Visitor-currency pricing for the PUBLIC plan cards: a visitor sees the
// plan price in their own country's currency (converted from PKR at the
// live rate). Detection is free and client-side (timezone first, then the
// browser language's region); rates come from the free no-key ExchangeRate
// API, cached 24h in localStorage. If anything fails, prices simply stay
// in PKR. The actual charge is always PKR — this only changes the display.
const RATES_URL = "https://open.er-api.com/v6/latest/PKR";
const RATES_KEY = "saqlyn_pkr_rates";
const RATES_TTL_MS = 24 * 60 * 60 * 1000;

// IANA timezone -> ISO currency. Covers the countries our buyers come from;
// anything missing falls back to the browser language, then PKR.
const TIMEZONE_CURRENCY = {
  "Asia/Karachi": "PKR",
  "Asia/Kolkata": "INR", "Asia/Colombo": "LKR", "Asia/Dhaka": "BDT",
  "Asia/Kathmandu": "NPR", "Asia/Kabul": "AFN",
  "Asia/Dubai": "AED", "Asia/Riyadh": "SAR", "Asia/Qatar": "QAR",
  "Asia/Kuwait": "KWD", "Asia/Muscat": "OMR", "Asia/Bahrain": "BHD",
  "Asia/Baghdad": "IQD", "Asia/Tehran": "IRR", "Asia/Damascus": "SYP",
  "Asia/Amman": "JOD", "Asia/Beirut": "LBP", "Asia/Jerusalem": "ILS",
  "Asia/Istanbul": "TRY", "Europe/Istanbul": "TRY",
  "Asia/Tokyo": "JPY", "Asia/Seoul": "KRW", "Asia/Shanghai": "CNY",
  "Asia/Hong_Kong": "HKD", "Asia/Singapore": "SGD", "Asia/Kuala_Lumpur": "MYR",
  "Asia/Jakarta": "IDR", "Asia/Bangkok": "THB", "Asia/Manila": "PHP",
  "Asia/Ho_Chi_Minh": "VND", "Asia/Yangon": "MMK", "Asia/Tashkent": "UZS",
  "Asia/Almaty": "KZT", "Asia/Tbilisi": "GEL", "Asia/Yerevan": "AMD",
  "Asia/Baku": "AZN",
  "Europe/London": "GBP", "Europe/Dublin": "EUR",
  "Europe/Paris": "EUR", "Europe/Berlin": "EUR", "Europe/Madrid": "EUR",
  "Europe/Rome": "EUR", "Europe/Amsterdam": "EUR", "Europe/Brussels": "EUR",
  "Europe/Vienna": "EUR", "Europe/Athens": "EUR", "Europe/Lisbon": "EUR",
  "Europe/Stockholm": "SEK", "Europe/Oslo": "NOK", "Europe/Copenhagen": "DKK",
  "Europe/Warsaw": "PLN", "Europe/Prague": "CZK", "Europe/Budapest": "HUF",
  "Europe/Bucharest": "RON", "Europe/Moscow": "RUB", "Europe/Kyiv": "UAH",
  "Europe/Zurich": "CHF",
  "America/New_York": "USD", "America/Chicago": "USD", "America/Denver": "USD",
  "America/Los_Angeles": "USD", "America/Anchorage": "USD",
  "Pacific/Honolulu": "USD", "America/Toronto": "CAD", "America/Vancouver": "CAD",
  "America/Mexico_City": "MXN", "America/Sao_Paulo": "BRL",
  "America/Santiago": "CLP", "America/Bogota": "COP", "America/Lima": "PEN",
  "America/Argentina/Buenos_Aires": "ARS",
  "Africa/Cairo": "EGP", "Africa/Lagos": "NGN", "Africa/Nairobi": "KES",
  "Africa/Johannesburg": "ZAR", "Africa/Casablanca": "MAD", "Africa/Accra": "GHS",
  "Africa/Tunis": "TND", "Africa/Algiers": "DZD",
  "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD", "Australia/Perth": "AUD",
  "Pacific/Auckland": "NZD",
};

// Region from navigator.language ("en-US" -> "US") -> currency.
const LANGUAGE_CURRENCY = {
  US: "USD", GB: "GBP", PK: "PKR", IN: "INR", BD: "BDT", AE: "AED", SA: "SAR",
  QA: "QAR", KW: "KWD", CA: "CAD", AU: "AUD", NZ: "NZD", DE: "EUR", FR: "EUR",
  JP: "JPY", CN: "CNY", KR: "KRW", TR: "TRY", MY: "MYR", SG: "SGD", ZA: "ZAR",
  NG: "NGN", KE: "KES", EG: "EGP", PH: "PHP", ID: "IDR", TH: "THB", LK: "LKR",
  NP: "NPR", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK",
  MX: "MXN", BR: "BRL",
};

export function detectVisitorCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_CURRENCY[tz]) return TIMEZONE_CURRENCY[tz];
  } catch { /* fall through */ }
  try {
    const region = (navigator.language || "").split("-")[1]?.toUpperCase();
    if (region && LANGUAGE_CURRENCY[region]) return LANGUAGE_CURRENCY[region];
  } catch { /* fall through */ }
  return "PKR";
}

let ratesPromise = null;
export function getExchangeRates() {
  if (ratesPromise) return ratesPromise;
  ratesPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(RATES_KEY) || "null");
      if (cached?.at > Date.now() - RATES_TTL_MS && cached?.rates) return cached.rates;
    } catch { /* fall through to the network */ }
    try {
      const res = await fetch(RATES_URL);
      const data = await res.json();
      if (data?.rates) {
        try { localStorage.setItem(RATES_KEY, JSON.stringify({ at: Date.now(), rates: data.rates })); } catch { /* private mode */ }
        return data.rates;
      }
    } catch { /* offline / blocked — caller falls back to PKR */ }
    return null;
  })();
  return ratesPromise;
}

// Whole units (a price card reads better as "$18" than "$17.85"). null when
// there is no rate (PKR itself, or the lookup failed) — the caller shows PKR.
export function convertPkr(amountPkr, currency, rates) {
  if (!rates || currency === "PKR" || !rates[currency]) return null;
  return Math.round(amountPkr * rates[currency]);
}

export function formatMoney(amount, currency) {
  if (currency === "PKR") return `Rs. ${amount.toLocaleString("en-US")}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}
