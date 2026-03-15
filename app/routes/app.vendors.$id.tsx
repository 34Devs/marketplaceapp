import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  Button,
  DescriptionList,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getVendorById, updateVendorStatus } from "../lib/vendor.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const vendor = await getVendorById(params.id!);

  if (!vendor) {
    throw new Response("Vendor not found", { status: 404 });
  }

  return json({ vendor });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action") as string;
  const reason = formData.get("reason") as string | undefined;

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
      params.id!,
      newStatus,
      "admin",
      reason,
    );
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

export default function VendorDetailPage() {
  const { vendor } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleAction = (action: string) => {
    const formData = new FormData();
    formData.set("action", action);
    submit(formData, { method: "post" });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  return (
    <Page
      backAction={{ url: "/app/vendors" }}
      title={vendor.storeName}
      titleMetadata={statusBadge(vendor.status)}
    >
      <TitleBar title={vendor.storeName} />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Vendor Information
                </Text>
                <DescriptionList
                  items={[
                    { term: "Email", description: vendor.email },
                    { term: "Store Name", description: vendor.storeName },
                    { term: "Slug", description: vendor.slug },
                    {
                      term: "Description",
                      description: vendor.description || "No description",
                    },
                    { term: "Phone", description: vendor.phone || "Not provided" },
                    {
                      term: "Joined",
                      description: new Date(vendor.createdAt).toLocaleDateString(),
                    },
                    {
                      term: "Last Login",
                      description: vendor.lastLoginAt
                        ? new Date(vendor.lastLoginAt).toLocaleString()
                        : "Never",
                    },
                  ]}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Payout Configuration
                </Text>
                <DescriptionList
                  items={[
                    {
                      term: "Payout Method",
                      description: vendor.payoutMethod || "Not configured",
                    },
                    {
                      term: "Stripe Connect ID",
                      description: vendor.stripeConnectId || "Not connected",
                    },
                    {
                      term: "PayPal Email",
                      description: vendor.paypalEmail || "Not provided",
                    },
                  ]}
                />
              </BlockStack>
            </Card>

            {vendor.subscription && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Subscription
                  </Text>
                  <DescriptionList
                    items={[
                      { term: "Plan", description: vendor.subscription.plan.name },
                      {
                        term: "Price",
                        description: `${formatCurrency(vendor.subscription.plan.price)}/${vendor.subscription.plan.interval.toLowerCase()}`,
                      },
                      { term: "Status", description: vendor.subscription.status },
                      {
                        term: "Current Period",
                        description: `${new Date(vendor.subscription.currentPeriodStart).toLocaleDateString()} - ${new Date(vendor.subscription.currentPeriodEnd).toLocaleDateString()}`,
                      },
                    ]}
                  />
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Statistics
                </Text>
                <DescriptionList
                  items={[
                    {
                      term: "Total Sales",
                      description: formatCurrency(vendor.totalSales),
                    },
                    {
                      term: "Total Orders",
                      description: String(vendor.totalOrders),
                    },
                    {
                      term: "Products",
                      description: String(vendor._count.products),
                    },
                    {
                      term: "Reviews",
                      description: String(vendor._count.reviewsReceived),
                    },
                    {
                      term: "Rating",
                      description:
                        vendor.rating > 0
                          ? `${vendor.rating.toFixed(1)} / 5.0`
                          : "No ratings yet",
                    },
                  ]}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Commission
                </Text>
                <DescriptionList
                  items={[
                    {
                      term: "Rate",
                      description: vendor.commissionRate
                        ? `${vendor.commissionRate}% (custom)`
                        : "Store default",
                    },
                    {
                      term: "Type",
                      description: vendor.commissionType || "Percentage",
                    },
                  ]}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Actions
                </Text>
                <BlockStack gap="200">
                  {vendor.status === "PENDING" && (
                    <>
                      <Button
                        tone="success"
                        fullWidth
                        onClick={() => handleAction("approve")}
                      >
                        Approve Vendor
                      </Button>
                      <Button
                        tone="critical"
                        fullWidth
                        onClick={() => handleAction("reject")}
                      >
                        Reject Vendor
                      </Button>
                    </>
                  )}
                  {vendor.status === "APPROVED" && (
                    <Button
                      tone="critical"
                      fullWidth
                      onClick={() => handleAction("suspend")}
                    >
                      Suspend Vendor
                    </Button>
                  )}
                  {vendor.status === "SUSPENDED" && (
                    <Button fullWidth onClick={() => handleAction("reactivate")}>
                      Reactivate Vendor
                    </Button>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
