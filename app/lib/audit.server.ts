import type { Prisma } from "@prisma/client";
import db from "../db.server";

interface AuditLogEntry {
  shop: string;
  vendorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
  performedBy: string;
  ipAddress?: string;
}

export async function createAuditLog(entry: AuditLogEntry) {
  return db.auditLog.create({
    data: {
      shop: entry.shop,
      vendorId: entry.vendorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details ?? undefined,
      performedBy: entry.performedBy,
      ipAddress: entry.ipAddress,
    },
  });
}

export async function getAuditLogs(
  shop: string,
  options?: {
    entityType?: string;
    entityId?: string;
    vendorId?: string;
    limit?: number;
    offset?: number;
  },
) {
  const where: Record<string, unknown> = { shop };

  if (options?.entityType) where.entityType = options.entityType;
  if (options?.entityId) where.entityId = options.entityId;
  if (options?.vendorId) where.vendorId = options.vendorId;

  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      vendor: {
        select: { storeName: true, email: true },
      },
    },
  });
}
