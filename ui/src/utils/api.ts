'use server';

import axios from 'axios';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/auth';

export const getClientWithAccessToken = async (accessToken?: string) => {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: '',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return axios.create({
    baseURL: process.env.API_URL,
    headers: headers,
  });
};

export const getClient = async () => {
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  return getClientWithAccessToken(accessToken);
};
