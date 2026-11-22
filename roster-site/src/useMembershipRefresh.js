import {useEffect, useState} from 'react';

async function request(signal) {
  const response = await fetch('/api/membership-refresh', {
    signal, credentials:'same-origin', cache:'no-store'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw Error(data?.error || 'Refresh status is unavailable.');
  return data.refresh;
}

export function useMembershipRefresh(ready) {
  const [refresh, setRefresh] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    let pending = false;
    async function load() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const result = await request(AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]));
        if (!abort.signal.aborted) {
          setRefresh(result);
          setError('');
        }
      } catch (failure) {
        if (!abort.signal.aborted) setError(failure.message);
      } finally { pending = false; }
    }
    load();
    const timer = setInterval(load, 10000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [ready]);
  return {refresh, error, running: Boolean(refresh && !refresh.completedAt)};
}
