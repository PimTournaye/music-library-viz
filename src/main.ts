import * as d3 from 'd3';
import { readFileSync, writeFileSync } from 'fs';
import { formatData } from './data/utils/formatData';

const data = JSON.parse(readFileSync('data/data.json', 'utf8'));

const graphData = formatData(data);

// write graph data to file
writeFileSync('data/graphData.json', JSON.stringify(graphData, null, 2));