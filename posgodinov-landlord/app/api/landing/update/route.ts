import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { ApiResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { hero_banner, contacts, announcement } = await req.json();
    
    // Validate required fields
    if (!hero_banner || !contacts || !announcement) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare payload for backend
    const payload = {
      hero_banner,
      contacts,
      announcement,
    };

    // Call backend API
    const response = await apiClient<ApiResponse<void>>(
      "/api/landlord/landing/update",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    return NextResponse.json(
      { success: true, message: "Pengaturan landing page berhasil diperbarui" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update landing page error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui pengaturan" },
      { status: error.response?.status || 500 }
    );
  }
}