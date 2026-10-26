'use client';
import { useEffect, useState } from 'react';
import { supabase, BUCKET, applyTheme, realId } from '../lib/supabase';

// phone photos are huge, so shrink to a 1280px JPEG before upload
const shrink = (file) => new Promise((done) => {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = img.width * k; c.height = img.height * k;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(done, 'image/jpeg', 0.8);
  };
  img.src = URL.createObjectURL(file);
});

const EMPTY = { weight: '', desc: '', program: '', programOther: '', point: '', pointOther: '' };
const PROGRAMS = ['Individual Student', 'GreenClub Member', 'CEP'];
const POINTS = ['Staffroom/Library', 'Biodiversity park', '3D Lab'];
const choose = (v, other) => (v === 'Other' ? (other.trim() ? `Other: ${other.trim()}` : '') : v);

function Pick({ label, value, onChange, options, other, onOther }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`f sel${open ? ' open' : ''}`}>
        <button type="button" className={`fld${value ? '' : ' ph'}`} onClick={() => setOpen(!open)}>{value || 'Select'}</button>
        <label>{label}</label>
        {open && (
          <>
            <div className="shade" onClick={() => setOpen(false)} />
            <div className="menu" role="listbox">
              {[...options, 'Other'].map((o) => (
                <button type="button" key={o} className={`opt${o === value ? ' on' : ''}`}
                  onClick={() => { onChange({ target: { value: o } }); setOpen(false); }}>
                  {o}
                  {o === value && <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {value === 'Other' && (
        <div className="f"><input placeholder=" " value={other} onChange={onOther} /><label>Please specify</label></div>
      )}
    </>
  );
}

export default function Student() {
  const [u, setU] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('log');
  const [board, setBoard] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    applyTheme(q.get('theme'));
    setU({ id: realId(q.get('student_id')), name: q.get('name'), course: q.get('course'), dp: q.get('dp_url') });
  }, []);

  useEffect(() => {
    if (tab !== 'board') return;
    supabase.rpc('leaderboard').then(({ data, error }) => setBoard(error ? [] : data));
  }, [tab]);

  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const program = choose(f.program, f.programOther);
  const point = choose(f.point, f.pointOther);
  const ok = Number(f.weight) > 0 && program && point && photo;

  const pick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file); setPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const path = `${u.id}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, await shrink(photo), { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const { error } = await supabase.from('plastic_logs').insert({
        student_id: u.id, name: u.name, course: u.course, dp_url: u.dp,
        weight_kg: Number(f.weight), description: f.desc.trim() || null, program, collection_point: point,
        proof_url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
      });
      if (error) throw error;
      setF(EMPTY); setPhoto(null); setPreview('');
      toast('Plastic log submitted');
    } catch (err) {
      toast('Could not submit. Check your connection and try again.');
    }
    setBusy(false);
  };

  if (!u) return null;
  if (!u.id || !u.name || !u.course)
    return <p className="note">Open Plastic Log from your student app to continue.</p>;

  return (
    <>
      <header className="bar">
        {u.dp ? <img className="dp" src={u.dp} alt="" /> : <div className="dp">{u.name[0]}</div>}
        <h1>{u.name}<small>{u.id} · {u.course}</small></h1>
      </header>
      <form className="wrap pb" hidden={tab !== 'log'} onSubmit={submit}>
        <div className="f"><input type="number" inputMode="decimal" step="0.01" min="0" placeholder=" " value={f.weight} onChange={set('weight')} /><label>Plastic weight (kg)</label></div>
        <div className="f"><textarea placeholder=" " value={f.desc} onChange={set('desc')} /><label>Description (optional)</label></div>
        <Pick label="Program" value={f.program} onChange={set('program')} options={PROGRAMS} other={f.programOther} onOther={set('programOther')} />
        <Pick label="Collection point" value={f.point} onChange={set('point')} options={POINTS} other={f.pointOther} onOther={set('pointOther')} />
        <label className="photo">
          {preview ? <img src={preview} alt="Proof" /> : (<>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.2 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.2L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
            Add proof photo</>)}
          <input type="file" accept="image/*" capture="environment" onChange={pick} />
        </label>
        <button className="btn block" disabled={!ok || busy}>{busy ? 'Submitting…' : 'Submit log'}</button>
      </form>
      <section className="wrap pb" hidden={tab !== 'board'}>
        <h2 className="ttl">Top 50 collectors</h2>
        {board === null ? <p className="note">Loading…</p> : !board.length ? <p className="note">No entries yet. Be the first!</p> : board.map((r, i) => (
          <div key={r.student_id} className={`row${r.student_id === u.id ? ' me' : ''}`}>
            <span className={`rk r${i + 1}`}>{i + 1}</span>
            {r.dp_url ? <img className="dp" src={r.dp_url} alt="" /> : <div className="dp">{r.name[0]}</div>}
            <div className="nm"><b>{r.name}</b><small>{r.course}</small></div>
            <span className="kg">{Number(r.total_kg).toFixed(2)} kg</span>
          </div>
        ))}
      </section>
      <nav className="nav">
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          <span><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg></span>Log
        </button>
        <button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>
          <span><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/></svg></span>Leaderboard
        </button>
      </nav>
      {msg && <div className="snack">{msg}</div>}
    </>
  );
}
