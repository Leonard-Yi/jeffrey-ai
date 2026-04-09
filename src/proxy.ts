import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/verify-request",
  "/auth/error",
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static resources and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith("/auth/"))) {
    return NextResponse.next()
  }

  // Feature pages require authentication
  const session = await auth()

  if (!session) {
    const signinUrl = new URL("/auth/signin", request.url)
    signinUrl.searchParams.set("reason", "unauthenticated")
    return NextResponse.redirect(signinUrl)
  }

  // Check email verification
  if (!session.user?.id) {
    const signinUrl = new URL("/auth/signin", request.url)
    signinUrl.searchParams.set("reason", "unauthenticated")
    return NextResponse.redirect(signinUrl)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  })

  if (!user?.emailVerified) {
    return NextResponse.redirect(new URL("/auth/verify-request", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/input",
    "/graph",
    "/suggestions",
    "/members",
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}