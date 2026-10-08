import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/connexion", "/inscription"];

/** Filtre léger : sans cookie de session, on renvoie vers la connexion. Les droits sont vérifiés dans chaque page. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.includes(pathname) || request.cookies.has("ef_session")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return new NextResponse("Non connecté", { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
