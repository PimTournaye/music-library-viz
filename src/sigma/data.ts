// This file is made with Bun, so make sure to use that, otherwise it will not work.
import { client } from '../data/disco';

// File I/O
const file = Bun.file('organized-data.json'); // create a file object
const writer = file.writer(); // create a writer object for incremental writing
const errorLog = Bun.file('error-log.txt'); // create a file object for failed requests
const errorWriter = errorLog.writer(); // another writer object for incremental writing

const addToFile = (data: string) => writer.write(data); // create a function to add data to the file

const library = Bun.file('data/library.json'); // path for our music library file
const data = JSON.parse(await library.text()); // read the file and parse the JSON






/*
const sortRawData = async (data) => {
  let lastArtist = "";
  let lastAlbum = "";
  const organisedByAlbum = [];
  let tracklist = [];
  let requestCount = 0;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];

    // extract the artist and album information from the current entry
    const artist = d.albumArtist;
    const album = d.album;

    // check if the artist and album are the same as the last entry
    if (artist === lastArtist && album === lastAlbum) {
      // if they are, add the current track entry to the existing tracklist
      tracklist.push(d.track);
      console.log(`Track #${i + 1} out of ${data.length}`);
    } else {
      // create a new tracklist for the current album
      tracklist = [];
      tracklist.push(d.track)

      const discoData = await pairWithDiscogs(album, artist);
      organisedByAlbum.push({
        artist: artist,
        album: album,
        tracklist: tracklist,
        year: d.year,
        discoData
      });

      // update the last artist and album variables for the next iteration
      lastArtist = artist;
      lastAlbum = album;
      console.log(`Track #${i + 1} out of ${data.length}`);

      const dataToWrite = organisedByAlbum.slice(0, i + 1);
      writeFileSync('data/data.json', JSON.stringify(dataToWrite, null, 2));

      // take into account the rate limit since we're requesting twice per album
      requestCount++;
      if (requestCount % 11 === 0) {
        console.log('Rate limit hit, setting a timeout on data fetching');
        await new Promise(resolve => setTimeout(resolve, 63000));
      }
    }
  }

  // Check if the first album has an empty tracklist, and remove it if it does
  if (organisedByAlbum.length > 0 && organisedByAlbum[0].tracklist.length === 0) {
    organisedByAlbum.shift();
  }

  return organisedByAlbum;
}

const pairWithDiscogs = async (album, artist) => {
  try {
    const releases = await client.searchRelease(album, { type: 'master', artist: artist });
  
    if (releases.results.length === 0) {
      return;
    }
  
    // Find the first release, as not to get 50 versions of the same album
    const oldestRelease = releases.results.reduce((oldest, current) => {
      return (current.year < oldest.year) ? current : oldest;
    });
  
    // Only master releases searched for with ID return credits from the album in response. Damn you Discogs API!
    const master = await client.getRelease(oldestRelease.id);
  
    return {
      id: master.id,
      url: master.url,
      credits: (master.extraartists && master.extraartists.length > 0) ? master.extraartists : null,
      released: master.released,
      styles: master.styles,
      image: (master.images && master.images.length > 0) ? master.images[0] : null
    };
  } catch (error) {
    console.error(`Error while fetching data for album "${album}" by "${artist}":`, error.message);
    return;
  }
}
*/
