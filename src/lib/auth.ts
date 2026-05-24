import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/db"
import { deriveKeys } from "@/lib/crypto"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string }
          })

          if (!user) return null

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash || "$2b$10$dummy.hash.for.timing.eq"
          )

          if (!isValid) return null

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            // Pass through for JWT callback to derive keys
            password: credentials.password as string,
            keySalt: user.keySalt,
          } as any
        } catch (err) {
          console.error("Auth error:", err)
          return null
        }
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/auth/signup",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = String(user.id);
      }
      // On sign in, derive encryption keys from password and store in JWT
      if (trigger === "signIn" && (user as any)?.password && (user as any)?.keySalt) {
        try {
          const keys = deriveKeys((user as any).password as string, (user as any).keySalt as string);
          token.encKey = keys.encKey.toString("base64");
          token.pseudoKey = keys.pseudoKey.toString("base64");
        } catch (e) {
          console.error("Failed to derive encryption keys during sign-in, continuing without encryption:", e);
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.encKey = token.encKey as string;
        session.user.pseudoKey = token.pseudoKey as string;
      }
      return session
    }
  }
})