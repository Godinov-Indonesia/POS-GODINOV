import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/businesses/${id}/overrides`, "POST");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const query = req.nextUrl.search;
  return proxyLandlordRequest(req, `/v1/landlord/businesses/${id}/overrides${query}`, "DELETE");
}
