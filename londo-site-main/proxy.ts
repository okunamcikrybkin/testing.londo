import { NextResponse, type NextRequest } from "next/server";
// Only passes the current URL to server page guards. Authorization stays in the DB-backed session layer.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-londo-current-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
