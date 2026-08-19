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
const PUBLIC = ["/login", "/", "/ranking"];
const MIDDLEWARE_SUPABASE_TIMEOUT_MS = 4_000;

function isPublicPath(pathname: string): boolean {
  return PUBLIC.includes(pathname) || pathname.startsWith("/ranking/");
}

function needsAuthPath(pathname: string): boolean {
  return (
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(STAFF_PREFIX) ||
    pathname.startsWith(COUNTER_PREFIX) ||
    pathname.startsWith(GUEST_PREFIX)
  );
}

/** Supabase 세션 쿠키가 없으면 getUser() 호출 불필요 */
function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.includes("-auth-token") || cookie.name.startsWith("sb-"),
  );
}

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), MIDDLEWARE_SUPABASE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getAuthUser(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ id: string } | null> {
  const result = await withTimeout<Awaited<ReturnType<typeof supabase.auth.getUser>> | null>(
    supabase.auth.getUser(),
    null,
  );
  return result?.data.user ?? null;
}

async function getRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<string | null> {
  const result = await withTimeout<
    Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>> | null
  >(supabase.from("profiles").select("role").eq("id", userId).single(), null);
  const role = result?.data?.role;
  return typeof role === "string" ? role : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent");

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const hasSession = hasSupabaseSessionCookie(request);
  const needsAuth = needsAuthPath(pathname);

  // Supabase 장애·잘못된 URL 시 hang 방지: 인증 불필요 + 세션 없음 → 바로 통과
  if (!needsAuth && !hasSession) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname) && !hasSession) {
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

  const user = await getAuthUser(supabase);

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

  if (isPublicPath(pathname) && pathname !== "/") {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
