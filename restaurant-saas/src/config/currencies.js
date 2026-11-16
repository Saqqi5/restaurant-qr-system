// Currency choices for a restaurant. The super admin picks one when creating
// a restaurant and can change it later in the Edit modal. The stored value
// is the display symbol — "$" and "Rs." are what the live demos already use.
// Default everywhere is "$".
export const DEFAULT_CURRENCY = "$";

export const CURRENCIES = [
  { symbol: "$",   label: "US Dollar ($)" },
  { symbol: "Rs.", label: "Pakistani Rupee (Rs.)" },
  { symbol: "€",   label: "Euro (€)" },
  { symbol: "£",   label: "British Pound (£)" },
  { symbol: "₹",   label: "Indian Rupee (₹)" },
  { symbol: "AED", label: "UAE Dirham (AED)" },
  { symbol: "SR",  label: "Saudi Riyal (SR)" },
  { symbol: "৳",   label: "Bangladeshi Taka (৳)" },
];
