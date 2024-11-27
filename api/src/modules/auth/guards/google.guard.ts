import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleTokenAuthGuard extends AuthGuard('google-token') {}
