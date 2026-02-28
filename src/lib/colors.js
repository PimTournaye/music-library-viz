// One distinct color per named community (top 10), rest get a dim neutral.
export const COMMUNITY_COLORS = [
  '#f5c518', // 0  gold          — Herbie Hancock circle
  '#e8734a', // 1  burnt orange  — Miguel Zenon / modern NYC
  '#5b9bd5', // 2  steel blue    — Maria Schneider Orchestra
  '#72b98c', // 3  sage green    — Harish Raghavan
  '#c47db5', // 4  mauve         — Pat Metheny Group
  '#e8c040', // 5  amber         — Steve Coleman / M-Base
  '#8a7cc5', // 6  violet        — European scene
  '#e88c6a', // 7  peach         — Snarky Puppy
  '#5cb8b2', // 8  teal          — Charlie Haden
  '#d4956a', // 9  copper        — 10th community
];

const DIM = '#3a3830';

export function communityColor(id) {
  return id < COMMUNITY_COLORS.length ? COMMUNITY_COLORS[id] : DIM;
}
