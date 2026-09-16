export interface OpenAlexAuthorship {
  author?: { display_name?: string | null } | null;
}

export interface OpenAlexLocation {
  source?: { display_name?: string | null } | null;
}

export interface OpenAlexOpenAccess {
  is_oa?: boolean;
  oa_url?: string | null;
}

export interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  primary_location?: OpenAlexLocation | null;
  authorships?: OpenAlexAuthorship[];
  cited_by_count?: number;
  open_access?: OpenAlexOpenAccess;
}

export interface OpenAlexWorksResponse {
  meta?: { count?: number };
  results?: OpenAlexWork[];
}
