export interface KnowledgeEntityResponse {
  id: string;
  name: string;
  description: string | null;
  url: string;
  source: string;
}

export interface KnowledgeSearchResponseData {
  results: KnowledgeEntityResponse[];
}
