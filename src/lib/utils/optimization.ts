export function formatCurrency(n: number, locale = "en-NG", currency = "NGN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function toISODateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const d = new Date();
  return toISODateUTC(d);
}

export function getCurrentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function dayHeaderLabel(dateStr: string, locale = "en-US"): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-50 text-green-700 border-green-300 focus:ring-green-500",
  LATE: "bg-amber-50 text-amber-700 border-amber-300 focus:ring-amber-500",
  ABSENT: "bg-red-50 text-red-700 border-red-300 focus:ring-red-500",
  EXCUSED: "bg-purple-50 text-purple-700 border-purple-300 focus:ring-purple-500",
};

export const STATUS_BUTTON_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 hover:bg-green-200",
  LATE: "bg-amber-100 text-amber-700 hover:bg-amber-200",
  ABSENT: "bg-red-100 text-red-700 hover:bg-red-200",
  EXCUSED: "bg-purple-100 text-purple-700 hover:bg-purple-200",
};

export function statusLabel(status: string | null): string {
  if (!status) return "—";
  if (status === "OFF") return "Off";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function createCachedFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = 5 * 60 * 1000) {
  const cache = new Map<string, { data: T; timestamp: number }>();

  return async (): Promise<T> => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data;
    }
    const data = await fetcher();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  };
}