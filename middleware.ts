import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_PREFIX = "/admin";
const STAFF_PREFIX = "/staff";
const COUNTER_PREFIX = "/counter";
const GUEST_PREFIX = "/guest";
const PUBLIC = ["/login", "/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth =
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(STAFF_PREFIX) ||
    pathname.startsWith(COUNTER_PREFIX) ||
    pathname.startsWith(GUEST_PREFIX);

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname =
      profile?.role === "guest"
        ? "/guest"
        : profile?.role === "staff"
          ? "/staff/games"
          : "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith(ADMIN_PREFIX)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const staffAllowedAdmin =
      profile?.role === "staff" &&
      (pathname.startsWith("/admin/games") || pathname.startsWith("/admin/tables"));

    if (profile?.role !== "admin" && !staffAllowedAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === "staff" ? "/staff/games" : "/login";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith(GUEST_PREFIX)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "staff") {
      const url = request.nextUrl.clone();
      url.pathname = "/staff/games";
      return NextResponse.redirect(url);
    }
    if (profile?.role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith(COUNTER_PREFIX)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "staff" && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith(STAFF_PREFIX)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "staff" && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname =
      profile?.role === "guest"
        ? "/guest"
        : profile?.role === "staff"
          ? "/staff/games"
          : "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  if (PUBLIC.includes(pathname) && pathname !== "/") {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
