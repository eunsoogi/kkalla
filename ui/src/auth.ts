import axios from 'axios';
import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';

import { Role } from '@/shared/types/role.types';
import { getClientWithAccessToken } from './utils/api';

/**
 * Handles refresh access token in the dashboard UI workflow.
 * @param token - Input value for token.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  try {
    const { data: refreshedTokens } = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
    };
  } catch (err) {
    console.error(err);
    return token;
  }
};

/**
 * Retrieves roles for the dashboard UI flow.
 * @param accessToken - Input value for access token.
 * @returns Processed collection for downstream workflow steps.
 */
const fetchRoles = async (accessToken?: string): Promise<Role[]> => {
  const client = await getClientWithAccessToken(accessToken);
  const response = await client.get('/api/v1/auth/roles');
  return response.data;
};

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
        /**
 * Handles jwt in the dashboard UI workflow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Result produced by the dashboard UI flow.
 */
async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      if (Date.now() > (token.expiresAt as number)) {
        token = await refreshAccessToken(token);
      }

      return token;
    },
        /**
 * Handles session in the dashboard UI workflow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Result produced by the dashboard UI flow.
 */
async session({ session, token }) {
      session.accessToken = token?.accessToken as string;

      const roles = await fetchRoles(session.accessToken);
      session.roles = roles;
      session.permissions = [...new Set(roles?.flatMap((role) => role?.permissions))];

      return session;
    },
  },
};

export const handler = NextAuth(authOptions);
