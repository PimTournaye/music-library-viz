import * as d3 from "d3";
import type { Album, Artist } from "./data/utils/formatData";

const jsonUrl = "../data/graphData.json";

const margin = { top: 10, right: 30, bottom: 30, left: 40 };
const width = 10000 - margin.left - margin.right;
const height = 10000 - margin.top - margin.bottom;

// Setup our svg element for d3 to use
const svg = d3
	.select("#viz")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.append("g")
	.attr("transform", `translate(${margin.left}, ${margin.top})`);

// Read our data from the json file
d3.json<Artist[]>(jsonUrl).then((data) => {
	if (!data) return;
	const nodes: { id: string }[] = [];
	const links: {
		source: { id: string };
		target: { id: string };
		value: number;
	}[] = [];

	const allArtistNames = new Set<string>();
	data.forEach((artist) => {
		allArtistNames.add(artist.name);
		artist.albums.forEach((album) => {
			album.credits.forEach((credit) => {
				allArtistNames.add(credit.name);
			});
		});
		artist.collaborations.forEach((collaboration) => {
			allArtistNames.add(collaboration.albumArtist);
		});
	});

	// Create the nodes array from the set of artist names
	allArtistNames.forEach((name) => {
		nodes.push({ id: name });
	});

	// Iterate over each artist in the data
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
					`Could not find ${
						source ? "target" : "source"
					} node for link between ${artist.name} and ${name}`,
				);
			}
		});
	});

  // filter out links with value less than 2
  const filteredLinks = links.filter((d) => d.value > 1);

	// Now we have our nodes and links, we can create our d3 force simulation and render the graph

	// Create a force simulation
	const simulation = d3
		.forceSimulation(nodes)
		.force(
			"link",
			d3.forceLink(filteredLinks).id((d) => d.id),
		)
		.force("charge", d3.forceManyBody())
		.force("center", d3.forceCenter(width / 2, height / 2));

	// Add the links
	const link = svg
		.append("g")
		.attr("stroke", "#999")
		.attr("stroke-opacity", 0.6)
		.selectAll("line")
		.data(links)
		.enter()
		.append("line")
		.attr("stroke-width", (d) => Math.sqrt(d.value));

	// Add the nodes
	const node = svg
		.append("g")
		.attr("stroke", "#fff")
		.attr("stroke-width", 1.5)
		.selectAll("circle")
		.data(nodes)
		.enter()
		.append("circle")
		.attr("r", 5)
		.attr("fill", "steelblue");

	// Add the labels
	const label = svg
		.append("g")
		.attr("class", "labels")
		.selectAll("text")
		.data(nodes)
		.enter()
		.append("text")
		.text((d) => d.id)
		.attr("font-family", "sans-serif")
		.attr("font-size", 10)
		.attr("fill", "black");

	// // Add the tick instructions:
	simulation.on("tick", () => {
		// Update the link positions
		link
			.attr("x1", (d) => d.source.x)
			.attr("y1", (d) => d.source.y)
			.attr("x2", (d) => d.target.x)
			.attr("y2", (d) => d.target.y);

		// Update the node positions
		node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

		// Update the label positions
		label.attr("x", (d) => d.x + 6).attr("y", (d) => d.y + 3);
	});
});
