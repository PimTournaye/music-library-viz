// One distinct color per named community (top 14), rest get a dim neutral.
export const COMMUNITY_COLORS = [
  '#f5c518', // 0  gold
  '#e8734a', // 1  burnt orange
  '#5b9bd5', // 2  steel blue
  '#72b98c', // 3  sage green
  '#c47db5', // 4  mauve
  '#e8c040', // 5  amber
  '#8a7cc5', // 6  violet
  '#e88c6a', // 7  peach
  '#5cb8b2', // 8  teal
  '#d4956a', // 9  copper
  '#d4607a', // 10 rose
  '#a0c878', // 11 lime green
  '#7ab4e0', // 12 sky blue
  '#c890d8', // 13 lilac
];

const DIM = '#3a3830';

export function communityColor(id) {
  return id < COMMUNITY_COLORS.length ? COMMUNITY_COLORS[id] : DIM;
}
