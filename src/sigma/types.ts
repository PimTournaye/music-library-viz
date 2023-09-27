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
}