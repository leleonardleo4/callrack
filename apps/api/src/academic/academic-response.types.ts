export interface AcademicWorkResponse {
  id: string;
  title: string;
  authors: string[];
  publicationYear: number | null;
  doi: string | null;
  url: string | null;
  journal: string | null;
  citations: number | null;
  openAccess: boolean;
  source: string;
}

export interface AcademicSearchResponseData {
  results: AcademicWorkResponse[];
  meta: {
    count: number;
  };
}
