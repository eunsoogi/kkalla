import axios from 'axios';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/auth';

export const getClient = async () => {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: '',
  };

  const session = await getServerSession(authOptions);

  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session?.accessToken}`;
  }

  return axios.create({
    baseURL: process.env.API_URL,
    headers: headers,
  });
};
