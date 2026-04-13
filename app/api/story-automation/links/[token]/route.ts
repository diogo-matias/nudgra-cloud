import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const { destinationUrl } = await fetchMutation(
      api.automations.storyTracking.consumeTrackedLink,
      { token },
    );

    return NextResponse.redirect(new URL(destinationUrl), { status: 302 });
  } catch {
    return new NextResponse("Tracked link not found.", { status: 404 });
  }
}
