import { roles } from './roles.js';
interface Credit {
  name: string;
  role: string;
  id: string;
  thumbnail_url: string;
}

interface Album {
  album: string;
  artist: string;
  year: number;
  tracklist: string[];
  discoData: {
      credits: {
          name: string;
          role: string;
          id: string;
          thumbnail_url: string;
      }[];
      image: {
          resource_url: string;
      };
      id: number;
  };
}

interface Collaborator {
  name: string;
  albumsTheyHaveWorkedOnTogether: Album[];
  amountOfCollaborations: number;
}

interface FormattedAlbum {
  name: string;
  year: number;
  albumArtist: string;
  tracks: string[];
  url: string | null;
  credits: Credit[];
  collaborators: Collaborator[];
  discogsID: number;
}

interface FormattedArtistData {
  name: string;
  albums: FormattedAlbum[];
}


export function formatData(data: Album[]) {
  // 1. Get a list of unique artists
  const uniqueArtists = [...new Set(data.map(album => album.artist))];

  ////////////////////////////
  // 2. For each unique artist, get a list of albums they are the main/lead artist on
  ////////////////////////////

  //map over unique artists array
  const artistData = uniqueArtists.map(artist => {
    //filter data to only include albums by the artist in the current iteration
    const mainAlbums = data.filter(album => album.artist === artist);
    //map over the filtered array to create an object for each album
    const albumData = mainAlbums.map(album => {
      // only include the roles in the roles array when creating the credits array
      const credits = album.discoData?.credits?.filter(credit => roles.includes(credit.role)) ?? [];
      // every entry in credits should include only the following information: name, role, id, and thumbnail_url
      const formattedCredits = credits.map(credit => {
        return {
          name: credit.name,
          role: credit.role,
          id: credit.id,
          thumbnail_url: credit.thumbnail_url
        }
      });

      return {
        name: album.album,
        year: album.year,
        tracks: album.tracklist,
        url: album.discoData?.image?.resource_url ?? null,
        credits: formattedCredits,
        discogsID: album.discoData?.id
      }
    });

    /////////////////////////////////
    // 3. For each artist, get a list of albums they are a collaborator on (excluding their own albums)
    /////////////////////////////////

    // Go through each album and check if the current artist is a collaborator on it
    const collabAlbums = data.filter(album => {
      return album.artist !== artist && album.discoData?.credits?.some(credit => credit.name === artist && album.artist !== artist);
    });

    // loop through each album and store the credits that have the artist and role
    const collabData = collabAlbums.map(album => {
      const credits = album.discoData?.credits?.filter(credit => credit.name !== artist && roles.includes(credit.role)) ?? []; // maybe check this
      // Only keep the relevant information for each credit
      const formattedCredits = credits.map(credit => {
        return {
          name: credit.name,
          role: credit.role,
          id: credit.id,
          thumbnail_url: credit.thumbnail_url
        }
      });

      // // get unique collaborators
      // const collaboratorNames = [...new Set(formattedCredits.map(credit => credit.name))]; // is this necessary for graph data

      // // loop through each collaborator and store their credits
      // const collabs = collaboratorNames.map(collab => {
      //   const collabCredits = credits?.filter(credit => credit.name === collab);

      //   // get the albums that the collaborator has worked on with the artist
      //   return {
      //     name: collab,
      //     albumsTheyHaveWorkedOnTogether: albumData.filter(alb => {
      //       return alb.credits?.some(credit => credit.name === collab);
      //     }),
      //     amountOfCollaborations: collabCredits.length
      //   }
      // });

      // return the album data with the collaborators and their credits
      return {
        name: album.album,
        year: album.year,
        albumArtist: album.artist,
        tracks: album.tracklist,
        url: album.discoData?.image?.resource_url ?? null, 
        credits: formattedCredits,
        discogsID: album.discoData.id
      }
    });

    // 4. Next, for our current artist, we want to get a list of all the albums they have played on that are not their own
  //   const collaborations = {};
  //   collabAlbums.forEach(album => {
  //     const collabs = album.discoData.credits.filter(credit => credit.name !== artist && roles.includes(credit.role));
  //     collabs.forEach(collab => {
  //       if (collaborations[collab.name] === undefined) {
  //         collaborations[collab.name] = 1;
  //       } else {
  //         collaborations[collab.name]++;
  //       }
  //     });
  //   });

  //   // Remove any collaborators that are only credited once
  //   const popularCollaborators = Object.entries(collaborations)
  //     .filter(entry => entry[1] > 1)
  //     .map(entry => entry[0]);

  //   // Filter out only the roles in the 'roles' array
  //   const filteredCollaborators = collabData.map(album => {
  //     const filteredCollabs = album.collaborators.map(collab => {
  //       if (collab.credits && collab.credits.length > 0 && roles.includes(collab.credits[0].role) && popularCollaborators.includes(collab.name)) {
  //         // your code here
  //         return collab;
  //       } else {
  //         return null;
  //       }
  //     }).filter(collab => collab !== null);
  //     return {
  //       name: album.name,
  //       year: album.year,
  //       tracks: album.tracks,
  //       url: album.resource_url,
  //       credits: album.credits,
  //       collaborators: filteredCollabs,
  //       discogsID: album.discogsID
  //     }
  //   });
  //   // Remove any albums with no collaborators
  //   const finalData = filteredCollaborators.filter(album => album.collaborators.length > 0);

    return {
      name: artist,
      albums: albumData,
      collaborations: collabData,
    };
  });
  return artistData;
}