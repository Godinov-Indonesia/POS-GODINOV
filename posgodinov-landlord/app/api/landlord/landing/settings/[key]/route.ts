import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/landing/settings/${key}`, "PUT");
}
