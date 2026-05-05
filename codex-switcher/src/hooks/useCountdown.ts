import { useEffect, useState } from 'react';
import { formatCountdown } from '../lib/time';

export function useCountdown(targetUnix: number): string {
  const [label, setLabel] = useState(() => formatCountdown(targetUnix));

  useEffect(() => {
    setLabel(formatCountdown(targetUnix));
    const id = setInterval(() => {
      setLabel(formatCountdown(targetUnix));
    }, 1000);
    return () => clearInterval(id);
  }, [targetUnix]);

  return label;
}
