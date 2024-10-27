import { OpenAI } from 'openai'

import { KEY_TYPE_OPENAI } from '../const/key.js'
import db from '../models/index.js'

export const getKey = async () => {
  const key = await db.models.Key.findOne({
    where: { keyType: KEY_TYPE_OPENAI }
  })

  return key
}

export const getService = async () => {
  const key = await getKey()

  const service = new OpenAI({
    apiKey: key?.apiKey
  })

  return service
}
