import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminArea,
  canManageAccounts,
  isManagerOrAdmin,
  isScreenRole,
} from "@/lib/auth/roles";
import { getCounterRedirectPath, getHomePath } from "@/lib/auth/routes";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

const ADMIN_PREFIX = "/admin";
const STAFF_PREFIX = "/staff";
const COUNTER_PREFIX = "/counter";
const GUEST_PREFIX = "/guest";
const PUBLIC = ["/login", "/"];

async function getRole(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile?.role ?? null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent");

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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

  if (user) {
    const role = await getRole(supabase, user.id);

    if (isScreenRole(role)) {
      const screenHome = getCounterRedirectPath(role, userAgent);
      const allowed =
        pathname.startsWith("/tv") ||
        pathname === "/login" ||
        pathname.startsWith(COUNTER_PREFIX);

      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = screenHome;
        return NextResponse.redirect(url);
      }

      if (pathname === "/login" || pathname === "/") {
        const url = request.nextUrl.clone();
        url.pathname = screenHome;
        return NextResponse.redirect(url);
      }

      return response;
    }

    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = getHomePath(role);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith(ADMIN_PREFIX)) {
      const staffAllowedAdmin =
        role === "staff" &&
        (pathname.startsWith("/admin/games") || pathname.startsWith("/admin/tables"));

      const accountsOnlyAdmin =
        pathname.startsWith("/admin/accounts") && !canManageAccounts(role);

      if (accountsOnlyAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return NextResponse.redirect(url);
      }

      if (!canAccessAdminArea(role) && !staffAllowedAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = role === "staff" ? "/staff/tables" : getHomePath(role);
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith(GUEST_PREFIX)) {
      if (role === "staff") {
        const url = request.nextUrl.clone();
        url.pathname = "/staff/tables";
        return NextResponse.redirect(url);
      }
      if (isManagerOrAdmin(role) || role === "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith(COUNTER_PREFIX)) {
      if (!canAccessAdminArea(role) && role !== "staff") {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith(STAFF_PREFIX)) {
      if (role !== "staff" && !isManagerOrAdmin(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }

    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = getHomePath(role);
      return NextResponse.redirect(url);
    }
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
