import Graph from "graphology";
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from "sigma";

import { generateArtistList } from "./utils/generateArtistList";
import { AlbumData } from "./data/types";
import { rgb } from "d3";

// A boolean to switch of some edges
const showOnlyFrequentCollaborators = true;

// Import the data
const jsonUrl = "src/data/final-data.json";
// Read the data
const data: AlbumData[] = await fetch(jsonUrl).then((res) => res.json());

// Set up the graph
// @ts-ignore
const container = document.getElementById("viz")!; // the ! appended to the end of the variable name tells TypeScript that we know this element exists
const graph = new Graph();

// Render the graph
const renderer = new Sigma(graph, container);

const state: State = {};

// Type and declare internal state:
interface State {
  hoveredNode?: string;

  // State derived from query:
  selectedNode?: string;

  // State derived from hovered node:
  hoveredNeighbors?: Set<string>;
  hoveredEdges?: Set<string>;
}

function setHoveredNode(node?: string) {
  if (node) {
    state.hoveredNode = node;
    state.hoveredNeighbors = new Set(graph.neighbors(node));
  } else {
    state.hoveredNode = undefined;
    state.hoveredNeighbors = undefined;
  }
  // Refresh rendering:
  renderer.refresh();
}

// Bind graph interactions:
renderer.on("enterNode", ({ node }) => {
  setHoveredNode(node);
});
renderer.on("leaveNode", () => {
  setHoveredNode(undefined);
});

// Get a unique list of all artist names so we can create nodes for them. Outputs an array of strings like ['Aaron Diehl', 'Kendrick Scott Oracle', ...]
const artists: Set<string> = generateArtistList(data);

// Add the nodes to the graph
artists.forEach((artist) => {
  // @ts-ignore
  graph.addNode(artist, {
    x: Math.random(),
    y: Math.random(),
    size: 7,
    color: "#69b3a2",
    label: artist,
  });
});

// Generate the edges
data.forEach((album: AlbumData) => {
  // Set the artist as the source node
  const source = album.albumArtist;
  // Loop through each collaborator on the album
  album.collaborators.forEach((collaborator) => {
    // If the collaborator is the dsame as the artist, skip it
    if (collaborator.name === source) return;
    // Get a color alpha value based on the number of times the artist and collaborator have worked together
    let alpha = 20;
    
    // Check if an edge between these two nodes already exists
    const edgeExists = graph.hasEdge(source, collaborator.name);
    // If the edge doesn't already exist, create it
    if (!edgeExists) {
      graph.addEdge(source, collaborator.name, {
        size: 1,
        // color: rgb(105,179,162, alpha),
        color: "#80808020",
      });
    } else {
      // If the edge does exist, increment the size
      const edge = graph.getEdgeAttributes(source, collaborator.name);
      graph.updateEdgeAttribute(source, collaborator.name, "size", () => edge.size + 1);
      // // Update the alpha value
      // alpha += 5;
      // graph.updateEdgeAttribute(source, collaborator.name, "color", () => rgb(128,128,128, alpha));
    }
  });
});

// Filer out nodes with no edges or neighbors
graph.nodes().forEach((node) => {
  const edges = graph.edges(node);
  if (edges.length === 0) {
    graph.dropNode(node);
  }
});

// The more neighbors a node has, the larger it will be
graph.nodes().forEach((node) => {
  const neighbors = graph.neighbors(node);
  const connectedness = neighbors.length;
  graph.updateNodeAttribute(node, "size", () => connectedness);
});

// // For specific use cases
if (showOnlyFrequentCollaborators) {
  // Filter out nodes with only one neighbor (i.e. they only collaborated once)
  graph.nodes().forEach((node) => {
    const neighbors = graph.neighbors(node);
    if (neighbors.length <= 1) {
      graph.dropNode(node);
    }
  });
}

// Render nodes accordingly to the internal state:
// If a node is selected, it is highlighted
// If there is a hovered node, all non-neighbor nodes are greyed
renderer.setSetting("nodeReducer", (node, data) => {
  const res = { ...data };

  if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
    res.label = "";
    // Set alpha to 0.05
    // res.color = "";
    res.color = "";
  }

  if (state.selectedNode === node) {
    res.highlighted = true;
  }
  return res;
});

renderer.setSetting("edgeReducer", (edge, data) => {
  const res = { ...data };

  if (state.hoveredNode && !graph.hasExtremity(edge, state.hoveredNode)) {
    res.hidden = true;
  }
  return res;
});

// Create the spring layout and start it
// const layout = new NoverlapLayout(graph);
// layout.start();

const settings = forceAtlas2.inferSettings(graph);
forceAtlas2.assign(graph, { settings, iterations: 3000 });

// To do:
// Switch to web worker layout
// Hide labels by default
// Show labels on hover of neighbours

// show collaborators on hover of edge
// show albums on hover of edge