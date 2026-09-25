/**
 * Extract {latitude, longitude} from a Google Maps URL.
 * Handles: @lat,lng viewport, !3dlat!4dlng place coords, ?q=/ll= query params, /dir/ paths.
 */
export function parseCoordsFromUrl(url: string): { latitude: number; longitude: number } | null {
  const patterns = [
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    /[?&](?:q|ll|query|destination)=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\/maps\/dir\/[^/]*?(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { latitude: lat, longitude: lng };
    }
  }
  return null;
}
