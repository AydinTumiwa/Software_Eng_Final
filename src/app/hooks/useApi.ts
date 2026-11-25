import { useCallback, useEffect, useState } from 'react';

// Loads data from the API when the component mounts (and when `deps`
// change). Call reload() after a change to fetch it again.
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => {
    setLoading(true);
    return load()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
