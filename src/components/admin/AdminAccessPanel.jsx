import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient.js';
import { fetchMightpulseUsage } from '../../services/mightpulseService.js';
import { C } from '../../utils/constants.js';

/** Sign-in for protected API diagnostics. Auth alone never grants admin status:
 * the Edge Function checks the user ID allowlist. */
export function AdminAccessPanel() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setResult(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signInWithPassword(event) {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword('');
      setMessage('Signed in.');
    } catch (e) { setMessage(e.message || 'Unable to sign in'); }
    finally { setBusy(false); }
  }

  async function sendLogin() {
    if (!supabase || !email.trim()) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMessage('Check your email for a sign-in link. Signing in does not grant admin access automatically.');
    } catch (e) { setMessage(e.message || 'Unable to send sign-in link'); }
    finally { setBusy(false); }
  }

  async function testConnection() {
    setBusy(true); setResult(null); setMessage('');
    try {
      const response = await fetchMightpulseUsage();
      setResult(response);
      setMessage('Whiteout Stats responded successfully.');
    } catch (e) { setMessage(e.message || 'Connection failed. Admin allowlist and deployment may not be configured.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    setResult(null); setMessage('Signed out');
    setBusy(false);
  }

  const btn = { border: 'none', borderRadius: 10, padding: '12px 14px', background: C.gold, color: C.bg, fontWeight: 700, cursor: 'pointer' };
  return (
    <section style={{ background: C.section, border: '1px solid '+C.border, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔐 Admin access</div>
      <p style={{ color: C.muted, fontSize: 12, marginTop: 0 }}>
        The app remains public. Only approved Supabase accounts can access protected API functions.
      </p>
      {!supabase ? <p style={{ color: C.red }}>Supabase is not configured.</p> :
        session ? <>
          <div style={{ color: C.icy, fontSize: 12, marginBottom: 10 }}>Signed in: {session.user.email}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn} disabled={busy} onClick={testConnection}>Test Whiteout Stats</button>
            <button style={{ ...btn, background: C.card, color: C.icy }} disabled={busy} onClick={signOut}>Sign out</button>
          </div>
        </> : <>
          <form onSubmit={signInWithPassword}>
          <label htmlFor="admin-email" style={{ color: C.icy, display: 'block', fontSize: 12, marginBottom: 6 }}>Email for secure sign-in</label>
          <input id="admin-email" type="email" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            style={{ boxSizing: 'border-box', width: '100%', padding: 12, marginBottom: 10,
              color: C.white, background: C.bg, border: '1px solid '+C.border, borderRadius: 8 }} />
          <label htmlFor="admin-password" style={{ color: C.icy, display: 'block', fontSize: 12, marginBottom: 6 }}>Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ boxSizing: 'border-box', width: '100%', padding: 12, marginBottom: 10,
              color: C.white, background: C.bg, border: '1px solid '+C.border, borderRadius: 8 }} />
          <button type="submit" style={btn} disabled={busy || !email.trim() || !password}>Sign in</button>
          </form>
          <button type="button" style={{ ...btn, marginTop: 8, background: C.card, color: C.icy }} disabled={busy || !email.trim()} onClick={sendLogin}>Send sign-in link</button>
        </>}
      {message && <p role="status" style={{ color: C.icy, fontSize: 12, marginBottom: 0 }}>{message}</p>}
      {result && <details style={{ marginTop: 12 }}><summary>Response data</summary>
        <pre style={{ overflow: 'auto', maxHeight: 320, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(result.data, null, 2)}</pre>
      </details>}
      {result && <p style={{ color: C.green, fontSize: 12, marginBottom: 0 }}>API connected · Checked {new Date(result.retrieved_at).toLocaleString()}</p>}
    </section>
  );
}
