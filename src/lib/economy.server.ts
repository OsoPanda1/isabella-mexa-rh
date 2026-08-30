/**
 * Lucrum Prime Economy Engine
 * Products, orders, credits, memberships, payouts.
 * Federation: F-04 Economía
 */
import { createHash } from "node:crypto";
import { appendBlock } from "./bookpi.server";
import { recordSeguimiento } from "./anubis.server";

export type MembershipTier = "free" | "premium" | "vip" | "gold" | "elite" | "celestial";
export type ProductType = "digital" | "nft" | "ticket" | "course" | "membership";
export type OrderStatus = "created" | "pending" | "paid" | "failed" | "refunded";

export interface Product {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  price: number; // USD
  currency: string;
  type: ProductType;
  tier?: MembershipTier;
  available: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  productId: string;
  userId: string;
  total: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
}

export interface Balance {
  userId: string;
  credits: number; // TAMV Credits™ — buy $0.004 / redeem $0.002
  tier: MembershipTier;
  lastUpdated: string;
}

const products: Product[] = [];
const orders: Order[] = [];
const balances = new Map<string, Balance>();

function uid(seed: string) {
  return createHash("sha256").update(seed + Date.now() + Math.random()).digest("hex").slice(0, 16);
}

// Seed canonical products
const CANONICAL: Omit<Product, "id" | "createdAt">[] = [
  { creatorId: "tamv", title: "TAMV Premium", description: "Acceso completo a Atlas, observabilidad y kernels", price: 19.90, currency: "USD", type: "membership", tier: "premium", available: true },
  { creatorId: "tamv", title: "TAMV VIP", description: "Premium + DreamSpaces XR + API acceso extendido", price: 24.99, currency: "USD", type: "membership", tier: "vip", available: true },
  { creatorId: "tamv", title: "TAMV Gold", description: "VIP + governance voting + marketplace", price: 49.99, currency: "USD", type: "membership", tier: "gold", available: true },
  { creatorId: "tamv", title: "TAMV Elite", description: "Gold + DAO namespace + ELITE HEHEP access", price: 99.99, currency: "USD", type: "membership", tier: "elite", available: true },
  { creatorId: "tamv", title: "TAMV Celestial", description: "Full civilizational infrastructure access", price: 299.99, currency: "USD", type: "membership", tier: "celestial", available: true },
  { creatorId: "tamv", title: "Atlas Kernel Course", description: "Curso oficial: arquitectura heptafederada", price: 149.00, currency: "USD", type: "course", available: true },
  { creatorId: "tamv", title: "TAMV Credits Pack 1000", description: "1000 TAMV Credits™ @ $0.004 USD each", price: 4.00, currency: "USD", type: "digital", available: true },
  { creatorId: "tamv", title: "RDM Digital Territory NFT", description: "Territorio digital en Real del Monte, Hidalgo", price: 49.99, currency: "USD", type: "nft", available: true },
];

for (const p of CANONICAL) {
  products.push({ ...p, id: uid(p.title), createdAt: new Date().toISOString() });
}

export function listProducts(creatorId?: string): Product[] {
  return creatorId ? products.filter(p => p.creatorId === creatorId) : products;
}

export function getProduct(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function createOrder(userId: string, productId: string): Order {
  const product = products.find(p => p.id === productId);
  if (!product) throw new Error(`Product ${productId} not found`);
  const order: Order = {
    id: uid(`order${userId}${productId}`),
    productId,
    userId,
    total: product.price,
    currency: product.currency,
    status: "created",
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  appendBlock({ eventType: "order_created", module: "Lucrum", action: "order.create", actor: userId, data: { orderId: order.id, productId, total: product.price } });
  recordSeguimiento({ radar: "HORUS", level: "INFO", action: "ORDER_CREATED", details: { orderId: order.id, userId, total: product.price } });
  return order;
}

export function payOrder(orderId: string): Order {
  const order = orders.find(o => o.id === orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  appendBlock({ eventType: "order_paid", module: "Lucrum", action: "order.pay", actor: order.userId, data: { orderId, total: order.total } });
  return order;
}

export function getBalance(userId: string): Balance {
  if (!balances.has(userId)) {
    balances.set(userId, { userId, credits: 0, tier: "free", lastUpdated: new Date().toISOString() });
  }
  return balances.get(userId)!;
}

export function mintCredits(userId: string, amount: number): Balance {
  const b = getBalance(userId);
  b.credits += amount;
  b.lastUpdated = new Date().toISOString();
  appendBlock({ eventType: "economic_transaction", module: "Lucrum", action: "credits.mint", actor: userId, data: { amount, newBalance: b.credits } });
  return b;
}

export function listOrders(userId?: string): Order[] {
  return userId ? orders.filter(o => o.userId === userId) : orders.slice(-100);
}

export function economyStats() {
  const revenue = orders.filter(o => o.status === "paid").reduce((s, o) => s + o.total, 0);
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  return { totalProducts: products.length, totalOrders: orders.length, paidRevenue: revenue, byStatus, totalBalances: balances.size };
}