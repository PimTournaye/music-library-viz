import { roles } from './roles.js';

export function formatData(data) {
  // 1. Get a list of unique artists
  const uniqueArtists = [...new Set(data.map(album => album.artist))];

  // 2. For each unique artist, get a list of albums they are the main/lead artist on
  //map over unique artists array
  const artistData = uniqueArtists.map(artist => {
    //filter data to only include albums by the artist in the current iteration
    const mainAlbums = data.filter(album => album.artist === artist);
    //map over the filtered array to create an object for each album
    const albumData = mainAlbums.map(album => {
      return {
        name: album.album,
        year: album.year,
        tracks: album.tracklist,
        url: album.discoData?.image?.url ?? null,
        credits: album.discoData?.credits,
        discogsID: album.discoData?.id
      }
    });

    // 3. For each artist, get a list of albums they are a collaborator on
    // filter out albums that have the artist and role in the credits
    const collabAlbums = data.filter(album => {
      return album.discoData?.credits?.some(credit => credit.name === artist && roles.includes(credit.role))
    });

    // loop through each album and store the credits that have the artist and role
    const collabData = collabAlbums.map(album => {
      const credits = album.discoData?.credits?.filter(credit => credit.name !== artist && roles.includes(credit.role)) ?? []; // maybe check this
      
      // filter out credits whose role is not in the roles array

      // get unique collaborators
      const collaboratorNames = [...new Set(credits.map(credit => credit.name))];

      // loop through each collaborator and store their credits
      const collabs = collaboratorNames.map(collab => {
        const collabCredits = credits?.filter(credit => credit.name === collab);

        // get the albums that the collaborator has worked on with the artist
        return {
          name: collab,
          albumsTheyHaveWorkedOnTogether: albumData.filter(alb => {
            return alb.credits?.some(credit => credit.name === collab);
          }),
          amountOfCollaborations: collabCredits.length
        }
      });

      // return the album data with the collaborators and their credits
      return {
        name: album.album,
        year: album.year,
        tracks: album.tracklist,
        url: album.discoData?.image?.url,
        credits: credits,
        collaborators: collabs,
        discogsID: album.discoData.id
      }
    });

    // 4. For each artist, get a list of albums they have contributed to as a collaborator
    const contribAlbums = data.filter(album => {
      // check if the album has credits
      if (album.discoData?.credits?.length > 0) {
      // filter the data array to find all albums that have credits where the artist's name matches the artist variable
      return album.discoData.credits.some(credit => credit.name === artist && roles.includes(credit.role))
      } else {
        return false;
      }
    });
    const contribData = contribAlbums.map(album => {
      const credits = album.discoData.credits.filter(credit => credit.name === artist && roles.includes(credit.role));
      const collaboratorNames = [...new Set(album.discoData.credits.filter(credit => credit.name !== artist && roles.includes(credit.role)).map(credit => credit.name))];
      const collabs = collaboratorNames.map(collab => {
        const collabCredits = album.discoData.credits.filter(credit => credit.name === collab && roles.includes(credit.role));
        return {
          name: collab,
          albumsTheyHaveWorkedOnTogether: albumData.filter(alb => {
            const albCredits = alb.credits;
            const hasCollab = albCredits && Array.isArray(albCredits) && albCredits.some(credit => credit.name === collab && roles.includes(credit.role));
            return hasCollab;
          }),
          amountOfCollaborations: collabCredits.length
        }
      });
      return {
        name: album.album,
        year: album.year,
        tracks: album.tracklist,
        url: album.discoData.thumbnail_url,
        credits: credits,
        collaborators: collabs,
        discogsID: album.discoData.id
      }
    });

    // 5. While doing that, check the amount of times our artist has worked together with another unique artist
    const collaborations = {};
    collabAlbums.forEach(album => {
      const collabs = album.discoData.credits.filter(credit => credit.name !== artist && roles.includes(credit.role));
      collabs.forEach(collab => {
        if (collaborations[collab.name] === undefined) {
          collaborations[collab.name] = 1;
        } else {
          collaborations[collab.name]++;
        }
      });
    });

    // Remove any collaborators that are only credited once
    const popularCollaborators = Object.entries(collaborations)
      .filter(entry => entry[1] > 1)
      .map(entry => entry[0]);

    // Filter out only the roles in the 'roles' array
    const filteredCollaborators = collabData.map(album => {
      const filteredCollabs = album.collaborators.map(collab => {
        if (collab.credits && collab.credits.length > 0 && roles.includes(collab.credits[0].role) && popularCollaborators.includes(collab.name)) {
          // your code here
          return collab;
        } else {
          return null;
        }
      }).filter(collab => collab !== null);
      return {
        name: album.name,
        year: album.year,
        tracks: album.tracks,
        url: album.url,
        credits: album.credits,
        collaborators: filteredCollabs,
        discogsID: album.discogsID
      }
    });
    // Remove any albums with no collaborators
    // const finalData = filteredCollaborators.filter(album => album.collaborators.length > 0);

    return {
      name: artist, 
      albums: albumData,
      collaborations: filteredCollaborators,
      contributions: contribData
    };
  });
  return artistData;
};