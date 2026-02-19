import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/feed/:path*",
    "/applications/:path*",
    "/profile/:path*",
    "/settings/:path*",
  ],
};
