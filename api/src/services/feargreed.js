import axios from 'axios'

import { FEARGREED_SCHEMA, FEARGREED_URL } from '../const/feargreed.js'

export const getFeargreed = async () => {
  const response = await axios.get(FEARGREED_URL)

  const feargreed = response.data?.pairs?.map((item) => {
    return Object.entries(FEARGREED_SCHEMA).reduce((acc, [key, value]) => {
      acc[key] = item[value]
      return acc
    }, {})
  })

  return feargreed
}
