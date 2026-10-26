'use client';
import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { supabase, applyTheme } from '../../lib/supabase';

const COLS = ['created_at', 'student_id', 'name', 'course', 'weight_kg', 'program', 'collection_point', 'description', 'proof_url', 'status'];

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [em, setEm] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [view, setView] = useState('pending');

  useEffect(() => {
    applyTheme(new URLSearchParams(location.search).get('theme'));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('plastic_logs').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [session]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => (view === 'all' || r.status === view) &&
      [r.student_id, r.name, r.course, r.program, r.collection_point].join(' ').toLowerCase().includes(s));
  }, [rows, q, view]);
  const count = (s) => rows.filter((r) => r.status === s).length;
  const total = list.reduce((a, r) => a + Number(r.weight_kg), 0);

  const login = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    setErr(error ? 'Wrong email or password' : '');
  };

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '\ufeff' + [COLS.join(','), ...list.map((r) => COLS.map((c) => esc(r[c])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `plastic-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const setStatus = async (id, status) => {
    const { error } = await supabase.from('plastic_logs').update({ status }).eq('id', id);
    if (!error) setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const [zipping, setZipping] = useState('');
  const [zipNote, setZipNote] = useState('');

  // Every proof in the current list goes into ONE flat zip (no folders), named like 5207872_Name_2026-10-23_ab12cd34.jpg
  const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const downloadProofs = async () => {
    const zip = new JSZip(), queue = [...list];
    let done = 0, failed = 0;
    setZipNote('');
    const worker = async () => {
      while (queue.length) {
        const r = queue.shift();
        try {
          const res = await fetch(r.proof_url);
          if (!res.ok) throw new Error();
          zip.file(`${safe(r.student_id)}_${safe(r.name)}_${r.created_at.slice(0, 10)}_${r.id.slice(0, 8)}.jpg`, await res.blob());
        } catch { failed++; }
        setZipping(`Fetching ${++done}/${list.length}`);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    setZipping('Zipping…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plastic-proofs-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    setZipping('');
    if (failed) setZipNote(`${failed} image${failed > 1 ? 's' : ''} could not be downloaded and ${failed > 1 ? 'were' : 'was'} left out.`);
  };

  if (session === undefined) return null;

  if (!session) return (
    <>
      <header className="bar"><h1>Plastic Log admin</h1></header>
      <form className="wrap" onSubmit={login}>
        <div className="f"><input type="email" placeholder=" " value={em} onChange={(e) => setEm(e.target.value)} /><label>Email</label></div>
        <div className="f"><input type="password" placeholder=" " value={pw} onChange={(e) => setPw(e.target.value)} /><label>Password</label></div>
        {err && <div className="err">{err}</div>}
        <button className="btn block" disabled={!em || !pw}>Sign in</button>
      </form>
    </>
  );

  return (
    <>
      <header className="bar">
        <h1>Plastic Log<small>Green Club admin</small></h1>
        <button className="btn tonal" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <main className="wrap wide">
        <div className="chips">
          {['pending', 'accepted', 'rejected', 'all'].map((v) => (
            <button key={v} className={`chip${view === v ? ' on' : ''}`} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)} {v === 'all' ? rows.length : count(v)}
            </button>
          ))}
        </div>
        <p className="sub">{list.length} shown · {total.toFixed(2)} kg</p>
        {zipNote && <p className="sub">{zipNote}</p>}
        <div className="tool">
          <div className="f"><input placeholder=" " value={q} onChange={(e) => setQ(e.target.value)} /><label>Search student, course, program</label></div>
          <button className="btn" onClick={exportCsv} disabled={!list.length}>Export CSV</button>
          <button className="btn tonal" onClick={downloadProofs} disabled={!list.length || !!zipping}>{zipping || `Download proofs (${list.length})`}</button>
        </div>
        <div className="tbl">
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>Course</th><th>kg</th><th>Program</th><th>Collection point</th><th>Description</th><th>Proof</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>{r.name}<br /><small>{r.student_id}</small></td>
                  <td>{r.course}</td><td>{r.weight_kg}</td><td>{r.program}</td><td>{r.collection_point}</td>
                  <td className="wrapc">{r.description}</td>
                  <td><a href={r.proof_url} target="_blank" rel="noreferrer"><img src={r.proof_url} alt="Proof" /></a></td>
                  <td><span className={`st ${r.status}`}>{r.status}</span></td>
                  <td>
                    {r.status !== 'accepted' && <button className="btn sm" onClick={() => setStatus(r.id, 'accepted')}>Accept</button>}{' '}
                    {r.status !== 'rejected' && <button className="btn sm tonal" onClick={() => setStatus(r.id, 'rejected')}>Reject</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
