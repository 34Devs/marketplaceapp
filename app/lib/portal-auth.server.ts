import { createCookieSessionStorage, redirect } from "@remix-run/node";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

const vendorSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "vendorhub-vendor-session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getVendorSession(request: Request) {
  return vendorSessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getVendorId(request: Request): Promise<string | null> {
  const session = await getVendorSession(request);
  return session.get("vendorId") || null;
}

export async function requireVendorId(request: Request): Promise<string> {
  const vendorId = await getVendorId(request);
  if (!vendorId) {
    throw redirect("/apps/vendorhub/login");
  }
  return vendorId;
}

export async function createVendorSession(
  vendorId: string,
  redirectTo: string,
) {
  const session = await vendorSessionStorage.getSession();
  session.set("vendorId", vendorId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await vendorSessionStorage.commitSession(session),
    },
  });
}

export async function destroyVendorSession(request: Request) {
  const session = await getVendorSession(request);
  return redirect("/apps/vendorhub/login", {
    headers: {
      "Set-Cookie": await vendorSessionStorage.destroySession(session),
    },
  });
}
