// This file is made with Bun, so make sure to use that, otherwise it will not work.
import { client } from './disco';
import { AlbumData, minimalAlbum } from './types';
import roles from './roles';

// File I/O
const file = Bun.file('organized-data.json'); // create a file object
const writer = file.writer(); // create a writer object for incremental writing
const errorLog = Bun.file('error-log.txt'); // create a file object for failed requests
const errorWriter = errorLog.writer(); // another writer object for incremental writing

const addToFile = (data: string) => writer.write(data); // create a function to add data to the file
const logError = (data: string) => errorWriter.write(data); // create a function to add data to the error log
const library = Bun.file('raw.json'); // path for our music library file
const data = JSON.parse(await library.text()); // read the file and parse the JSON

// Variables
const PRUNE_RAW_DATA = false; // set to true to prune the raw data
let fetchingDone = false;
let startTime: Date;
let endTime: Date;
let amountOfAlbumsDone: number = 0;

// To use if we have to prune the raw data, maybe because we refreshed our dataset
if (PRUNE_RAW_DATA) {
  // This is how our data looks when exported from MusicBee
  // {`artist`: `<Artist>` ,`albumArtist`: `John Coltrane` ,`album`:  `Coltrane Plays the Blues` },
  // We'll just replace backticks with double quotes and parse it as JSON
  // {"artist": "Steve Coleman And Metrics" ,"albumArtist": "Steve Coleman" ,"album":  "A Tale Of 3 Cities, The EP" },
  // Now, we'll create a list of all the albums in our library by making a Set of all the album names
  const albums = new Set(
    data.filter((cur: minimalAlbum, index: number, arr: minimalAlbum[]) =>
      arr.findIndex(item => item.album === cur.album && item.albumArtist === cur.albumArtist) === index
    )
  );

  // @ts-ignore
  await Bun.write('albums.json', JSON.stringify([...albums])); // write the album list to a file
}

// Next, we'll try to get the Discogs ID for each album, aiming to get a master release ID if possible
// We'll use the Discogs API to do this
// The API has a rate limit of 60 requests per minute, so we'll have to be careful
let discogsRatelimitRemaining: number = 60; // initialize the rate limit counter
let timeoutDuration: number = 70000; // initialize the timeout duration

// Create an array to hold the final data
let finalData: AlbumData[] = [];

// Connect to the Discogs API
const discogs = client.database();

// Create a function to get the Discogs data for an album
const getDiscogsData = async (album: minimalAlbum): Promise<AlbumData | void> => {
  console.log(`Fetching data for album "${album.album}" by "${album.albumArtist}"...`);
  try {
    // Try a general search first
    let release = await discogs.search({ query: album.album, type: 'master', artist: album.albumArtist });

    // console.log(release.data.results[0]); // this works

    // If we get no results, try again with the 'artist', otherwise throw an error
    if (release.data.results.length === 0 || !release) {
      console.log(`No results for album "${album.album}" by "${album.albumArtist}" - trying again with the 'artist' field...`);
      release = await discogs.search({ query: album.album, type: 'master', artist: album.artist });
      // If we still get no results, log an error and return to move on to the next album
      if (release.data.results.length === 0 || !release) {
        logError(`Error while fetching data for album "${album.album}" by "${album.albumArtist}"\n`);
        console.log(`No results for album "${album.album}" by "${album.artist} using the 'artist' field - moving on to the next album..."`);
        return;
      }
    }
    // Search for the master release with the ID we got from the search
    const masterID = release.data.results[0].master_id as number;
    const master = await discogs.getMaster(masterID);
    // Get the main release through the ID given in the master release
    const mainID = master.data.main_release;
    const main = await discogs.getRelease(mainID);

    // console.log('DONE WITH SEARCHES');


    // Filter the extraartists array for the roles we want
    const credits = main.data.extraartists.filter((credit: { role: string; }) => roles.includes(credit.role));
    // Filter a second time to exclude the album artist in case they have a role listed here
    const collaborators = credits.filter((credit: { name: string; }) => credit.name !== album.albumArtist);

    // console.log('DONE WITH FILTERING');


    // Aggregate the data we want
    const data = {
      album: main.data.title,
      albumArtist: main.data.artists[0].name, // could also be artists_sort???
      year: main.data.year,
      genres: main.data.genres,
      styles: main.data.styles,
      collaborators: collaborators,
      albumArt: main.data.images[0].uri,
    }

    // DEBUG TIME
    // console.group('Debug');
    // console.log(`Album: ${data}`);
    // console.log(release.data.results[0]);
    // console.log(master.data);
    // console.log(main.data);
    // console.log(`Credits: ${credits}`);
    // console.log(`Collaborators: ${collaborators}`);
    // console.groupEnd();


    // Adjust the rate limit counter
    discogsRatelimitRemaining = main.rateLimit.remaining - 3; // removing extra since we're making 3 requests per album
    return data;
  } catch (error) {
    // Log the error to the console
    console.error(`Error while fetching data for album "${album.album}" by "${album.albumArtist}":`, error);
    // Add the error to the error log
    logError(`Error while fetching data for album "${album.album}" by "${album.albumArtist}"\n`);
  }
}

