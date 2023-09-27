export const generateArtistList = (data) => {
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
  return allArtistNames;
}
