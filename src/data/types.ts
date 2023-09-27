export interface Artist {
  name:           string;
  albums:         Album[];
  collaborations: Album[];
}

export interface Album {
  name:         string;
  year:         string;
  tracks:       string[];
  url:          string;
  credits:      Credit[];
  discogsID:    number;
  albumArtist?: string;
}

export interface Credit {
  name:          string;
  role:          string;
  id:            number;
  thumbnail_url: string;
}

export interface minimalAlbum {
  album:         string; 
  albumArtist:   string; 
  artist:        string;
}

export interface AlbumData {
  album:         string;
  albumArtist:   string;
  year:          number;
  genres:        string[];
  collaborators: Collaborator[];
  albumArt:      string;
}

export interface Collaborator {
  name:         string;
  anv:          string | undefined;
  join:         string | undefined;
  role:         string;
  tracks:       string | undefined;
  id:           number | undefined;
  resource_url: string | undefined;
}