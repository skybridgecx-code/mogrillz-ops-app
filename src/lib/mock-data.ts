import type {
  Customer,
  DashboardSnapshot,
  Insight,
  InventoryItem,
  MenuItem,
  Order,
} from "@/types/domain";

const now = "2026-03-17T21:00:00.000Z";

const orders: Order[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    orderNumber: "MG-1051",
    customerName: "Ayesha Khan",
    customerEmail: "ayesha@example.com",
    customerZone: "Herndon",
    status: "Ready",
    dropDay: "Wednesday",
    fulfillmentMethod: "delivery",
    deliveryWindow: "6:30 PM - 7:00 PM",
    totalCents: 5400,
    customRequest: "No utensils please. Call on arrival.",
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: "oi-1",
        orderId: "11111111-1111-1111-1111-111111111111",
        menuItemId: "menu-nihari-tacos",
        name: "Nihari Tacos",
        quantity: 2,
        notes: "Extra green chutney",
        unitPriceCents: 1800,
      },
      {
        id: "oi-2",
        orderId: "11111111-1111-1111-1111-111111111111",
        menuItemId: "menu-lamb-bowl",
        name: "Lamb Bowl",
        quantity: 1,
        notes: "Cilantro + cheese, no onions",
        unitPriceCents: 1700,
      },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    orderNumber: "MG-1052",
    customerName: "Hamza Ali",
    customerEmail: "hamza@example.com",
    customerZone: "Sterling",
    status: "In Prep",
    dropDay: "Wednesday",
    fulfillmentMethod: "delivery",
    deliveryWindow: "7:00 PM - 7:30 PM",
    totalCents: 3200,
    customRequest: "Please text instead of calling.",
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: "oi-3",
        orderId: "22222222-2222-2222-2222-222222222222",
        menuItemId: "menu-karachi-wings",
        name: "Karachi Hot Wings",
        quantity: 1,
        notes: "Extra ranch on the side",
        unitPriceCents: 1500,
      },
      {
        id: "oi-4",
        orderId: "22222222-2222-2222-2222-222222222222",
        menuItemId: "menu-chicken-bowl",
        name: "Chicken Bowl",
        quantity: 1,
        notes: "Light rice, extra cucumbers",
        unitPriceCents: 1500,
      },
    ],
  },
];

const inventory: InventoryItem[] = [
  {
    id: "inv-nihari",
    name: "Beef Nihari",
    unit: "portions",
    onHand: 18,
    parLevel: 10,
    status: "Healthy",
    lastUpdatedAt: now,
    notes: "Anchor item for Wednesday drops.",
  },
  {
    id: "inv-onions",
    name: "Red Pickled Onions",
    unit: "trays",
    onHand: 2,
    parLevel: 3,
    status: "Low",
    lastUpdatedAt: now,
    notes: "Critical bowl and roll garnish.",
  },
  {
    id: "inv-cilantro",
    name: "Cilantro",
    unit: "trays",
    onHand: 1,
    parLevel: 2,
    status: "Low",
    lastUpdatedAt: now,
    notes: "Runs fast during bowl-heavy drops.",
  },
];

const menu: MenuItem[] = [
  {
    id: "menu-nihari-tacos",
    name: "Nihari Tacos",
    category: "Signature",
    priceCents: 1800,
    availability: "Live",
    allocationLimit: 86,
    description: "Slow-braised nihari beef with herb chutney and pickled onion.",
    isFeatured: true,
    notes: "Keep featured in ordering surfaces.",
  },
  {
    id: "menu-lamb-bowl",
    name: "Lamb Bowl",
    category: "Bowls",
    priceCents: 1700,
    availability: "Live",
    allocationLimit: 71,
    description: "Lamb over basmati rice or greens with toppings and sauces.",
    isFeatured: false,
    notes: "Strong upsell item.",
  },
];

const customers: Customer[] = [
  {
    id: "cust-201",
    name: "Ayesha Khan",
    email: "ayesha@example.com",
    zone: "Herndon",
    totalOrders: 6,
    lifetimeValueCents: 24400,
    loyaltyTier: "High",
    notes: "Prefers extra herb chutney and earlier delivery windows.",
    lastOrderAt: now,
  },
  {
    id: "cust-203",
    name: "Fatima Noor",
    email: "fatima@example.com",
    zone: "Vienna",
    totalOrders: 8,
    lifetimeValueCents: 31800,
    loyaltyTier: "VIP",
    notes: "Often orders for small office groups and adds custom requests.",
    lastOrderAt: now,
  },
];

const insights: Insight[] = [
  {
    id: "insight-1",
    type: "prep",
    title: "Prep Recommendation",
    summary: "Increase lamb prep by 2 portions for the next Wednesday drop.",
    confidence: 94,
    actionText: "Shift one tray worth of garnish support toward bowl assembly.",
    tone: "success",
    createdAt: now,
  },
  {
    id: "insight-2",
    type: "ops",
    title: "Operational Risk",
    summary: "Red pickled onions and cilantro are the first garnish bottlenecks.",
    confidence: 92,
    actionText: "Prep onions tonight and restock cilantro before the next preorder opens.",
    tone: "danger",
    createdAt: now,
  },
];

export const mockDashboardSnapshot: DashboardSnapshot = {
  generatedAt: now,
  drop: {
    day: "Wednesday",
    status: "Preorders Open",
    window: "6:15 PM - 8:30 PM",
    cutoff: "Tuesday 9:00 PM",
  },
  kpis: [
    { label: "Today's Orders", value: "37", delta: "+8 vs last Wednesday", tone: "gold" },
    { label: "Revenue To Date", value: "$1,842", delta: "+14% week over week", tone: "green" },
    { label: "Low Stock Items", value: "4", delta: "Needs attention before prep", tone: "red" },
    { label: "Prep Confidence", value: "91%", delta: "AI-guided forecast", tone: "blue" },
  ],
  orders,
  inventory,
  menu,
  customers,
  insights,
};

export function cloneMockSnapshot(): DashboardSnapshot {
  return structuredClone(mockDashboardSnapshot);
}
