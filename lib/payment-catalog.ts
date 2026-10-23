export type PaymentField = {
  key: string;
  label: string;
  secret?: boolean;
  hint?: string;
};
export type Provider = {
  id: string;
  name: string;
  initials: string;
  region: string;
  type: "api" | "hosted" | "manual";
  methods: string[];
  fields: PaymentField[];
  docs: string;
  hosts: string[];
  note: string;
};
export const PAYMENT_METHODS: Record<string, string> = {
  card: "Credit & debit cards",
  upi: "UPI / UPI apps",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  netbanking: "Net banking",
  wallet: "Wallets",
  bank: "Bank transfer",
};
export const CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
] as const;
export const PROVIDERS: Provider[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    initials: "R",
    region: "India",
    type: "api",
    methods: ["card", "upi", "netbanking", "wallet"],
    fields: [
      { key: "keyId", label: "Key ID" },
      { key: "keySecret", label: "Key secret", secret: true },
      { key: "webhookSecret", label: "Webhook secret", secret: true },
    ],
    docs: "https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/",
    hosts: ["razorpay.com", "rzp.io"],
    note: "API orders, captured-payment verification and signed webhooks. INR checkout.",
  },
  {
    id: "stripe",
    name: "Stripe",
    initials: "S",
    region: "International",
    type: "api",
    methods: ["card", "apple_pay", "google_pay"],
    fields: [
      { key: "secretKey", label: "Secret API key", secret: true },
      { key: "webhookSecret", label: "Webhook signing secret", secret: true },
    ],
    docs: "https://docs.stripe.com/payments/checkout",
    hosts: ["stripe.com"],
    note: "Hosted Checkout with server verification. Wallet availability depends on your account, country, browser and device.",
  },
  {
    id: "paypal",
    name: "PayPal",
    initials: "P",
    region: "International",
    type: "api",
    methods: ["paypal", "card"],
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", secret: true },
    ],
    docs: "https://developer.paypal.com/docs/checkout/standard/integrate/",
    hosts: ["paypal.com"],
    note: "Orders API with server capture. Buyers return to INFLUVIA to confirm. Use a currency supported by your account.",
  },
  {
    id: "gumroad",
    name: "Gumroad",
    initials: "G",
    region: "International",
    type: "hosted",
    methods: ["card", "paypal"],
    fields: [],
    docs: "https://gumroad.com/api",
    hosts: ["gumroad.com"],
    note: "Map product checkout URLs to packages. Confirm receipts in Finance or connect an authenticated automation bridge.",
  },
  {
    id: "superprofile",
    name: "SuperProfile",
    initials: "SP",
    region: "India + global",
    type: "hosted",
    methods: ["card", "upi"],
    fields: [],
    docs: "https://iris.superprofile.bio/help/cosmofeed/articles/how-to-automatically-send-superprofile-leads-to-mailerlite-using-zapier",
    hosts: ["superprofile.bio", "cosmofeed.com"],
    note: "Payment pages with owner verification or an authenticated Zapier purchase bridge. Send the exact INFLUVIA order reference.",
  },
  {
    id: "cashfree",
    name: "Cashfree",
    initials: "CF",
    region: "India",
    type: "hosted",
    methods: ["card", "upi", "netbanking", "wallet"],
    fields: [],
    docs: "https://www.cashfree.com/docs/payments/payment-links",
    hosts: ["cashfree.com", "cashfree.in"],
    note: "Hosted payment links with owner receipt review or authenticated automation. Native Cashfree order APIs are not used.",
  },
  {
    id: "phonepe",
    name: "PhonePe",
    initials: "Pe",
    region: "India",
    type: "hosted",
    methods: ["upi", "card", "netbanking"],
    fields: [],
    docs: "https://www.phonepe.com/guides/payment-gateway/",
    hosts: ["phonepe.com"],
    note: "Business checkout links. A customer UTR is a claim; verify it in your merchant dashboard before approval.",
  },
  {
    id: "payu",
    name: "PayU",
    initials: "U",
    region: "India",
    type: "hosted",
    methods: ["card", "upi", "netbanking", "wallet"],
    fields: [],
    docs: "https://docs.payu.in/docs/payment-links",
    hosts: ["payu.in", "payumoney.com"],
    note: "Hosted payment links, confirmed through owner review or authenticated automation.",
  },
  {
    id: "paytm",
    name: "Paytm",
    initials: "Pt",
    region: "India",
    type: "hosted",
    methods: ["card", "upi", "wallet", "netbanking"],
    fields: [],
    docs: "https://business.paytm.com/docs/payment-link/",
    hosts: ["paytm.com", "paytm.in"],
    note: "Business payment links with confirmed receipts reconciled in Finance.",
  },
  {
    id: "instamojo",
    name: "Instamojo",
    initials: "im",
    region: "India",
    type: "hosted",
    methods: ["card", "upi", "netbanking"],
    fields: [],
    docs: "https://docs.instamojo.com/",
    hosts: ["instamojo.com", "imjo.in"],
    note: "Hosted payment links with audited owner review or authenticated automation before access unlocks.",
  },
  {
    id: "ccavenue",
    name: "CCAvenue",
    initials: "CC",
    region: "India + global",
    type: "hosted",
    methods: ["card", "upi", "netbanking", "wallet"],
    fields: [],
    docs: "https://www.ccavenue.com/",
    hosts: ["ccavenue.com"],
    note: "Save merchant checkout links per package. Verify purchases in your merchant account or authenticated automation.",
  },
  {
    id: "paddle",
    name: "Paddle",
    initials: "Pd",
    region: "International",
    type: "hosted",
    methods: ["card", "paypal", "apple_pay", "google_pay"],
    fields: [],
    docs: "https://developer.paddle.com/",
    hosts: ["paddle.com", "paddle.io"],
    note: "Hosted checkout link connection. Owner review or authenticated automation confirms each 30-day purchase; no native recurring billing sync.",
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    initials: "LS",
    region: "International",
    type: "hosted",
    methods: ["card", "paypal", "apple_pay", "google_pay"],
    fields: [],
    docs: "https://docs.lemonsqueezy.com/help/checkout/checkout-links",
    hosts: ["lemonsqueezy.com"],
    note: "Hosted product checkout links with owner review or authenticated automation for 30-day access.",
  },
  {
    id: "upi",
    name: "Direct UPI",
    initials: "UPI",
    region: "India",
    type: "manual",
    methods: ["upi"],
    fields: [
      {
        key: "upiId",
        label: "Business UPI ID",
        hint: "Example: business@bank",
      },
      { key: "payeeName", label: "Registered payee name" },
    ],
    docs: "https://www.npci.org.in/what-we-do/upi/product-overview",
    hosts: [],
    note: "Pay through a supported UPI app or copy your UPI ID. Verify bank receipt in Finance before access unlocks.",
  },
  {
    id: "bank",
    name: "Bank transfer",
    initials: "BT",
    region: "India + global",
    type: "manual",
    methods: ["bank"],
    fields: [
      {
        key: "instructions",
        label: "Business bank payment instructions",
        hint: "Shown to customers. Include business account details, IFSC or SWIFT as appropriate.",
      },
    ],
    docs: "",
    hosts: [],
    note: "Show bank transfer instructions and review received funds before activating membership.",
  },
];
export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id);
export type PaymentMapping = {
  packageId: string;
  amountMinor: number | null;
  checkoutUrl: string;
  productId: string;
};
export type PaymentConfig = {
  currency: string;
  methods: string[];
  fields: Record<string, string>;
  mappings: PaymentMapping[];
  fulfillment: "manual" | "bridge";
  instructions: string;
};
export function checkoutUrlAllowed(url: string, provider: Provider) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      provider.hosts.some(
        (h) => u.hostname === h || u.hostname.endsWith("." + h),
      )
    );
  } catch {
    return false;
  }
}
