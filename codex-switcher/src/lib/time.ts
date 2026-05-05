import { formatDistanceToNowStrict } from 'date-fns';

export function unixToDate(unix: number): Date {
  return new Date(unix * 1000);
}

export function lastRefreshedLabel(unix: number | null): string {
  if (!unix) return 'never';
  return `${formatDistanceToNowStrict(unixToDate(unix))} ago`;
}

export function countdown(targetUnix: number): {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
} {
  const totalMs = Math.max(0, targetUnix * 1000 - Date.now());
  const totalSec = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { hours, minutes, seconds, totalMs };
}

export function formatCountdown(targetUnix: number): string {
  const { hours, minutes, seconds, totalMs } = countdown(targetUnix);
  if (totalMs === 0) return 'now';
  if (hours >= 1) return `${hours}h ${minutes}m`;
  if (minutes >= 1) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
