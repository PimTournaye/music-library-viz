// This file is made with Bun, so make sure to use that, otherwise it will not work.
import { client } from './disco';
import { minimalAlbum } from './types';

// File I/O
// @ts-ignore
const file = Bun.file('organized-data.json'); // create a file object
const writer = file.writer(); // create a writer object for incremental writing
// @ts-ignore
const errorLog = Bun.file('error-log.txt'); // create a file object for failed requests
const errorWriter = errorLog.writer(); // another writer object for incremental writing

const addToFile = (data: string) => writer.write(data); // create a function to add data to the file
const logError = (data: string) => errorWriter.write(data); // create a function to add data to the error log
// @ts-ignore
const library = Bun.file('raw.json'); // path for our music library file
const data = JSON.parse(await library.text()); // read the file and parse the JSON

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
