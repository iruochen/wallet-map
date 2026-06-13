import { NextResponse, type NextRequest } from "next/server";
import { readLabelManagerEnabled } from "./lib/feature-config";

export function proxy(request: NextRequest) {
  if (!readLabelManagerEnabled() && request.nextUrl.pathname === "/labels") {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/labels"],
};
