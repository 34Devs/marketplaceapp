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

  const [orders, total] = await Promise.all([
    db.vendorOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        items: {
          include: {
            vendor: { select: { storeName: true } },
          },
        },
      },
    }),
    db.vendorOrder.count({ where }),
  ]);

  return json({
    orders,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
};

function statusBadge(status: string) {
  const toneMap: Record<string, "success" | "attention" | "critical" | "info"> = {
    FULFILLED: "success",
    PENDING: "attention",
    CANCELLED: "critical",
    REFUNDED: "critical",
    PARTIALLY_FULFILLED: "info",
  };
  return <Badge tone={toneMap[status] || undefined}>{status}</Badge>;
}

export default function OrdersPage() {
  const { orders, total, page, totalPages } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  const rows = orders.map((order) => {
    const vendorNames = [...new Set(order.items.map((i) => i.vendor.storeName))];
    return [
      order.shopifyOrderName,
      order.customerEmail || "N/A",
      formatCurrency(order.totalAmount, order.currency),
      vendorNames.join(", "),
      order.items.length,
      statusBadge(order.status),
      new Date(order.createdAt).toLocaleDateString(),
    ];
  });

  return (
    <Page>
      <TitleBar title="Order Management" />
      <BlockStack gap="400">
        <Card>
          <Select
            label=""
            labelHidden
            options={[
              { label: "All Statuses", value: "" },
              { label: "Pending", value: "PENDING" },
              { label: "Fulfilled", value: "FULFILLED" },
              { label: "Partially Fulfilled", value: "PARTIALLY_FULFILLED" },
              { label: "Cancelled", value: "CANCELLED" },
            ]}
            value={searchParams.get("status") || ""}
            onChange={(value) => {
              const params = new URLSearchParams();
              if (value) params.set("status", value);
              params.set("page", "1");
              setSearchParams(params);
            }}
          />
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Orders ({total})
            </Text>
            {orders.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "numeric", "text", "text"]}
                  headings={["Order", "Customer", "Total", "Vendors", "Items", "Status", "Date"]}
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
                  No orders yet.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
