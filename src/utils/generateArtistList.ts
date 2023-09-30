import { AlbumData } from '../data/types';

export const generateArtistList = (data: AlbumData[]): Set<string> => {
  const allArtistNames = new Set<string>();
  // Loop through the all albums
  data.forEach((album: AlbumData) => {
    // Add the artist name to the set if it doesn't already exist
    allArtistNames.add(album.albumArtist);
    // For this artist, loop through all collaborations and add those artists to the list
    album.collaborators.forEach((collaboration) => {
      allArtistNames.add(collaboration.name);
    });
  });
  return allArtistNames;
}
