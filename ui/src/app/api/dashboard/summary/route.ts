import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';

import { authOptions } from '@/auth';

const buildApiUrl = (path: string): string => {
  return new URL(path, process.env.API_URL).toString();
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  void request;

  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  if (!accessToken) {
    const t = await getTranslations();
    return NextResponse.json({ message: t('error.unauthorized') }, { status: 401 });
  }

  const response = await fetch(buildApiUrl('/api/v1/dashboard/summary'), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? 'application/json';

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': contentType,
    },
  });
}
