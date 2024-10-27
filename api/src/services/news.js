import axios from 'axios'

import { NEWS_SCHEMA, NEWS_TYPE_COIN, NEWS_URL } from '../const/news.js'

export const getNews = async (type = NEWS_TYPE_COIN, limit = 100) => {
  const response = await axios.get(NEWS_URL, {
    params: {
      q: JSON.stringify({
        t1: type
      }),
      limit: limit
    }
  })

  const news = response.data?.docs?.map((item) => {
    return Object.entries(NEWS_SCHEMA).reduce((acc, [key, value]) => {
      acc[key] = item[value]
      return acc
    }, {})
  })

  return news
}
