import { Discojs } from 'discojs'

export const client = new Discojs({
  userToken: process.env.USER_TOKEN,
})