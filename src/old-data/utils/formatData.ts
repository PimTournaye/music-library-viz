import { roles } from './roles';

export type Credit = {
  name: string;
  role: string;
  id: number;
  thumbnail_url: string;
}

export type Album = {
  album: string;
  artist: string;
  year: number;
  tracklist: string[];
  discoData?: {
    credits?: {
      name: string;
      role: string;
      id: number;
      thumbnail_url: string;
    }[];
    image?: {
      resource_url: string;
    };
    id?: number;
  }
}

export type Artist = {
  name: string;
  albums: {
    name: string;
    year: number;
    tracks: string[];
    url: string | null;
    credits: Credit[];
    discogsID?: number;
  }[];
  collaborations: {
    name: string;
    year: number;
    albumArtist: string;
    tracks: string[];
    url: string | null;
    credits: Credit[];
    discogsID?: number;
  }[];
}


export function formatData(data: Album[]): Artist[] {
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

      // return the album data with the collaborators and their credits
      return {
        name: album.album,
        year: album.year,
        albumArtist: album.artist,
        tracks: album.tracklist,
        url: album.discoData?.image?.resource_url ?? null, 
        credits: formattedCredits,
        discogsID: album.discoData?.id
      }
    });

    return {
      name: artist,
      albums: albumData,
      collaborations: collabData,
    };
  });
  return artistData;
}