import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function GET(req: NextRequest) {
  return proxyLandlordRequest(req, "/v1/landlord/metrics/overview");
}
