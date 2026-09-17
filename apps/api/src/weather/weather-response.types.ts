export interface WeatherLocationResponse {
  latitude: number;
  longitude: number;
  timezone: string | null;
}

export interface WeatherCurrentResponse {
  time: string;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  weatherCode: number | null;
}

export interface WeatherDailyResponse {
  date: string;
  temperatureMax: number | null;
  temperatureMin: number | null;
  weatherCode: number | null;
}

export interface WeatherResponseData {
  location: WeatherLocationResponse;
  /** Null when Open-Meteo did not return a current observation for this request. */
  current: WeatherCurrentResponse | null;
  daily: WeatherDailyResponse[];
}
