import { Seeder } from 'typeorm-extension';

import { Inference } from '@/modules/inference/entities/inference.entity';
import { InferenceCategory } from '@/modules/inference/inference.enum';
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

export class InferenceSeeder implements Seeder {
  public async run(): Promise<void> {
    await Inference.delete({});

    await Inference.save([
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MAJOR,
        rate: 0.8,
        reason: '메이저 코인 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MINOR,
        rate: 0,
        reason: '마이너 코인 추론 내용입니다.',
        ticker: 'XRP/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.NASDAQ,
        rate: 0.6,
        reason: '나스닥 종목 추론 내용입니다.',
        ticker: 'AAPL',
      },
    ]);
  }
}

export class TradeSeeder implements Seeder {
  async run(): Promise<void> {
    const users = await User.find();
    const inferences = await Inference.find();
    await Trade.delete({});

    await Trade.save([
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.BUY,
        ticker: 'BTC/KRW',
        amount: 1000000,
        inference: inferences[0],
      },
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.SELL,
        ticker: 'BTC/KRW',
        amount: 0.01,
        inference: inferences[1],
      },
    ]);
  }
}

export class NotifySeeder implements Seeder {
  async run(): Promise<void> {
    const users = await User.find();
    await Notify.delete({});

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

export const seeders = [UserSeeder, InferenceSeeder, TradeSeeder, NotifySeeder];
