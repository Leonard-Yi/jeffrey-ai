import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/db"

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

          return { id: user.id, email: user.email, name: user.name }
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
    async jwt({ token, user }) {
      if (user) token.id = String(user.id)
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string
      return session
    }
  }
})