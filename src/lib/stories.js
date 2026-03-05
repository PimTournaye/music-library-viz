// Narrative mode story data
// Each story has steps; each step defines:
//   focusIds   — nodes at full opacity, always labeled
//   cameraIds  — bounding box for camera pan (defaults to focusIds if omitted)
//   heading    — large title text
//   body       — paragraph body text
//   callout?   — italic pull-quote, left-bordered
//   coverArt?  — URL for featured album cover (Cover Art Archive)
//   chainIds?  — ordered list for dashed-arrow chain overlay
//
// isClusters: true marks a meta-story rendered as compact community snapshots

export const STORIES = [
  {
    id: 'door',
    title: 'How it started',
    subtitle: 'How a youtube video starts a collection',
    steps: [
      {
        focusIds: [97545],
        coverArt: '/covers/blue-train.webp',
        heading: 'Blue Train',
        callout: 'The first album I really sat with',
        body: `Despite growing up in a household with my mother being a jazz fanatic, I didn't start listening to jazz until my late teens.
              My mother used to play Keith Jarrett records all through out my youth. During car rides, while cooking, Keith Jarrett, Charlie Haden, and Gary Peacock ruled all.
              I didn't want it, didn't care for it, didn't even register it. Until one night when I was 17, sitting in my bedroom deep in to a depression.
              Somehow my YouTube rabbithole that initially started out as listening to grunge and punk ended up with me on a Dexter Gordon recording - Blue Bossa.
              In the coming 2 weeks, I listen to that song on repeat, and racked up around 500+ listens. Enough listens to make my mom notice and show me, after years of trying unsuccesfully, her collection.
              <br>
              The first record I actually sat with, in its entirety, must have been Coltrane's <strong>Blue Train</stong>. I don't know if it was the popularity of the record, the fact that it was in my mother's collection, or just Coltrane himself, but it might have been the early morning bus rides to school. 
              Coltrane and the band put enough energy into that record to wake up any teen with 40 minutes left on the bus at seven in the morning.`
      },
      {
        focusIds: [97545, 23755],
        coverArt: '/covers/kind-of-blue.webp',
        heading: 'Kind of Blue',
        body: `Kind of Blue was already in my mother's collection, and it doesn't take long at all for anyone listening to jazz to bump into this legendary record.
              Another record that remember keeping awake and somewhat lucid during those morning bus rides. I think this is when I started noticing band members, or trying to pay closer attention to them.
              In either way, this made me branch out... to more Miles records. I quickly started gathering Milestones, Porgy and Bess, Sketches of Spain, Something Else, etc. Focused on a second Coltrane record, got into Bill Evans and Cannonball Adderly, Art Blakey. The classics.`,
      },
      {
        focusIds: [97545, 23755, 135885, 10620, 259778, 252311, 145272],
        cameraIds: [97545, 23755, 135885, 10620, 259778, 252311, 145272],
        coverArt: '/covers/milestones.webp',
        heading: 'The giants of old',
        body: `Spend enough time in that era and the same faces keep appearing. Elvin Jones or Philly Joe behind the kit. Paul Chambers on bass. McCoy Tyner or Red Garland on piano. 
              These rhythm sections are what pulls this network together, especially in this era. You pull one record and find three others you need to hear. 
              Bearing in this is still focused around Miles Davis and those that played with him. Miles is a gravitational center. That has been inscribed into history, and we can find it here in the data, in my collection. I too followed his career album by album, looking at Miles like the prophet he was.`,
      },
      {
        focusIds: [97545, 23755, 135885, 10620, 259778, 252311, 252310, 145272, 29976],
        cameraIds: [97545, 23755, 135885, 10620, 259778, 252311, 252310, 145272, 29976],
        coverArt: '/covers/quartet-plays.webp',
        heading: 'I love Elvin Jones',
        body: `The other center of my early collection was focused Elvin Jones. A force of nature with thundering drums, I couldn't get enough of Elvin, and I still can't to this day.
              I listened to him with Gil Evans, Wayne Shorter, Michael Brecker, Joe Henderson, and of course John Coltrane. While I was wrapping up high school, I was consumed by his playing, especially when paired with Coltrane.
              Many essays, books, liner notes, and recollections have been written down about the dynamic of these two. I was downright obsessed and their interplay, but from all the records they did together, none grabbed me like 'The Johgn Coltrane Quartet Plays...'
              Man, I get chills thinking about that records, the interplay with the whole band was at its highest here in my opinion, higher than even 'A Love Supreme'. Do yourself a favor and check out Nature Boy on this album, everyone shines here, especially Jimmy Garrison.`,
      },
    ],
  },

  {
    id: 'dewerf',
    title: 'De Werf',
    subtitle: 'A small venue in Bruges and the people who played there',
    steps: [
      {
        focusIds: [1299757, 849619, 1671518, 306817, 6356890],
        coverArt: '/covers/kris-defoort.webp',
        heading: 'Belgium Is a small country',
        callout: 'Jazz is a smaller country still',
        body: `I started going to De Werf in Bruges as a jazz student. A legendary venue that also functioned like a label. Lots of local musicians from both sides of Belgium's language barrier coming through, as well as bonefide legends. They kept it real, you know?
              They organised jam sessions sometimes and usually brought in young talent to open sessions. Young talents that's at the forefront of the Belgian scene these days. It's also how I got to really know the scene, and made friends as I went to jam sessions around Flanders.
              `,
      },
      {
        focusIds: [3547903],
        coverArt: '/covers/foster-treasures.webp',
        heading: 'Bram De Looze',
        body: `Bram De Looze is the person who really opened it up for me. I saw him play at De Werf and afterwards we ended up talking for a while. His old piano teacher was teaching some of my friends. 
              From there, I started following the projects he was involved in more closely, which meant following a lot of threads at once. 
              Matthias De Waele, Antoine Pierre (especially), Lander Gyselinck. One name led to another and one album led to three more. 
              He has 17 connections in this graph, which sounds modest until you map where those edges actually go.`,
      },
      {
        focusIds: [3547903, 364711, 1321501, 2121682, 1236897, 500806, 364712],
        cameraIds: [3547903, 364711, 1321501, 2121682, 1236897, 500806, 364712],
        coverArt: '/covers/urbex.webp',
        heading: 'Moving to Brussels',
        body: `When I moved to Brussels to study at the conservatory, the scene I had been following from a distance suddenly became the one I was living inside, although not as much a part of.
              Going to concerts and sessions started feeling less like discovery and more like running into people I already knew .
              The Brussels jazz scene is small, prolific, and incredibly interconnected. Stéphane Galland, Antoine Pierre, Jean-Paul Estievenart were people I was still buying records from but now also ran into in town.
              But things didn't stop there. These wonderful people and records now served as a gateway to discover the wider European scene.`,
      },
    ],
  },

  {
    id: 'invisible',
    title: 'Hidden connections',
    subtitle: 'The musicians who are everywhere but on no poster',
    steps: [
      {
        focusIds: [29979, 95088, 3865, 23755, 253592, 135885],
        heading: 'The names you know',
        body: "Wayne Shorter, 65 connections. Ron Carter, 63. Herbie Hancock, 62. Miles Davis, 55. Charlie Haden, 55. Elvin Jones, 55. These are the bandleaders — the names on the covers, the nodes you'd expect to dominate the graph.",
      },
      {
        focusIds: [2612392, 135873, 6356890, 307058, 253445, 251782],
        cameraIds: [2612392, 135873, 6356890, 307058, 253445, 251782],
        heading: "The names you don't",
        body: `Rogerio Boccato. Cedar Walton. David Thomaere. Gil Goldstein. Percy Heath. Connie Kay.
              Two albums each in this collection. That's it. Not two albums they led — two albums they appear on at all.
              And yet each of them connects to between 18 and 27 other musicians in the graph.
              Two records. A sprawling reach. The collection barely registered them, but the network did.`,
      },
      {
        focusIds: [745365, 3865, 29979, 325243, 549533],
        cameraIds: [745365, 3865, 29979, 325243, 549533],
        heading: 'Lionel Loueke',
        callout: '33 connections, sitting between two worlds',
        body: `Lionel Loueke is a guitarist from Benin who trained at Berklee and the Thelonious Monk Institute. 
              On one side of the graph: Herbie Hancock and Wayne Shorter — the Miles Davis generation, 1960s and 70s.
              On the other: Ambrose Akinmusire and Gretchen Parlato — the contemporary scene, 2010s.
              Those two worlds don't naturally overlap. Loueke recorded with both.
              That kind of cross-generational reach is rare — most musicians stay within their gravitational orbit their whole career.`,
      },
      {
        focusIds: [29979, 95088, 3865, 23755, 253592, 135885, 2612392, 135873, 6356890, 307058, 253445, 251782, 745365, 325243, 549533],
        heading: 'The full picture',
        body: `The bandleaders at the top of the graph. The sidemen two albums deep who connect to two dozen people. The one guitarist who bridges sixty years of jazz in a single discography.
              They all live on the same timeline. 1957 to 2019, one vertical axis.
              A collection isn't a list. It's a set of choices that turn out to be connected — mostly in ways you didn't intend and only see afterwards.`,
      },
    ],
  },

  {
    id: 'clusters',
    title: 'The Clusters',
    subtitle: 'Fourteen communities in the graph',
    isClusters: true,
    steps: [
      {
        focusIds: [135885, 259778, 97545, 10620],
        heading: 'Elvin Jones',
        body: 'The hard-bop and modal core. Coltrane, Paul Chambers, McCoy Tyner — the decade the collection keeps returning to.',
      },
      {
        focusIds: [325243, 549533, 209746, 745365],
        heading: 'Ambrose Akinmusire',
        body: 'The 2010s post-bop and neo-soul generation. Gretchen Parlato, Ben Wendel, Lionel Loueke — contemporary voices with deep roots.',
      },
      {
        focusIds: [3547903, 364711, 1321501, 2121682],
        heading: 'Bram De Looze',
        body: 'The Belgian Brussels scene. Musicians I mostly know personally, from sessions before albums.',
      },
      {
        focusIds: [29979, 95088, 3865, 23755],
        heading: 'Wayne Shorter',
        body: 'The Miles Davis orbit. The second great quintet and its alumni — the most connected cluster in the graph.',
      },
      {
        focusIds: [312031, 346630, 327392, 695542],
        heading: 'Eric Harland',
        body: 'The post-bop working bands of the 2000s. Mark Turner, Miguel Zenon, Matt Brewer — the generation that inherited the tradition.',
      },
      {
        focusIds: [445470, 44115, 316502, 257430],
        heading: 'Marcus Gilmore',
        body: 'The Steve Coleman / M-Base lineage. Dense rhythmic vocabulary, advanced harmony, probably my favorite drummer today.',
      },
      {
        focusIds: [135847, 253394, 144927, 274957],
        heading: 'Michael Brecker',
        body: 'The New York session world of the 1980s and 90s. Fusion crossover, straight-ahead, Bill Frisell on the edges.',
      },
      {
        focusIds: [6778708, 340803, 717682, 2872946],
        heading: 'Joel Ross',
        body: 'The current generation — 2020s recordings, new voices. Makaya McCraven, Brandee Younger, Marquis Hill.',
      },
      {
        focusIds: [252331, 95092, 256057, 289532],
        heading: 'Brian Blade',
        body: 'The ECM / acoustic wing. Joshua Redman, Brad Mehldau, Larry Grenadier — the lyrical side of the post-bop conversation.',
      },
      {
        focusIds: [576460, 395965, 304732, 319813],
        heading: 'Donny McCaslin',
        body: 'The New York downtown scene. Studio players and working musicians — the session backbone of the 2010s.',
      },
      {
        focusIds: [256512, 257435, 120938, 252347],
        heading: 'Chris Potter',
        body: 'The 2000s-2010s working band circuit. Scott Colley, Craig Taborn, Adam Rogers — harmonic sophistication as a shared language.',
      },
      {
        focusIds: [253592, 20185, 222583],
        heading: 'Charlie Haden',
        body: 'Pat Metheny, Charlie Haden, Lyle Mays — the acoustic and lyrical wing, country and folk DNA running under the jazz surface.',
      },
      {
        focusIds: [1299757, 6356890, 849619, 1671518],
        heading: 'Bo Van Der Werf',
        body: 'Belgian cluster. The session at the end of the night in a small venue.',
      },
      {
        focusIds: [99438, 208234, 1363012, 64796],
        heading: 'Roy Hargrove',
        body: 'Hard bop meeting hip hop and soul. Pino Palladino holding the groove, Roy Hargrove on the front line.',
      },
    ],
  },
];
