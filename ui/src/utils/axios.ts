import axios from 'axios';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/auth';

const headers = {
  'Content-Type': 'application/json',
  Authorization: '',
};

const session = await getServerSession(authOptions);

if (session?.user?.accessToken) {
  headers['Authorization'] = `Bearer ${session?.user?.accessToken}`;
}

export const api = axios.create({
  baseURL: process.env.API_URL,
  headers: headers,
});
