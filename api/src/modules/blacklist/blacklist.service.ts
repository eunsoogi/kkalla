import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { HoldingLedgerService } from '../holding-ledger/holding-ledger.service';
import { PaginatedItem } from '../item/item.types';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';
import { GetBlacklistsDto } from './dto/get-blacklists.dto';
import { UpdateBlacklistDto } from './dto/update-blacklist.dto';
import { Blacklist } from './entities/blacklist.entity';

@Injectable()
export class BlacklistService {
  constructor(
    private readonly i18nService: I18nService,
    private readonly holdingLedgerService: HoldingLedgerService,
  ) {}

  public async findOne(id: string): Promise<Blacklist> {
    const blacklist = await Blacklist.findOneBy({ id });
    if (!blacklist) {
      throw new NotFoundException(this.i18nService.t('logging.blacklist.notFound', { args: { id } }));
    }
    return blacklist;
  }

  public async findAll(): Promise<Blacklist[]> {
    return await Blacklist.find();
  }

  public async paginate(params: GetBlacklistsDto): Promise<PaginatedItem<Blacklist>> {
    return Blacklist.paginate(params);
  }

  public async save(blacklist: CreateBlacklistDto): Promise<Blacklist> {
    const entity = new Blacklist();
    Object.assign(entity, blacklist);
    const savedBlacklist = await Blacklist.save(entity);
    await this.holdingLedgerService.removeHoldingsForAllUsers([
      { symbol: savedBlacklist.symbol, category: savedBlacklist.category },
    ]);
    return savedBlacklist;
  }

  public async update(id: string, updateBlacklistDto: UpdateBlacklistDto): Promise<Blacklist> {
    const blacklist = await Blacklist.findOneBy({ id });
    if (!blacklist) {
      throw new NotFoundException(this.i18nService.t('logging.blacklist.notFound', { args: { id } }));
    }
    Object.assign(blacklist, updateBlacklistDto);
    const savedBlacklist = await Blacklist.save(blacklist);
    await this.holdingLedgerService.removeHoldingsForAllUsers([
      { symbol: savedBlacklist.symbol, category: savedBlacklist.category },
    ]);
    return savedBlacklist;
  }

  public async remove(id: string): Promise<void> {
    const blacklist = await Blacklist.findOneBy({ id });
    if (!blacklist) {
      throw new NotFoundException(this.i18nService.t('logging.blacklist.notFound', { args: { id } }));
    }
    await Blacklist.remove(blacklist);
  }
}
