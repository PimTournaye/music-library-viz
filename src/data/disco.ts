import { Discojs } from 'discojs'
import * as dotenv from 'dotenv'
dotenv.config()

export const client = new Discojs({
  userToken: process.env.USER_TOKEN,
})