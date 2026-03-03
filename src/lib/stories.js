// Narrative mode story data
// Each story has steps; each step defines:
//   focusIds   — nodes at full opacity, always labeled
//   cameraIds  — bounding box for camera pan (defaults to focusIds if omitted)
//   heading    — large title text
//   body       — paragraph body text
//   chainIds?  — ordered list for dashed-arrow chain overlay

export const STORIES = [
  {
    id: 'miles',
    title: 'The Miles Davis School',
    subtitle: 'Six decades of lineage from a single bandleader',
    steps: [
      {
        focusIds: [23755],
        heading: 'Miles Davis',
        callout: '55 collaborators across six decades',
        body: 'No single musician shaped the second half of jazz history more decisively than Miles Davis. From bebop to modal to electric fusion, each reinvention pulled new collaborators into his orbit — and sent them out transformed.',
      },
      {
        focusIds: [23755, 29979, 3865, 95088, 37731, 84214, 238626],
        heading: 'The Second Great Quintet',
        callout: 'Seven alumni, hundreds of landmark recordings',
        body: 'In the mid-1960s, Miles assembled what critics now call his second great quintet: Wayne Shorter, Herbie Hancock, Ron Carter, and Tony Williams. Add Chick Corea, Dave Holland, and Jack DeJohnette from the electric period and you have seven musicians who would each lead decades of landmark recordings.',
      },
      {
        focusIds: [29979, 3865, 95088],
        heading: 'Inner Circle',
        body: 'Shorter, Hancock, and Carter form a dense triangular cluster — three musicians who recorded together not just under Miles but across hundreds of sessions with each other and with nearly every major voice in modern jazz.',
      },
      {
        focusIds: [29979, 256057, 312031, 445470],
        cameraIds: [29979, 256057, 312031, 445470],
        heading: "Shorter's Reach",
        callout: 'A mentorship arc from 1964 to 2014',
        body: "Wayne Shorter's influence flows forward through Brad Mehldau, Eric Harland, and Marcus Gilmore — musicians born decades after his own debut. The arc of mentorship stretches from 1964 to 2014.",
      },
      {
        focusIds: [23755, 29979, 256057, 312031, 445470],
        cameraIds: [23755, 29979, 256057, 312031, 445470],
        chainIds: [23755, 29979, 256057, 312031, 445470],
        heading: 'Four Generations',
        callout: 'Four generations, one unbroken line',
        body: 'Miles → Shorter → Mehldau → Harland → Gilmore. A chain of musical inheritance spanning seventy years, each link forged through shared recordings and direct collaboration.',
      },
      {
        focusIds: [23755, 29979, 3865, 95088, 37731, 84214, 238626, 256057, 312031, 445470],
        heading: 'The Full Tree',
        body: 'Taken together, this constellation accounts for over 400 unique collaboration edges in the graph — roughly 12% of all connections, radiating outward from a single bandleader\'s vision.',
      },
    ],
  },

  {
    id: 'bridge',
    title: 'The Bridge',
    subtitle: 'How one guitarist connects two eras of jazz',
    steps: [
      {
        focusIds: [97545, 10620, 252310, 549533, 340568, 414901],
        heading: 'Two Worlds Apart',
        body: 'On one side: John Coltrane, McCoy Tyner, and Bill Evans — the architects of post-bop jazz from the late 1950s and 60s. On the other: Gretchen Parlato, Robert Glasper, and Esperanza Spalding — the neo-soul-inflected generation of the 2010s. In the graph, these two clusters barely touch.',
      },
      {
        focusIds: [745365],
        heading: 'Lionel Loueke',
        callout: '33 connections bridging two eras',
        body: "Born in Benin, trained at Berklee and the Monk Institute, Lionel Loueke occupies a unique position in the graph. His guitar voice — rooted in West African polyrhythm but fluent in post-bop harmony — made him a sought-after collaborator across communities that rarely intersect.",
      },
      {
        focusIds: [745365, 3865, 29979, 549533, 340568, 414901],
        cameraIds: [745365, 3865, 29979, 549533, 340568, 414901],
        heading: "Loueke's Connections",
        body: 'Loueke recorded with Herbie Hancock and Wayne Shorter on one side, and with Parlato, Glasper, and Spalding on the other. These edges would not otherwise exist in the graph — he is the only node connecting these two communities.',
      },
      {
        focusIds: [97545, 10620, 252310, 745365, 3865, 29979, 549533, 340568, 414901],
        cameraIds: [97545, 10620, 252310, 745365, 3865, 29979, 549533, 340568, 414901],
        heading: 'The Bridge Revealed',
        callout: 'Fifty years of jazz, one path',
        body: "With Loueke's cross-community edges visible, a path emerges: from Coltrane's world to the contemporary neo-soul scene, traversing fifty years of jazz evolution through a single guitarist's biography.",
      },
    ],
  },

  {
    id: 'drummers',
    title: 'Three Drummers, Three Worlds',
    subtitle: 'Different rhythmic universes that sometimes collide',
    steps: [
      {
        focusIds: [312031, 445470, 265188],
        heading: 'Three Drummers',
        body: 'Eric Harland, Marcus Gilmore, and Ari Hoenig are three of the most recorded drummers of the 2000s–2010s. They share a generation but inhabit strikingly different musical worlds — visible in who they play with.',
      },
      {
        focusIds: [312031],
        heading: 'Eric Harland — The Connector',
        callout: '49 connections — the widest reach',
        body: 'Eric Harland has 49 connections — the widest reach of the three. He anchors the post-bop mainstream, working across Wayne Shorter, Dave Holland, and the entire Sunnyside/ECM orbit. His neighborhood is dense and cross-community.',
      },
      {
        focusIds: [445470],
        heading: 'Marcus Gilmore — The Inheritor',
        callout: '57 connections — the inheritor',
        body: "Marcus Gilmore (grandson of Roy Haynes) has 57 connections. His neighborhood concentrates around Chick Corea's sphere and the neo-bop establishment — a lineage of rhythmic virtuosity passed down through family and mentorship.",
      },
      {
        focusIds: [265188],
        heading: 'Ari Hoenig — The Polyrhythmist',
        callout: '12 connections — a world apart',
        body: 'Ari Hoenig has 12 connections — fewer but more specialized. His neighborhood clusters around the avant-garde and polyrhythmic edge: Brad Mehldau, Django Bates, and European improvisation. A smaller but distinct world.',
      },
      {
        focusIds: [312031, 445470, 265188],
        heading: 'Three Worlds Compared',
        body: "Zoom out and the contrast is stark: Harland and Gilmore's neighborhoods overlap substantially through shared post-bop territory. Hoenig's sits apart. Yet all three appear in the same graph — connected, however tenuously, by the small world of jazz.",
      },
    ],
  },
];
