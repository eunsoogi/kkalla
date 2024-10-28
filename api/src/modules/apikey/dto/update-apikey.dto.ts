import { PartialType } from '@nestjs/mapped-types';

import { CreateApikeyDto } from './create-apikey.dto';

export class UpdateApikeyDto extends PartialType(CreateApikeyDto) {}
