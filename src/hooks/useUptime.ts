import { useState, useEffect } from 'react';

export function useUptime() {
  const [uptime, setUptime] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return uptime;
}
