import NextAuth, { ISODateString } from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/signin',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.iat = account.iat;
        token.exp = account.exp;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token?.accessToken as string;
      session.expires = token?.exp as ISODateString;
      if (process.env.NODE_ENV === 'development') {
        console.log(session);
      }
      return session;
    },
  },
};

export const handler = NextAuth(authOptions);
