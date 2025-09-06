import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PaginatedItem } from '../item/item.interface';
import { Permission } from '../permission/permission.enum';
import { BlacklistService } from './blacklist.service';
import { BlacklistDto } from './dto/blacklist.dto';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';
import { GetBlacklistsDto } from './dto/get-blacklists.dto';
import { UpdateBlacklistDto } from './dto/update-blacklist.dto';
import { Blacklist } from './entities/blacklist.entity';

@Controller('api/v1/blacklists')
export class BlacklistController {
  constructor(private readonly blacklistService: BlacklistService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_BLACKLISTS)
  async findAll(@Query() params: GetBlacklistsDto): Promise<PaginatedItem<BlacklistDto>> {
    const result = await this.blacklistService.paginate(params);
    return {
      ...result,
      items: result.items.map(this.toResponseDto),
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_BLACKLISTS)
  async findOne(@Param('id') id: string): Promise<BlacklistDto> {
    const blacklist = await this.blacklistService.findOne(id);
    return this.toResponseDto(blacklist);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_BLACKLISTS)
  async save(@Body() createBlacklistDto: CreateBlacklistDto): Promise<BlacklistDto> {
    const blacklist = await this.blacklistService.save(createBlacklistDto);
    return this.toResponseDto(blacklist);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_BLACKLISTS)
  async update(@Param('id') id: string, @Body() updateBlacklistDto: UpdateBlacklistDto): Promise<BlacklistDto> {
    const blacklist = await this.blacklistService.update(id, updateBlacklistDto);
    return this.toResponseDto(blacklist);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_BLACKLISTS)
  async remove(@Param('id') id: string): Promise<void> {
    await this.blacklistService.remove(id);
  }

  private toResponseDto(blacklist: Blacklist): BlacklistDto {
    const response = new BlacklistDto();
    response.id = blacklist.id;
    response.symbol = blacklist.symbol;
    response.category = blacklist.category;
    response.createdAt = blacklist.createdAt;
    response.updatedAt = blacklist.updatedAt;
    return response;
  }
}
