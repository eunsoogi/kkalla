import { Role } from './src/interfaces/role.interface';

declare module 'next-auth' {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    expires: ISODateString;
    accessToken: string;
    roles: Role[];
    permissions: string[];
  }
}
