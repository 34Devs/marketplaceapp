import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  BlockStack,
  Text,
  Box,
  InlineGrid,
  InlineStack,
  Pagination,
  Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

const PAGE_SIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const where: Record<string, unknown> = { shop: session.shop };
  if (status) where.status = status;

  const [payouts, total, pendingStats, completedStats] = await Promise.all([
    db.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        vendor: { select: { storeName: true } },
        _count: { select: { commissions: true } },
      },
    }),
    db.payout.count({ where }),
    db.payout.aggregate({
      where: { shop: session.shop, status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payout.aggregate({
      where: { shop: session.shop, status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return json({
    payouts,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    pendingAmount: pendingStats._sum.amount ?? 0,
    pendingCount: pendingStats._count ?? 0,
    completedAmount: completedStats._sum.amount ?? 0,
    completedCount: completedStats._count ?? 0,
  });
};

function statusBadge(status: string) {
  const toneMap: Record<string, "success" | "attention" | "critical" | "info"> = {
    COMPLETED: "success",
    PENDING: "attention",
    PROCESSING: "info",
    FAILED: "critical",
    CANCELLED: "critical",
  };
  return <Badge tone={toneMap[status] || undefined}>{status}</Badge>;
}

export default function PayoutsPage() {
  const {
    payouts,
    total,
    page,
    totalPages,
    pendingAmount,
    pendingCount,
    completedAmount,
    completedCount,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const rows = payouts.map((p) => [
    p.vendor.storeName,
    formatCurrency(p.amount),
    p.currency,
    p.method,
    p._count.commissions,
    statusBadge(p.status),
    p.reference || "-",
    new Date(p.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="Payout Management" />
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Pending Payouts</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(pendingAmount)}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">{pendingCount} payouts</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Completed Payouts</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(completedAmount)}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">{completedCount} payouts</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <InlineStack gap="400">
            <Select
              label=""
              labelHidden
              options={[
                { label: "All Statuses", value: "" },
                { label: "Pending", value: "PENDING" },
                { label: "Processing", value: "PROCESSING" },
                { label: "Completed", value: "COMPLETED" },
                { label: "Failed", value: "FAILED" },
              ]}
              value={searchParams.get("status") || ""}
              onChange={(value) => {
                const params = new URLSearchParams();
                if (value) params.set("status", value);
                params.set("page", "1");
                setSearchParams(params);
              }}
            />
          </InlineStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Payouts ({total})</Text>
            {payouts.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={["text", "numeric", "text", "text", "numeric", "text", "text", "text"]}
                  headings={["Vendor", "Amount", "Currency", "Method", "Items", "Status", "Reference", "Date"]}
                  rows={rows}
                />
                {totalPages > 1 && (
                  <InlineStack align="center">
                    <Pagination
                      hasPrevious={page > 1}
                      hasNext={page < totalPages}
                      onPrevious={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set("page", String(page - 1));
                        setSearchParams(params);
                      }}
                      onNext={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set("page", String(page + 1));
                        setSearchParams(params);
                      }}
                    />
                  </InlineStack>
                )}
              </>
            ) : (
              <Box padding="400">
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  No payouts yet.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
