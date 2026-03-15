import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Select,
  Button,
  InlineStack,
  DataTable,
  Badge,
  Box,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const plans = await db.subscriptionPlan.findMany({
    where: { shop: session.shop },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { subscriptions: true } },
    },
  });

  return json({ plans });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    await db.subscriptionPlan.create({
      data: {
        shop: session.shop,
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        price: parseFloat(formData.get("price") as string) || 0,
        interval: (formData.get("interval") as any) || "MONTHLY",
        productLimit: formData.get("productLimit")
          ? parseInt(formData.get("productLimit") as string, 10)
          : null,
        commissionRate: formData.get("commissionRate")
          ? parseFloat(formData.get("commissionRate") as string)
          : null,
      },
    });
  } else if (intent === "toggle") {
    const planId = formData.get("planId") as string;
    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (plan) {
      await db.subscriptionPlan.update({
        where: { id: planId },
        data: { isActive: !plan.isActive },
      });
    }
  }

  return json({ success: true });
};

export default function SubscriptionsPage() {
  const { plans } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    interval: "MONTHLY",
    productLimit: "",
    commissionRate: "",
  });

  const handleCreate = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "create");
    formData.set("name", form.name);
    formData.set("description", form.description);
    formData.set("price", form.price);
    formData.set("interval", form.interval);
    if (form.productLimit) formData.set("productLimit", form.productLimit);
    if (form.commissionRate) formData.set("commissionRate", form.commissionRate);
    submit(formData, { method: "post" });
    setShowForm(false);
    setForm({ name: "", description: "", price: "", interval: "MONTHLY", productLimit: "", commissionRate: "" });
    shopify.toast.show("Plan created");
  }, [form, submit, shopify]);

  const handleToggle = useCallback(
    (planId: string) => {
      const formData = new FormData();
      formData.set("intent", "toggle");
      formData.set("planId", planId);
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const rows = plans.map((plan) => [
    plan.name,
    `${formatCurrency(plan.price)}/${plan.interval.toLowerCase()}`,
    plan.productLimit ? String(plan.productLimit) : "Unlimited",
    plan.commissionRate ? `${plan.commissionRate}%` : "Default",
    plan._count.subscriptions,
    plan.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
    <Button key={plan.id} size="slim" onClick={() => handleToggle(plan.id)}>
      {plan.isActive ? "Deactivate" : "Activate"}
    </Button>,
  ]);

  return (
    <Page>
      <TitleBar title="Subscription Plans">
        <button variant="primary" onClick={() => setShowForm(true)}>
          Create Plan
        </button>
      </TitleBar>
      <BlockStack gap="400">
        {showForm && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">New Subscription Plan</Text>
              <TextField label="Plan Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} autoComplete="off" />
              <TextField label="Description" value={form.description} onChange={(v) => setForm((s) => ({ ...s, description: v }))} autoComplete="off" multiline={2} />
              <InlineStack gap="400">
                <div style={{ flex: 1 }}>
                  <TextField label="Price" type="number" value={form.price} onChange={(v) => setForm((s) => ({ ...s, price: v }))} prefix="$" autoComplete="off" />
                </div>
                <div style={{ flex: 1 }}>
                  <Select label="Billing Interval" options={[{ label: "Monthly", value: "MONTHLY" }, { label: "Yearly", value: "YEARLY" }]} value={form.interval} onChange={(v) => setForm((s) => ({ ...s, interval: v }))} />
                </div>
              </InlineStack>
              <InlineStack gap="400">
                <div style={{ flex: 1 }}>
                  <TextField label="Product Limit (empty = unlimited)" type="number" value={form.productLimit} onChange={(v) => setForm((s) => ({ ...s, productLimit: v }))} autoComplete="off" />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField label="Commission Rate Override %" type="number" value={form.commissionRate} onChange={(v) => setForm((s) => ({ ...s, commissionRate: v }))} suffix="%" autoComplete="off" />
                </div>
              </InlineStack>
              <InlineStack gap="200" align="end">
                <Button onClick={() => setShowForm(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleCreate} disabled={!form.name || !form.price}>Create Plan</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Subscription Plans</Text>
            {plans.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "numeric", "text", "text"]}
                headings={["Plan", "Price", "Product Limit", "Commission", "Subscribers", "Status", "Actions"]}
                rows={rows}
              />
            ) : (
              <Box padding="400">
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  No subscription plans yet. Create one to start charging vendors.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
