import bcrypt from "bcryptjs";
import db from "../db.server";
import type { VendorStatus } from "@prisma/client";
import { createAuditLog } from "./audit.server";

const SALT_ROUNDS = 12;

function generateSlug(storeName: string): string {
  return storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createVendor(
  shop: string,
  data: {
    email: string;
    storeName: string;
    password: string;
    description?: string;
    phone?: string;
  },
) {
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  let slug = generateSlug(data.storeName);

  // Ensure unique slug
  const existing = await db.vendor.findUnique({
    where: { shop_slug: { shop, slug } },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Check auto-approve setting
  const settings = await db.storeSettings.findUnique({
    where: { shop },
    select: { autoApproveVendors: true },
  });

  const vendor = await db.vendor.create({
    data: {
      shop,
      email: data.email,
      storeName: data.storeName,
      slug,
      description: data.description,
      phone: data.phone,
      passwordHash,
      status: settings?.autoApproveVendors ? "APPROVED" : "PENDING",
      approvedAt: settings?.autoApproveVendors ? new Date() : undefined,
    },
  });

  await createAuditLog({
    shop,
    vendorId: vendor.id,
    action: "vendor.registered",
    entityType: "Vendor",
    entityId: vendor.id,
    details: { storeName: data.storeName, email: data.email },
    performedBy: "system",
  });

  return vendor;
}

export async function authenticateVendor(
  shop: string,
  email: string,
  password: string,
) {
  const vendor = await db.vendor.findUnique({
    where: { shop_email: { shop, email } },
  });

  if (!vendor) return null;

  const isValid = await bcrypt.compare(password, vendor.passwordHash);
  if (!isValid) return null;

  await db.vendor.update({
    where: { id: vendor.id },
    data: { lastLoginAt: new Date() },
  });

  return vendor;
}

export async function updateVendorStatus(
  shop: string,
  vendorId: string,
  status: VendorStatus,
  performedBy: string,
  reason?: string,
) {
  const updateData: Record<string, unknown> = { status };

  if (status === "APPROVED") {
    updateData.approvedAt = new Date();
    updateData.suspendedAt = null;
    updateData.suspensionReason = null;
  } else if (status === "SUSPENDED") {
    updateData.suspendedAt = new Date();
    updateData.suspensionReason = reason;
  }

  const vendor = await db.vendor.update({
    where: { id: vendorId },
    data: updateData,
  });

  await createAuditLog({
    shop,
    vendorId,
    action: `vendor.${status.toLowerCase()}`,
    entityType: "Vendor",
    entityId: vendorId,
    details: { reason },
    performedBy,
  });

  return vendor;
}

export async function getVendors(
  shop: string,
  options?: {
    status?: VendorStatus;
    search?: string;
    limit?: number;
    offset?: number;
  },
) {
  const where: Record<string, unknown> = { shop };

  if (options?.status) where.status = options.status;
  if (options?.search) {
    where.OR = [
      { storeName: { contains: options.search, mode: "insensitive" } },
      { email: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    db.vendor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 20,
      skip: options?.offset ?? 0,
      select: {
        id: true,
        email: true,
        storeName: true,
        slug: true,
        logo: true,
        status: true,
        rating: true,
        totalSales: true,
        totalOrders: true,
        commissionRate: true,
        payoutMethod: true,
        createdAt: true,
        approvedAt: true,
        _count: {
          select: { products: true },
        },
      },
    }),
    db.vendor.count({ where }),
  ]);

  return { vendors, total };
}

export async function getVendorById(vendorId: string) {
  return db.vendor.findUnique({
    where: { id: vendorId },
    include: {
      subscription: {
        include: { plan: true },
      },
      _count: {
        select: {
          products: true,
          orderItems: true,
          reviewsReceived: true,
        },
      },
    },
  });
}
