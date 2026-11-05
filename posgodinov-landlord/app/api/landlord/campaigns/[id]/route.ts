import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/campaigns/${id}`);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/campaigns/${id}`, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/campaigns/${id}`, "DELETE");
}