const albumData = Bun.file('albums.json'); // path for our album list file
const albums: minimalAlbum[] = JSON.parse(await albumData.text()); // read the file and parse the JSON

// set up a timer loop to keep track of how much time has passed
startTime = new Date();
const timer = setInterval(() => {
  const elapsed = (new Date().getTime() - startTime.getTime()) / 1000;
  console.log(`${elapsed} seconds elapsed, ${finalData.length} albums processed`);
}, 60 * 1000);

// Finally we can get the Discogs data for each album
let fetcher = new Promise<void>(async (resolve, reject) => {
  console.log(`Fetching data for ${albums.length} albums...`);

  
  // albums.forEach(async (album: minimalAlbum, i, arr) => {
  //   // Check how many requests we have left
  //   if (discogsRatelimitRemaining === 0) {
  //     // If we have no requests left, wait for a minute and 5 seconds
  //     console.log(`Rate limit hit, waiting for ${timeoutDuration / 1000} seconds...`);
  //     await new Promise(resolve => setTimeout(resolve, timeoutDuration));
  //     // Reset the counter
  //     discogsRatelimitRemaining = 60;
  //   }
  //   // Get the Discogs data for the album
  //   const discogsData = await getDiscogsData(album);
  //   // write the data to the file incrementally in case something goes wrong
  //   addToFile(JSON.stringify(discogsData) + ',\n');
  //   // If we get data, add it to the final data array
  //   if (discogsData) finalData.push(discogsData);
  //   // If we're at the last album, resolve the promise
  //   if (i === arr.length - 1) resolve();
  // })

  // try to do it with a for loop instead
  for (amountOfAlbumsDone = 0; amountOfAlbumsDone < albums.length; amountOfAlbumsDone++) {
    // Check how many requests we have left
    if (discogsRatelimitRemaining <= 0) {
      // If we have no requests left, wait for a minute and 5 seconds
      console.log(`Rate limit hit, waiting for ${timeoutDuration / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, timeoutDuration));
    }
    // Get the Discogs data for the album
    const discogsData = await getDiscogsData(albums[amountOfAlbumsDone]);
    // Log the progress
    console.log(`Fetched data for ${amountOfAlbumsDone + 1} of ${albums.length} albums...`);
    // console.log(discogsData);

    if (discogsData !== undefined) {
      // If we get data, add it to the final data array
      finalData.push(discogsData);
      // write the data to the file incrementally in case something goes wrong
      addToFile(JSON.stringify(discogsData) + ',\n');
    }
    // If we're at the last album, resolve the promise
    if (amountOfAlbumsDone === albums.length - 1) resolve();
    console.log(amountOfAlbumsDone);
  }
});

// Once resolving the promise, do some cleanup, do the finale, and write the final data to a file
fetcher.then(() => {
  // Stop the timer
  clearInterval(timer);
  // Log the time it took to fetch the data in the format HH:MM:SS
  endTime = new Date();
  const elapsed = (endTime.getTime() - startTime.getTime()) / 1000;
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  console.log(`Done! It took ${minutes}:${seconds} to fetch the data of ${albums.length} albums.`);
  // Write the final data to a file
  Bun.write('final-data.json', JSON.stringify(finalData));
  // Close the file writers
  writer.close();
  errorWriter.close();
  fetchingDone = true;
});






