import { Discojs } from 'discojs'
import { DiscogsClient } from '@lionralfs/discogs-client';

export const DiscojsClient = new Discojs({
  userToken: process.env.USER_TOKEN,
})

// OAuth method
// export const client = new DiscogsClient({
//   auth: {
//     method: 'discogs',
//     consumerKey: process.env.DISCOGS_CONSUMER_KEY,
//     consumerSecret: process.env.DISCOGS_CONSUMER_SECRET,
//   }
// });

export const client = new DiscogsClient({ auth: { userToken: Bun.env.PERSONAL_ACCESS_TOKEN } })