import * as d3 from 'd3';

// ── Temporal color scale ───────────────────────────────────────────────────────
// Maps medianYear (1957–2022) to a warm→cool gradient.
// Roots/classic = warm gold/amber, contemporary = cool steel blue.
export const YEAR_MIN = 1957;
export const YEAR_MAX = 2022;

// Curated stops: warm amber → burnt sienna → muted rose → dusty violet → steel blue
const yearInterpolator = d3.piecewise(d3.interpolateRgb.gamma(2.2), [
  '#c9942a', '#c06830', '#9a5878', '#6a6ca0', '#4a7aaa'
]);

const yearDomain = d3.scaleLinear()
  .domain([YEAR_MIN, YEAR_MAX])
  .range([0, 1])
  .clamp(true);

/**
 * Return a hex color for a given median year.
 */
export function yearColor(year) {
  if (year == null) return '#6b5a42';
  return yearInterpolator(yearDomain(year));
}

/**
 * Gradient stops for rendering a continuous legend bar.
 * Returns an array of { offset, color } suitable for SVG linearGradient.
 */
export function yearGradientStops() {
  const steps = 32;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { offset: `${(t * 100).toFixed(1)}%`, color: yearInterpolator(t) };
  });
}

// ── Legacy community color (kept for backward compat) ──────────────────────────
const COMMUNITY_COLORS = [
  '#f5c518', '#e8734a', '#5b9bd5', '#72b98c', '#c47db5',
  '#e8c040', '#8a7cc5', '#e88c6a', '#5cb8b2', '#d4956a',
  '#d4607a', '#a0c878', '#7ab4e0', '#c890d8',
];
const DIM = '#3a3830';
export function communityColor(id) {
  return id < COMMUNITY_COLORS.length ? COMMUNITY_COLORS[id] : DIM;
}
