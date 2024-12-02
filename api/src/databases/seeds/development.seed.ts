import { Seeder } from 'typeorm-extension';

import { DecisionTypes } from '@/modules/decision/decision.enum';
import { Decision } from '@/modules/decision/entities/decision.entity';
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
  async run(): Promise<void> {
    const users = await User.find();
    await Inference.delete({});
    await Decision.delete({});

    const weightBounds = Array.from({ length: 8 }, (_, i) => i * 0.125);

    await Inference.save([
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MAJOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound, index) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: index < 1 ? users : [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MAJOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound, index) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: index < 1 ? users : [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MINOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound, index) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: index < 1 ? users : [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'ETH/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MINOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'ETH/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.NASDAQ,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.SELL,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.NASDAQ,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.SELL,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MAJOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 1,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MAJOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 1,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MINOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 1,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
      {
        seq: (await new Sequence().save()).value,
        category: InferenceCategory.COIN_MINOR,
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 1,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.125,
            users: [],
          })),
        ),
        reason: '테스트 추론 내용입니다.',
        ticker: 'BTC/KRW',
      },
    ]);
  }
}

export class TradeSeeder implements Seeder {
  async run(): Promise<void> {
    const users = await User.find();
    const decisions = await Decision.find();
    await Trade.delete({});

    await Trade.save([
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.BUY,
        ticker: 'BTC/KRW',
        amount: 1000000,
        decision: decisions[0],
      },
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.SELL,
        ticker: 'BTC/KRW',
        amount: 0.05,
        decision: decisions[1],
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
