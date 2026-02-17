import { randomUUID } from 'crypto';
import { Seeder } from 'typeorm-extension';

import { Category } from '@/modules/category/category.enum';
import { UserCategory } from '@/modules/category/entities/user-category.entity';
import { History } from '@/modules/history/entities/history.entity';
import { Notify } from '@/modules/notify/entities/notify.entity';
import { BalanceRecommendation } from '@/modules/rebalance/entities/balance-recommendation.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Sequence } from '@/modules/sequence/entities/sequence.entity';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';

export class UserSeeder implements Seeder {
  async run(): Promise<void> {
    const email = process.env.ADMIN_EMAIL!;
    let user = await User.findOneBy({ email });

    if (!user) {
      user = new User();
      user.email = email;
    }

    const adminRole = await Role.findOneBy({ name: 'ADMIN' });
    if (adminRole) {
      user.roles = [adminRole];
    }

    await user.save();
  }
}

export class BalanceRecommendationSeeder implements Seeder {
  public async run(): Promise<void> {
    await BalanceRecommendation.createQueryBuilder().delete().execute();

    for (let i = 0; i < 11; i++) {
      const batchId = randomUUID();
      const majorPrevRate = i < 6 ? 0.7 + (i % 3) * 0.05 : null;
      const minorPrevRate = i < 4 ? -0.3 + (i % 2) * 0.1 : null;

      await BalanceRecommendation.save([
        {
          batchId,
          seq: (await new Sequence().save()).value,
          category: Category.COIN_MAJOR,
          rate: 0.8,
          ...(majorPrevRate !== null ? { prevRate: majorPrevRate } : {}),
          reason: `${i + 1}) 메이저 코인 추론 내용입니다.`,
          symbol: 'BTC/KRW',
        },
        {
          batchId,
          seq: (await new Sequence().save()).value,
          category: Category.COIN_MINOR,
          rate: -0.5,
          ...(minorPrevRate !== null ? { prevRate: minorPrevRate } : {}),
          reason: `${i + 1}) 마이너 코인 추론 내용입니다.`,
          symbol: 'XRP/KRW',
        },
        {
          batchId,
          seq: (await new Sequence().save()).value,
          category: Category.NASDAQ,
          rate: 0,
          reason: `${i + 1}) 나스닥 종목 추론 내용입니다.`,
          symbol: 'AAPL',
        },
      ]);
    }
  }
}

export class TradeSeeder implements Seeder {
  async run(): Promise<void> {
    const users = await User.find();
    const inferences = await BalanceRecommendation.find();
    await Trade.createQueryBuilder().delete().execute();

    await Trade.save([
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.BUY,
        symbol: 'BTC/KRW',
        amount: 1000000,
        profit: 100000,
        inference: inferences[0],
      },
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.SELL,
        symbol: 'BTC/KRW',
        amount: 1000000,
        profit: -50000,
        inference: inferences[1],
      },
    ]);
  }
}

export class NotifySeeder implements Seeder {
  async run(): Promise<void> {
    const users = await User.find();
    await Notify.createQueryBuilder().delete().execute();

    await Notify.save([
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        message:
          '`테스트 메시지 1`입니다. *테스트 메시지 1*입니다. 테스트 메시지 1입니다. 테스트 메시지 1입니다. 테스트 메시지 1입니다.',
      },
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        message:
          '`테스트 메시지 2`입니다. *테스트 메시지 2*입니다. 테스트 메시지 2입니다. 테스트 메시지 2입니다. 테스트 메시지 2입니다.',
      },
    ]);
  }
}

/**
 * 보유 종목(History) 개발용 시드 - 대시보드 위젯에서 목록 표시용
 * 카테고리별 다양한 종목으로 매매 카테고리 필터 테스트 가능
 */
export class HistorySeeder implements Seeder {
  async run(): Promise<void> {
    await History.createQueryBuilder().delete().execute();

    await History.save([
      // 메이저 코인
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, index: 0 },
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR, index: 1 },
      { symbol: 'SOL/KRW', category: Category.COIN_MAJOR, index: 2 },
      // 마이너 코인
      { symbol: 'XRP/KRW', category: Category.COIN_MINOR, index: 3 },
      { symbol: 'ADA/KRW', category: Category.COIN_MINOR, index: 4 },
      { symbol: 'DOGE/KRW', category: Category.COIN_MINOR, index: 5 },
      // 나스닥
      { symbol: 'AAPL', category: Category.NASDAQ, index: 6 },
      { symbol: 'MSFT', category: Category.NASDAQ, index: 7 },
      { symbol: 'NVDA', category: Category.NASDAQ, index: 8 },
    ]);
  }
}

/**
 * 개발용 매매 카테고리 시드 - 보유 종목 위젯 필터 테스트용
 * 관리자 계정은 메이저/마이너 코인만 활성화, 나스닥 비활성화로 넣어서
 * 설정 화면에서 나스닥을 켜면 보유 종목에 AAPL 등이 보이는지 확인 가능
 */
export class UserCategorySeeder implements Seeder {
  async run(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    if (!email) return;

    const user = await User.findOneBy({ email });
    if (!user) return;

    const categories = await UserCategory.find({ where: { user: { id: user.id } } });
    const existingCategories = new Set(categories.map((c) => c.category));

    const targetStates: { category: Category; enabled: boolean }[] = [
      { category: Category.COIN_MAJOR, enabled: true },
      { category: Category.COIN_MINOR, enabled: true },
      { category: Category.NASDAQ, enabled: false },
    ];

    for (const { category, enabled } of targetStates) {
      if (existingCategories.has(category)) {
        const uc = categories.find((c) => c.category === category);
        if (uc && uc.enabled !== enabled) {
          uc.enabled = enabled;
          await uc.save();
        }
      } else {
        await UserCategory.create({ user, category, enabled }).save();
      }
    }
  }
}

export const seeders = [
  UserSeeder,
  UserCategorySeeder,
  BalanceRecommendationSeeder,
  TradeSeeder,
  NotifySeeder,
  HistorySeeder,
];
