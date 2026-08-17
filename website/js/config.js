/* DigiHub site config — edit these values */
window.DIGIHUB_CONFIG = {
  whatsapp: "919140980834",
  whatsappDisplay: "+91 9140980834",
  email: "abdulindia.scars@gmail.com",
  supportHours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
  supportNote: "Closed Sundays & public holidays",
  trialDays: 7,

  // Base prices in INR — 1 PC / 1 store account
  priceMonthlyInr: 299,
  priceYearlyInr: 2999,

  // Multi-PC pack — 3 PCs (multiple counters / stores)
  // Monthly ₹699 · Yearly ₹6999
  priceMultiPcMonthlyInr: 699,
  priceMultiPcYearlyInr: 6999,
  multiPcMin: 3,
  multiPcMax: 3,

  // Mock stats (marketing)
  stats: {
    stores: 520,
    cities: 48,
    invoices: "1.2M+",
    rating: "4.8",
  },

  // Approximate display rates vs INR (mock / illustrative — not live FX)
  currencies: {
    INR: { code: "INR", symbol: "₹", rate: 1, label: "INR ₹" },
    USD: { code: "USD", symbol: "$", rate: 1 / 83, label: "USD $" },
    EUR: { code: "EUR", symbol: "€", rate: 1 / 90, label: "EUR €" },
    GBP: { code: "GBP", symbol: "£", rate: 1 / 105, label: "GBP £" },
    AED: { code: "AED", symbol: "AED ", rate: 1 / 22.6, label: "AED" },
  },
  defaultCurrency: "INR",
};
