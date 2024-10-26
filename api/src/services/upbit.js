import { ExchangeService, QuoationService } from 'node-upbit';
import { KEY_TYPE_UPBIT } from '../const/key.js';
import db from '../models/index.js';

export const getKey = async () => {
  const key = await db.models.Key.findOne({
    where: { keyType: KEY_TYPE_UPBIT }
  });

  return key;
}

export const getQuotationService = () => {
  return new QuoationService();
};

export const getExchangeService = async () => {
  const key = await getKey();
  return new ExchangeService(key?.apiKey, key?.secretKey);
};

export const getCandles = async (
  ticker = 'KRW-BTC',
  count_m15 = 4 * 24,
  count_h1 = 24,
  count_h4 = 24 / 4,
  count_d1 = 30) => {

  const service = getQuotationService();

  const candles_m15 = await service.getMinutesCandles({
    minutes: '15',
    marketCoin: ticker,
    count: count_m15,
  });

  const candles_h1 = await service.getMinutesCandles({
    minutes: '60',
    marketCoin: ticker,
    count: count_h1,
  });

  const candles_h4 = await service.getMinutesCandles({
    minutes: '240',
    marketCoin: ticker,
    count: count_h4,
  });

  const candles_d1 = await service.getDayCandles({
    marketCoin: ticker,
    count: count_d1,
  });

  const candles = [...candles_m15, ...candles_h1, ...candles_h4, ...candles_d1];

  return candles;
};
