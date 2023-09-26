const jsonUrl = "../data/graphData.json";
import * as d3 from "d3";

const margin = { top: 40, right: 30, bottom: 30, left: 40 };
const width = window.innerWidth - margin.left - margin.right;
const height = window.innerHeight - margin.top - margin.bottom;
// const width = 800 - margin.left - margin.right;
// const height = 800 - margin.top - margin.bottom;

const DEBUG = true;

// read the data
const data = await d3.json(jsonUrl);

// d3 variables
let transform = d3.zoomIdentity;
let links = [], nodes = [];

// Setup the canvas
const svg = d3
  .select("#viz")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left}, ${margin.top})`);

// Get a unique list of all artist names so we can create nodes for them
const allArtistNames = new Set();
// Loop through the data per artist
data.forEach((artist) => {
  // Add the artist name to the set
  allArtistNames.add(artist.name);
  // For this artist, loop through all albums
  artist.albums.forEach((album) => {
    // For this album, loop through all credits and add those artists to the list
    album.credits.forEach((credit) => {
      allArtistNames.add(credit.name);
    });
  });
  // For this artist, loop through all collaborations and add those artists to the list
  artist.collaborations.forEach((collaboration) => {
    allArtistNames.add(collaboration.albumArtist);
  });
});

if (DEBUG) console.log(allArtistNames);

// Create the nodes array from the set of artist names
allArtistNames.forEach((name) => {
  nodes.push({ id: name, x: 0, y: 0 });
});

// Loop through the data per artist
data.forEach((artist) => {
  // Collaborators on their own albums
  const collaborators = artist.albums.flatMap((d) =>
    d.credits.filter((c) => c.name !== artist.name),
  );
  // Collaborators on other albums
  const asSideman = artist.collaborations.map((d) => d.albumArtist);

  // Keep count of the number of collaborations between two artists
  const connections = {};
  collaborators.forEach((d) => {
    const key = d.name;
    if (connections[key]) {
      connections[key] += 1;
    } else {
      // console.log(`Adding ${key} to connections for ${artist.name}`);
      connections[key] = 1;
    }
  });
  // console.log('collab', collaborators);
  // console.log('sideman', asSideman);
  // console.log('connections of ', artist, connections);

  asSideman.forEach((d) => {
    const key = d;
    if (connections[key]) {
      connections[key] += 1;
    } else {
      // console.log(`Adding ${key} to connections for ${artist.name}`);
      connections[key] = 1;
    }
  });
  // console.log('connections of ', artist, connections);

  // Add links between the current artist and their collaborators
  Object.entries(connections).forEach(([name, count]) => {
    const source = nodes.find((d) => d.id === artist.name);
    const target = nodes.find((d) => d.id === name);
    if (source && target) {
      links.push({
        source,
        target,
        value: count,
      });
    } else {
      console.log(
        `Could not find ${source ? "target" : "source"
        } node for link between ${artist.name} and ${name}`,
      );
    }
  });
});

// filter out links with value less than 2
const filteredLinks = links.filter((d) => d.value > 1);

if (DEBUG) console.log(links);


// Create simulation
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(filteredLinks).id(d => d.id)
    .distance(30) // check this out and play with it later
    .strength(0.1)
  )
  .force("charge", d3.forceManyBody()
    .strength(-100)
  )
  .force("x", d3.forceX())
  .force("y", d3.forceY());

const link = svg.append("g")
  .attr("stroke", "#999")
  .attr("stroke-opacity", 0.6)
  .selectAll("line")
  .data(filteredLinks)
  .join("line")
  .attr("stroke-width", d => Math.sqrt(d.value));

const zoomRect = svg.append("rect")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "none")
  .attr("pointer-events", "all")

const node = svg.append("g")
  .attr("stroke", "#fff")
  .attr("stroke-width", 1.5)
  .selectAll("circle")
  .data(nodes)
  .join("circle")
  .attr("r", 5)
  .attr("fill", "#69b3a2");

const zoom = d3.zoom()
  .scaleExtent([1 / 2, 64])
  .on("zoom", zoomed);

zoomRect.call(zoom)
  .call(zoom.transform, d3.zoomIdentity.translate(0, 0));


simulation.on("tick", () => {
  link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  node
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
});

function zoomed(event) {
  transform = event.transform;
  node.attr("transform", transform);
  link.attr("transform", transform);
}



