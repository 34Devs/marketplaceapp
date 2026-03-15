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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

const PAGE_SIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const [commissions, total, stats, storeSettings] = await Promise.all([
    db.commission.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        vendor: { select: { storeName: true } },
        orderItem: { select: { title: true } },
      },
    }),
    db.commission.count({ where: { shop: session.shop } }),
    db.commission.groupBy({
      by: ["status"],
      where: { shop: session.shop },
      _sum: { commissionAmount: true, vendorEarnings: true },
      _count: true,
    }),
    db.storeSettings.findUnique({ where: { shop: session.shop } }),
  ]);

  const totalCommission = stats.reduce(
    (acc, s) => acc + (s._sum.commissionAmount ?? 0),
    0,
  );
  const pendingCommission =
    stats.find((s) => s.status === "PENDING")?._sum.commissionAmount ?? 0;
  const approvedCommission =
    stats.find((s) => s.status === "APPROVED")?._sum.commissionAmount ?? 0;

  return json({
    commissions,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    totalCommission,
    pendingCommission,
    approvedCommission,
    defaultRate: storeSettings?.defaultCommissionRate ?? 10,
    defaultType: storeSettings?.defaultCommissionType ?? "PERCENTAGE",
  });
};

function statusBadge(status: string) {
  const toneMap: Record<string, "success" | "attention" | "critical" | "info"> = {
    APPROVED: "success",
    PENDING: "attention",
    PAID: "info",
    REFUNDED: "critical",
    CANCELLED: "critical",
  };
  return <Badge tone={toneMap[status] || undefined}>{status}</Badge>;
}

export default function CommissionsPage() {
  const {
    commissions,
    total,
    page,
    totalPages,
    totalCommission,
    pendingCommission,
    approvedCommission,
    defaultRate,
    defaultType,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const rows = commissions.map((c) => [
    c.vendor.storeName,
    c.orderItem.title,
    formatCurrency(c.orderAmount),
    `${c.commissionRate}${c.commissionType === "PERCENTAGE" ? "%" : " fixed"}`,
    formatCurrency(c.commissionAmount),
    formatCurrency(c.vendorEarnings),
    statusBadge(c.status),
    new Date(c.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="Commission Management" />
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Commission</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(totalCommission)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Pending</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(pendingCommission)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Approved (Ready for Payout)</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(approvedCommission)}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd" tone="subdued">
              Default Rate: {defaultRate}{defaultType === "PERCENTAGE" ? "%" : " fixed"} per sale
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Commission Ledger ({total})</Text>
            {commissions.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "numeric", "numeric", "text", "text"]}
                  headings={["Vendor", "Product", "Order Amount", "Rate", "Commission", "Vendor Earnings", "Status", "Date"]}
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
                  No commissions yet. Commissions are created when orders come in.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
