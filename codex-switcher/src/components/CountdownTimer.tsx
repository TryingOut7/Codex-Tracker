import { useCountdown } from '../hooks/useCountdown';

export function CountdownTimer({ targetUnix }: { targetUnix: number }) {
  const label = useCountdown(targetUnix);
  return <span className="tabular-nums">{label}</span>;
}
