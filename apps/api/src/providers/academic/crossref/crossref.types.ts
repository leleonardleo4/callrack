export interface CrossrefDateParts {
  'date-parts'?: number[][];
}

export interface CrossrefAuthor {
  given?: string;
  family?: string;
}

export interface CrossrefWork {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  'published-print'?: CrossrefDateParts;
  'published-online'?: CrossrefDateParts;
  'container-title'?: string[];
  'is-referenced-by-count'?: number;
  URL?: string;
}

export interface CrossrefWorksMessage {
  'total-results'?: number;
  items?: CrossrefWork[];
}

export interface CrossrefWorksResponse {
  status?: string;
  message?: CrossrefWorksMessage;
}

export interface CrossrefWorkResponse {
  status?: string;
  message?: CrossrefWork;
}
