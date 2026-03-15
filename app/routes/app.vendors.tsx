import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  TextField,
  Select,
  Text,
  Box,
  Pagination,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import { getVendors, updateVendorStatus } from "../lib/vendor.server";

const PAGE_SIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const { vendors, total } = await getVendors(session.shop, {
    status: status as any,
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return json({
    vendors,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const vendorId = formData.get("vendorId") as string;
  const action = formData.get("action") as string;
  const reason = formData.get("reason") as string | undefined;

  if (vendorId && action) {
    const statusMap: Record<string, any> = {
      approve: "APPROVED",
      reject: "REJECTED",
      suspend: "SUSPENDED",
      reactivate: "APPROVED",
    };

    const newStatus = statusMap[action];
    if (newStatus) {
      await updateVendorStatus(
        session.shop,
        vendorId,
        newStatus,
        "admin",
        reason,
      );
    }
  }

  return json({ success: true });
};

function statusBadge(status: string) {
  const toneMap: Record<string, "success" | "attention" | "critical" | "info"> = {
    APPROVED: "success",
    PENDING: "attention",
    SUSPENDED: "critical",
    REJECTED: "critical",
    DEACTIVATED: "info",
  };
  return <Badge tone={toneMap[status] || undefined}>{status}</Badge>;
}

export default function VendorsPage() {
  const { vendors, total, page, totalPages } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", "1");
    setSearchParams(params);
  }, [searchValue, statusFilter, setSearchParams]);

  const handleAction = useCallback(
    (vendorId: string, action: string) => {
      const formData = new FormData();
      formData.set("vendorId", vendorId);
      formData.set("action", action);
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const rows = vendors.map((vendor) => [
    <Button
      key={vendor.id}
      variant="plain"
      onClick={() => navigate(`/app/vendors/${vendor.id}`)}
    >
      {vendor.storeName}
    </Button>,
    vendor.email,
    statusBadge(vendor.status),
    vendor._count.products,
    `$${vendor.totalSales.toFixed(2)}`,
    vendor.commissionRate ? `${vendor.commissionRate}%` : "Default",
    new Date(vendor.createdAt).toLocaleDateString(),
    <InlineStack key={`actions-${vendor.id}`} gap="200">
      {vendor.status === "PENDING" && (
        <>
          <Button size="slim" tone="success" onClick={() => handleAction(vendor.id, "approve")}>
            Approve
          </Button>
          <Button size="slim" tone="critical" onClick={() => handleAction(vendor.id, "reject")}>
            Reject
          </Button>
        </>
      )}
      {vendor.status === "APPROVED" && (
        <Button size="slim" tone="critical" onClick={() => handleAction(vendor.id, "suspend")}>
          Suspend
        </Button>
      )}
      {vendor.status === "SUSPENDED" && (
        <Button size="slim" onClick={() => handleAction(vendor.id, "reactivate")}>
          Reactivate
        </Button>
      )}
    </InlineStack>,
  ]);

  return (
    <Page>
      <TitleBar title="Vendor Management" />
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="400" align="start">
            <div style={{ flex: 1 }}>
              <TextField
                label=""
                labelHidden
                placeholder="Search vendors..."
                value={searchValue}
                onChange={setSearchValue}
                onBlur={handleSearch}
                autoComplete="off"
              />
            </div>
            <Select
              label=""
              labelHidden
              options={[
                { label: "All Statuses", value: "" },
                { label: "Pending", value: "PENDING" },
                { label: "Approved", value: "APPROVED" },
                { label: "Suspended", value: "SUSPENDED" },
                { label: "Rejected", value: "REJECTED" },
              ]}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                const params = new URLSearchParams();
                if (searchValue) params.set("search", searchValue);
                if (value) params.set("status", value);
                params.set("page", "1");
                setSearchParams(params);
              }}
            />
            <Button onClick={handleSearch}>Search</Button>
          </InlineStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Vendors ({total})
              </Text>
            </InlineStack>
            {vendors.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "numeric",
                    "numeric",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "Store",
                    "Email",
                    "Status",
                    "Products",
                    "Sales",
                    "Commission",
                    "Joined",
                    "Actions",
                  ]}
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
                  No vendors found.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
