export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/school/:path*",
    "/teacher/:path*",
    "/finance/:path*",
    "/supervision/:path*",
    "/admin/:path*",
    "/parent/:path*",
    "/api/attendance/:path*",
    "/api/lessons/:path*",
    "/api/grades/:path*",
    "/api/school/:path*",
    "/api/finance/:path*",
  ],
}