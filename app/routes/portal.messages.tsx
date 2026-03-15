import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const messages = await db.message.findMany({
    where: {
      OR: [{ senderId: vendorId }, { receiverId: vendorId }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Group by threadId
  const threads = new Map<string, typeof messages>();
  for (const msg of messages) {
    const existing = threads.get(msg.threadId) || [];
    existing.push(msg);
    threads.set(msg.threadId, existing);
  }

  const threadList = Array.from(threads.entries()).map(([threadId, msgs]) => ({
    threadId,
    subject: msgs[0].subject || "No Subject",
    lastMessage: msgs[0],
    messageCount: msgs.length,
    hasUnread: msgs.some((m) => !m.isRead && m.receiverId === vendorId),
  }));

  return json({ threads: threadList, vendorId });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const vendorId = await requireVendorId(request);
  const formData = await request.formData();

  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;

  if (!body) {
    return json({ error: "Message body is required", success: false }, { status: 400 });
  }

  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: { shop: true },
  });

  if (!vendor) throw new Response("Vendor not found", { status: 404 });

  const threadId = `thread_${Date.now()}_${vendorId}`;

  await db.message.create({
    data: {
      shop: vendor.shop,
      threadId,
      senderId: vendorId,
      receiverId: null, // to admin
      senderType: "VENDOR",
      subject: subject || "New Message",
      body,
    },
  });

  return json({ success: true, error: null });
};

export default function PortalMessages() {
  const { threads, vendorId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Messages</h1>

      {actionData?.success && (
        <div className="vh-alert vh-alert-success">Message sent to admin!</div>
      )}
      {actionData?.error && (
        <div className="vh-alert vh-alert-error">{actionData.error}</div>
      )}

      <div className="vh-grid vh-grid-2">
        <div>
          <div className="vh-card">
            <h2>New Message to Admin</h2>
            <Form method="post">
              <div className="vh-form-group">
                <label className="vh-label" htmlFor="subject">Subject</label>
                <input
                  className="vh-input"
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="Message subject"
                />
              </div>
              <div className="vh-form-group">
                <label className="vh-label" htmlFor="body">Message</label>
                <textarea
                  className="vh-input vh-textarea"
                  id="body"
                  name="body"
                  placeholder="Write your message..."
                  required
                />
              </div>
              <button type="submit" className="vh-btn vh-btn-primary" style={{ padding: "10px 24px" }}>
                Send Message
              </button>
            </Form>
          </div>
        </div>

        <div>
          <div className="vh-card">
            <h2>Message Threads</h2>
            {threads.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {threads.map((thread) => (
                  <div
                    key={thread.threadId}
                    style={{
                      padding: 12,
                      border: "1px solid #e1e3e5",
                      borderRadius: 8,
                      background: thread.hasUnread ? "#f1f0fb" : "white",
                    }}
                  >
                    <div className="vh-flex vh-flex-between vh-flex-center">
                      <strong style={{ fontSize: 14 }}>{thread.subject}</strong>
                      {thread.hasUnread && (
                        <span className="vh-badge vh-badge-info">New</span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#6d7175",
                        margin: "4px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {thread.lastMessage.body}
                    </p>
                    <span style={{ fontSize: 12, color: "#8c9196" }}>
                      {new Date(thread.lastMessage.createdAt).toLocaleString()} ·{" "}
                      {thread.messageCount} message{thread.messageCount > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vh-empty">
                <p>No messages yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
