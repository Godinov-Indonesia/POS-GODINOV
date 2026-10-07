import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.search;
  return proxyLandlordRequest(req, `/v1/landlord/audit-logs${query}`);
}
