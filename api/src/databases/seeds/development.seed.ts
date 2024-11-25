import { DecisionTypes } from '@/modules/decision/decision.enum';
import { Decision } from '@/modules/decision/entities/decision.entity';
import { Inference } from '@/modules/inference/entities/inference.entity';
import { Notify } from '@/modules/notify/entities/notify.entity';
import { Sequence } from '@/modules/sequence/entities/sequence.entity';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';

export const seeds = {
  users: async () => {
    const email = process.env.TEST_EMAIL!;
    let user = await User.findOneBy({ email });
    if (!user) {
      user = new User();
      user.email = email;
    }
    await user.save();
  },
  inferences: async () => {
    const users = await User.find();
    await Inference.delete({});
    await Decision.delete({});

    const weightBounds = Array.from({ length: 5 }, (_, i) => i * 0.2);

    await Inference.save([
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
            users,
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'ETH',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
            users,
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'ETH',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.BUY,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.SELL,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
            users,
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.SELL,
            orderRatio: 0.3,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 0,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
            users,
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 0,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
          })),
        ),
      },
      {
        seq: (await new Sequence().save()).value,
        symbol: 'BTC',
        decisions: await Promise.all(
          weightBounds.map(async (lowerBound) => ({
            seq: (await new Sequence().save()).value,
            decision: DecisionTypes.HOLD,
            orderRatio: 0,
            weightLowerBound: lowerBound,
            weightUpperBound: lowerBound + 0.2,
            reason: '테스트 추론 내용입니다.',
          })),
        ),
      },
    ]);
  },
  trades: async () => {
    const users = await User.find();
    const decisions = await Decision.find();
    await Trade.delete({});
    await Trade.save([
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.BUY,
        symbol: 'BTC',
        market: 'KRW',
        amount: 1000000,
        decision: decisions[0],
      },
      {
        seq: (await new Sequence().save()).value,
        user: users[0],
        type: OrderTypes.SELL,
        symbol: 'BTC',
        market: 'KRW',
        amount: 0.05,
        decision: decisions[1],
      },
    ]);
  },
  notify: async () => {
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
  },
};

export const seedOrder = ['users', 'inferences', 'trades', 'notify'];
