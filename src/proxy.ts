export { auth as proxy } from "@/lib/auth"

export const config = {
  matcher: ["/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)"]
}
