import { Inference } from '@/modules/inference/entities/inference.entity';
import { InferenceDecisionTypes } from '@/modules/inference/inference.enum';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';

export const seeds = {
  users: async () => {
    await User.delete({});
    await User.save([
      {
        email: 'eunsoogi.lee@gmail.com',
      },
    ]);
  },
  inferences: async () => {
    const users = await User.find();
    await Inference.delete({});
    await Inference.save([
      {
        user: users[0],
        symbol: 'BTC',
        decision: InferenceDecisionTypes.BUY,
        rate: 0.3,
        reason: '테스트 추론 내용입니다.',
        reflection: '테스트 회귀 내용입니다.',
      },
      {
        user: users[0],
        symbol: 'BTC',
        decision: InferenceDecisionTypes.SELL,
        rate: 0.3,
        reason: '테스트 추론 내용입니다.',
        reflection: '테스트 회귀 내용입니다.',
      },
      {
        user: users[0],
        symbol: 'BTC',
        decision: InferenceDecisionTypes.HOLD,
        rate: 0,
        reason: '테스트 추론 내용입니다.',
        reflection: '테스트 회귀 내용입니다.',
      },
    ]);
  },
  trades: async () => {
    const users = await User.find();
    const inferences = await Inference.find();
    await Trade.delete({});
    await Trade.save([
      {
        user: users[0],
        type: OrderTypes.BUY,
        symbol: 'BTC',
        market: 'KRW',
        amount: 1000000,
        inference: inferences[0],
      },
      {
        user: users[0],
        type: OrderTypes.SELL,
        symbol: 'BTC',
        market: 'KRW',
        amount: 0.05,
        inference: inferences[1],
      },
    ]);
  },
};

export const seedOrder = ['users', 'inferences', 'trades'];
