import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("jc_token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/applications/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
  ],
};
