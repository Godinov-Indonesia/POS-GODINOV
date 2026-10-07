import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function GET(req: NextRequest) {
  return proxyLandlordRequest(req, "/v1/landlord/landing/settings");
}

export async function PUT(req: NextRequest) {
  return proxyLandlordRequest(req, "/v1/landlord/landing/settings", "PUT");
}
