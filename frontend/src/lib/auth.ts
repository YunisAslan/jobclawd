import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

providers.push(
  CredentialsProvider({
    id: "magic-link",
    name: "Magic Link",
    credentials: {
      token: { label: "Token", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.token) return null;
      try {
        const res = await fetch(
          `${API_URL}/api/auth/verify-magic-link?token=${encodeURIComponent(credentials.token)}`
        );
        if (!res.ok) return null;
        const user = await res.json();
        return { id: user.email, email: user.email, name: user.name };
      } catch {
        return null;
      }
    },
  })
);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async redirect() {
      return "/dashboard";
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
};
