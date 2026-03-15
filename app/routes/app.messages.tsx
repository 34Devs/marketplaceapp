import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  BlockStack,
  Text,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const messages = await db.message.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sender: { select: { storeName: true } },
      receiver: { select: { storeName: true } },
    },
  });

  // Group by thread
  const threads = new Map<
    string,
    { subject: string; messages: typeof messages; lastMessage: (typeof messages)[0] }
  >();
  for (const msg of messages) {
    if (!threads.has(msg.threadId)) {
      threads.set(msg.threadId, {
        subject: msg.subject || "No Subject",
        messages: [],
        lastMessage: msg,
      });
    }
    threads.get(msg.threadId)!.messages.push(msg);
  }

  return json({ threads: Array.from(threads.values()) });
};

export default function AdminMessages() {
  const { threads } = useLoaderData<typeof loader>();

  const rows = threads.map((thread) => [
    thread.subject,
    thread.lastMessage.sender.storeName,
    thread.lastMessage.senderType,
    thread.messages.length,
    thread.lastMessage.isRead ? (
      <Badge>Read</Badge>
    ) : (
      <Badge tone="attention">Unread</Badge>
    ),
    new Date(thread.lastMessage.createdAt).toLocaleString(),
  ]);

  return (
    <Page>
      <TitleBar title="Messages" />
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Message Threads ({threads.length})
          </Text>
          {threads.length > 0 ? (
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "text", "text"]}
              headings={["Subject", "From", "Type", "Messages", "Status", "Last Activity"]}
              rows={rows}
            />
          ) : (
            <Box padding="400">
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                No messages yet.
              </Text>
            </Box>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}
