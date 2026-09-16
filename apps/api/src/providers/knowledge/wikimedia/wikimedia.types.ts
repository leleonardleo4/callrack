export interface WikidataSearchEntity {
  id?: string;
  label?: string;
  description?: string;
  url?: string;
}

export interface WikidataSearchResponse {
  search?: WikidataSearchEntity[];
  success?: number;
}
