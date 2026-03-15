import type { LoaderFunctionArgs } from "@remix-run/node";
import { destroyVendorSession } from "../lib/portal-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return destroyVendorSession(request);
};
