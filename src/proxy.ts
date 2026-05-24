import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = [
  "/",
  "/security",
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/verify-request",
  "/auth/error",
]

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Allow public paths without auth check
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next()
  }

  // Protected pages
  if (!req.auth) {
    const signinUrl = new URL("/auth/signin", req.nextUrl.origin)
    signinUrl.searchParams.set("callbackUrl", req.nextUrl.href)
    signinUrl.searchParams.set("reason", "unauthenticated")
    return NextResponse.redirect(signinUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/input",
    "/graph",
    "/suggestions",
    "/members",
    "/members/:path*",
  ],
}
