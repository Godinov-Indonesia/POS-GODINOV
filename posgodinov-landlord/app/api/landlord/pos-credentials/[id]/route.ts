import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/pos-credentials/${id}`);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/pos-credentials/${id}`, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyLandlordRequest(req, `/v1/landlord/pos-credentials/${id}`, "DELETE");
}
