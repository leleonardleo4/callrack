/**
 * Hand-typed request/response shapes for a handful of headline capabilities
 * (see `CallrackClient.weather`/`.news.search`/`.academic.search`), mirrored
 * from `apps/api/src/**\/dto` and `capability-definitions.ts` `discovery`
 * examples. This is intentionally NOT a generic capability-id-to-type
 * mapping system — every other capability stays reachable, fully
 * functional, and typed at its edges (`unknown` in/out) via the generic
 * `CallrackClient.call(id, input)`, which is how an agent discovers and
 * calls capabilities it wasn't compiled against anyway.
 */

export interface WeatherInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly days?: number;
}

export interface WeatherLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string | null;
}

export interface WeatherCurrentConditions {
  readonly time: string;
  readonly temperature: number | null;
  readonly humidity: number | null;
  readonly windSpeed: number | null;
  readonly precipitation: number | null;
  readonly weatherCode: number | null;
}

export interface WeatherDailyForecast {
  readonly date: string;
  readonly temperatureMax: number | null;
  readonly temperatureMin: number | null;
  readonly weatherCode: number | null;
}

export interface WeatherOutput {
  readonly location: WeatherLocation;
  readonly current: WeatherCurrentConditions | null;
  readonly daily: readonly WeatherDailyForecast[];
}

export interface NewsSearchInput {
  readonly query: string;
  readonly limit?: number;
}

export interface NewsArticle {
  readonly title: string;
  readonly url: string;
  readonly source: string | null;
  readonly publishedAt: string | null;
  readonly language: string | null;
  readonly country: string | null;
}

export interface NewsSearchOutput {
  readonly results: readonly NewsArticle[];
}

export interface AcademicSearchInput {
  readonly query: string;
  readonly limit?: number;
}

export interface AcademicWork {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly publicationYear: number | null;
  readonly doi: string | null;
  readonly url: string | null;
  readonly journal: string | null;
  readonly citations: number | null;
  readonly openAccess: boolean;
  readonly source: string;
}

export interface AcademicSearchOutput {
  readonly results: readonly AcademicWork[];
  readonly meta: { readonly count: number };
}
