import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; override_id: string }> }
) {
  const { id, override_id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/businesses/${id}/overrides/${override_id}`, "DELETE");
}
