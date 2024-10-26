import { getService } from './openai.js';
import { getCandles } from './upbit.js';
import { getFeargreed } from './feargreed.js';
import { getNews } from './news.js';
import { INFERENCE_MODEL, INFERENCE_MAX_TOKENS, INFERENCE_RESPONSE_SCHEMA, INFERENCE_PROMPT } from '../const/inference.js';

const getData = async (
  ticker = 'KRW-BTC',
  count_m15 = 4 * 24,
  count_h1 = 24,
  count_h4 = 24 / 4,
  count_d1 = 30) => {

  const data = {
    krwBalance: 10000000,
    btcBalance: 0,
    candles: await getCandles(ticker, count_m15, count_h1, count_h4, count_d1),
    feargreed: await getFeargreed(),
    news: await getNews(),
  };

  return data;
};

const getMessage = (data) => {
  return [
    {
      role: 'system',
      content: INFERENCE_PROMPT.join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify(data),
    }
  ];
};

const getResponseFormat = () => {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'ai-invest-assistant',
      strict: true,
      schema: INFERENCE_RESPONSE_SCHEMA,
    },
  };
};

export const inferenceV1 = async () => {
  const service = await getService();
  const data = await getData();

  const response = await service.chat.completions.create({
    model: INFERENCE_MODEL,
    max_tokens: INFERENCE_MAX_TOKENS,
    messages: getMessage(data),
    response_format: getResponseFormat(),
    stream: false,
  });

  console.debug(response);

  const result = JSON.parse(response.choices[0].message?.content);

  console.debug(result);

  return result;
}

export default {
  inferenceV1,
}
