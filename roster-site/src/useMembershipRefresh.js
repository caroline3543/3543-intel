import {useCallback, useEffect, useRef, useState} from 'react';

async function request(method, signal) {
  const response = await fetch('/api/membership-refresh', {
    method, signal, credentials:'same-origin', cache:'no-store'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw Error(data?.error || 'Refresh status is unavailable.');
  return data.refresh;
}

export function useMembershipRefresh(ready) {
  const [refresh, setRefresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const starting = useRef(false);
  const version = useRef(0);
  const start = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    version.current++;
    setBusy(true);
    setError('');
    try { setRefresh(await request('POST', AbortSignal.timeout(13000))); }
    catch (failure) { setError(failure.message); }
    finally { starting.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    let pending = false;
    async function load() {
      if (pending || starting.current || document.visibilityState === 'hidden') return;
      const key = version.current;
      pending = true;
      try {
        const result = await request('GET', AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]));
        if (!abort.signal.aborted && key === version.current) {
          setRefresh(result);
          setError('');
        }
      } catch (failure) {
        if (!abort.signal.aborted && key === version.current) setError(failure.message);
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
  return {refresh, busy, error, start, running: Boolean(refresh && !refresh.completedAt)};
}
