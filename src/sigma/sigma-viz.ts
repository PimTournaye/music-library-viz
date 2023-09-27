import Graph from "graphology";
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from "sigma";

import { generateArtistList } from "../utils/generateArtistList";
import { Artist } from "./types";

// Import the data
const jsonUrl = "../data/graphData.json";
// Read the data
const data: Artist[] = await fetch(jsonUrl).then((res) => res.json());

// Set up the graph
const container = document.getElementById("viz")!; // the ! appended to the end of the variable name tells TypeScript that we know this element exists
const graph = new Graph();

// Get a unique list of all artist names so we can create nodes for them. Outputs an array of strings like ['Aaron Diehl', 'Kendrick Scott Oracle', ...]
const artists: Set<string> = generateArtistList(data);

// Add nodes to the graph for each artist
artists.forEach((artist) => {
});

// Generate edges between artists
data.forEach((artist: Artist, i: number) => {

  if (i === 20) {
    console.log(artist.albums.flatMap((d) => d.credits.filter((c) => c.name !== artist.name)));
    console.log(artist.collaborations);
  }

  // The artist's collaborators on the artist's own albums, in other words, as album artist
  const collaborators = artist.albums.flatMap((d) => d.credits.filter((c) => c.name !== artist.name));
  // The artist as a collaborator on other artists' albums, in other words, as sideman
  const asSideman = artist.collaborations.map((d) => d.albumArtist); // 

  // Map the object keys in a way that makes sense for both collaborators and sidemen

  // console.log(asSideman);

  // Create an edge between the artist and each of their collaborators 
});

// console.log(graph);

circular.assign(graph);
const settings = forceAtlas2.inferSettings(graph);
forceAtlas2.assign(graph, { settings, iterations: 600 });

// Render the graph
new Sigma(graph, container);