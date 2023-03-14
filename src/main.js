import { readFileSync, writeFileSync } from 'fs'
import { client } from './disco.js';

const sortRawData = async (data) => {
  let lastArtist = "";
  let lastAlbum = "";
  let organisedByAlbum = [];
  let tracklist = [];
  
  data.forEach(async (data, index) => {
    // extract the artist and album information from the current entry
    const artist = data.albumArtist;
    const album = data.album;
    // check if the artist and album are the same as the last entry
    if (artist === lastArtist && album === lastAlbum) {
      // if they are, add the current track entry to the existing tracklist
      tracklist.push(data.track);
    } else {
      // create a new tracklist for the current album
      tracklist = [];
      tracklist.push(data.track)
      const albumObj = {
        artist: artist,
        album: album,
        tracklist: tracklist,
        year: data.year
      };
      const discoData = await pairWithDiscogs(album, artist)

      organisedByAlbum.push({
        ...albumObj,
        ...discoData
      });

      // update the last artist and album variables for the next iteration
      lastArtist = artist;
      lastAlbum = album;
    }
  });
  
  // Check if the first album has an empty tracklist, and remove it if it does
  if (organisedByAlbum.length > 0 && organisedByAlbum[0].tracklist.length === 0) {
    organisedByAlbum.shift();
  }

  return organisedByAlbum;
}

// const pairWithDiscogs = async (album, artist, index) => {
//   // timeout for Discogs ratelimit
//   if index

//   const releases = await client.searchRelease(album, { type: 'master', artist: artist, })
  
    
//     if (releases.results.length === 0) {
//       return;
//     }
    
//     // Find the first release, as not to get 50 versions of the same album
//     const oldestRelease = releases.results.reduce((oldest, current) => {
//       return (current.year < oldest.year) ? current : oldest;
//     });
//     // Only master releases searched for with ID return credits from the album in response. Damn you Discogs API!
//     const master = await client.getRelease(oldestRelease.id);

//     return {
//       id: master.id,
//       url: master.url,
//       credits: master.extraartists,
//       released: master.released,
//       styles: master.styles,
//       image: master.images[0]
//     }
// }

const pairWithDiscogs = async (album, artist) => {
  const releases = await client.searchRelease(album, { type: 'master', artist: artist, })
  
  if (releases.results.length === 0) {
    return;
  }
  
  const oldestRelease = releases.results.reduce((oldest, current) => {
    return (current.year < oldest.year) ? current : oldest;
  });
  
  const requestOptions = {
    headers: {
      'User-Agent': 'Discogs-viz/0.1 +https://pimtournaye.xyz'
    }
  };
  
  let master;
  let retryCount = 0;
  
  while (retryCount < 3) {
    try {
      master = await client.getRelease(oldestRelease.id, requestOptions);
      break;
    } catch (error) {
      const rateLimit = error.response.headers['x-discogs-ratelimit'];
      const rateLimitUsed = error.response.headers['x-discogs-ratelimit-used'];
      const rateLimitRemaining = error.response.headers['x-discogs-ratelimit-remaining'];
      
      if (rateLimitRemaining === '0') {
        const waitTime = 60 - Math.floor(Date.now() / 1000) % 60;
        console.log(`Rate limited. Waiting ${waitTime} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        console.log("Unexpected error. Retrying in 1 second...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      retryCount++;
    }
  }
  
  if (!master) {
    console.log(`Failed to get release after ${retryCount} retries`);
    return;
  }

  return {
    id: master.id,
    url: master.url,
    credits: master.extraartists,
    released: master.released,
    styles: master.styles,
    image: master.images[0]
  };
}


// console.log(JSON.parse(readFileSync('data/library.json')));


const sortedData = await sortRawData(await JSON.parse(readFileSync('data/library.json')))
writeFileSync('data/data.json', JSON.stringify(sortedData))