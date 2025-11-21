import prisma from '@/lib/db/prisma';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
type NextAuthOptions = Record<string, unknown>;
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { env } from '@/lib/env';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'admin@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (
          env.ADMIN_EMAIL &&
          env.ADMIN_PASSWORD &&
          credentials.email === env.ADMIN_EMAIL &&
          credentials.password === env.ADMIN_PASSWORD
        ) {
          const user = await prisma.user.upsert({
            where: { email: credentials.email },
            update: { name: 'Admin User', role: 'ADMIN' },
            create: { email: credentials.email, name: 'Admin User', role: 'ADMIN' },
          });
          return user;
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async session({
      session,
      user,
    }: {
      session: { user?: { id?: string; role?: string } };
      user: { id?: string; role?: string };
    }) {
      const userWithRole = user ?? {};
      if (session.user) {
        session.user.id = userWithRole.id ?? '';
        session.user.role = userWithRole.role ?? 'STAFF';
      }
      return session;
    },
  },
  secret: env.AUTH_SECRET,
};
