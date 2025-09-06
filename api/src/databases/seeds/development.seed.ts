import { Seeder } from 'typeorm-extension';

import { Category } from '@/modules/category/category.enum';
import { BalanceRecommendation } from '@/modules/inference/entities/balance-recommendation.entity';
import { Notify } from '@/modules/notify/entities/notify.entity';
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
      await BalanceRecommendation.save([
        {
          seq: (await new Sequence().save()).value,
          category: Category.COIN_MAJOR,
          rate: 0.8,
          reason: `${i + 1}) 메이저 코인 추론 내용입니다.`,
          symbol: 'BTC/KRW',
        },
        {
          seq: (await new Sequence().save()).value,
          category: Category.COIN_MINOR,
          rate: -0.5,
          reason: `${i + 1}) 마이너 코인 추론 내용입니다.`,
          symbol: 'XRP/KRW',
        },
        {
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

export const seeders = [UserSeeder, TradeSeeder, NotifySeeder, BalanceRecommendationSeeder];
