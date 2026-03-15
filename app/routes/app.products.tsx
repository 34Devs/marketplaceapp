import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Select,
  Text,
  Box,
  Pagination,
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

  const [products, total] = await Promise.all([
    db.vendorProduct.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        vendor: { select: { storeName: true, id: true } },
      },
    }),
    db.vendorProduct.count({ where }),
  ]);

  return json({
    products,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const productId = formData.get("productId") as string;
  const action = formData.get("action") as string;

  if (productId && (action === "approve" || action === "reject")) {
    await db.vendorProduct.update({
      where: { id: productId },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED" },
    });
  }

  return json({ success: true });
};

function statusBadge(status: string) {
  const toneMap: Record<string, "success" | "attention" | "critical" | "info"> = {
    APPROVED: "success",
    PENDING: "attention",
    REJECTED: "critical",
    ARCHIVED: "info",
  };
  return <Badge tone={toneMap[status] || undefined}>{status}</Badge>;
}

export default function ProductsPage() {
  const { products, total, page, totalPages } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleAction = (productId: string, action: string) => {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("action", action);
    submit(formData, { method: "post" });
  };

  const rows = products.map((product) => [
    product.title,
    product.vendor.storeName,
    statusBadge(product.status),
    product.commissionRate ? `${product.commissionRate}%` : "Default",
    new Date(product.createdAt).toLocaleDateString(),
    <InlineStack key={`actions-${product.id}`} gap="200">
      {product.status === "PENDING" && (
        <>
          <Button size="slim" tone="success" onClick={() => handleAction(product.id, "approve")}>
            Approve
          </Button>
          <Button size="slim" tone="critical" onClick={() => handleAction(product.id, "reject")}>
            Reject
          </Button>
        </>
      )}
    </InlineStack>,
  ]);

  return (
    <Page>
      <TitleBar title="Product Management" />
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="400">
            <Select
              label=""
              labelHidden
              options={[
                { label: "All Statuses", value: "" },
                { label: "Pending", value: "PENDING" },
                { label: "Approved", value: "APPROVED" },
                { label: "Rejected", value: "REJECTED" },
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
            <Text as="h2" variant="headingMd">
              Marketplace Products ({total})
            </Text>
            {products.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={["Product", "Vendor", "Status", "Commission", "Created", "Actions"]}
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
                  No products found.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
