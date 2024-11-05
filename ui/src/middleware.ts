export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/((?!health|signin|_next/static|_next/image|favicon.ico).*)'],
};
