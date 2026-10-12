import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feature_key: string }> }
) {
  const { id, feature_key } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/plans/${id}/features/${feature_key}`, "PUT");
}
