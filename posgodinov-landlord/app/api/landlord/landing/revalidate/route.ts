import { NextRequest } from "next/server";
import { proxyLandlordRequest } from "@/lib/api/proxy";

export async function POST(req: NextRequest) {
  return proxyLandlordRequest(req, "/v1/landlord/landing/revalidate", "POST");
}
