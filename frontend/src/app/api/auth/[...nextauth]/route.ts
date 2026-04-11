import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      
      const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const response = await fetch(`${apiUrl}/auth/check-invite?email=${user.email}`);
        if (response.ok) {
          const data = await response.json();
          if (data.allowed) {
            return true;
          }
        }
        return "/?error=unauthorized";
      } catch (error) {
        console.error("Sign in check failed:", error);
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.id_token;
      }

      // Check invite status on every token update/refresh
      const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const response = await fetch(`${apiUrl}/auth/check-invite?email=${token.email}`);
        if (response.ok) {
          const data = await response.json();
          if (!data.allowed) {
            token.error = "Unauthorized";
          }
        }
      } catch (error) {
        console.error("Invite check in JWT failed:", error);
      }

      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // Default 1 day
  },
  secret: process.env.NEXTAUTH_SECRET || "some-secret",
};

const handler = async (req: any, res: any) => {
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get('remember-me');
  
  const options: NextAuthOptions = {
    ...authOptions,
    session: {
      ...authOptions.session,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    }
  };
  
  return await NextAuth(req, res, options);
};

export { handler as GET, handler as POST };
