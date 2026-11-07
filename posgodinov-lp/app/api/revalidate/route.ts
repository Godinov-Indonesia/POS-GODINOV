import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  return handleRevalidate(req);
}

export async function GET(req: NextRequest) {
  return handleRevalidate(req);
}

async function handleRevalidate(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag") || "landing-page";
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.LANDING_PAGE_REVALIDATE_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json(
      { error: "Invalid revalidation secret token" },
      { status: 401 }
    );
  }

  try {
    revalidateTag(tag, "max");
    revalidatePath("/");

    return NextResponse.json({
      revalidated: true,
      tag,
      path: "/",
      now: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to trigger revalidation" },
      { status: 500 }
    );
  }
}
