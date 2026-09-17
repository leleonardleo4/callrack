export interface CensusQueryResponseData {
  dataset: string;
  year: number;
  columns: string[];
  rows: Array<Record<string, string>>;
}
