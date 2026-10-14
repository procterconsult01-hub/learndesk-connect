const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime = iso => new Date(iso).toLocaleString('en-NG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('en-NG', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
const today = () => new Date().toISOString().slice(0,10);
let me = JSON.parse(sessionStorage.getItem('ldc_me') || 'null');

const TABS = {
  admin:   [['notices','📢','Notices'],['fees','₦','Fees'],['reports','📄','Reports'],['calendar','📅','Calendar'],['more','☰','More']],
  teacher: [['notices','📢','Notices'],['chat','💬','Chat'],['register','✅','Register'],['calendar','📅','Calendar'],['more','☰','More']],
  parent:  [['notices','📢','Notices'],['chat','💬','Chat'],['fees','₦','Fees'],['child','🎓','My child'],['alerts','🔔','Alerts']],
};

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(()=>t.hidden=true, 2600); }
function scopeLabel(a) { return a.scope==='school' ? 'Whole school' : a.scope==='level' ? a.scope_value : DB.className(a.scope_value); }

function render() {
  document.body.classList.toggle('lowdata', DB.settings().lowData);
  if (!me) return renderLogin();
  const [route, arg] = (location.hash.slice(2) || 'notices').split('/');
  const tabs = TABS[me.role];
  const unread = DB.notifications(me.id).filter(n=>!n.read).length;
  $('#app').innerHTML = `
    <header class="top"><div><div class="brand">LearnDesk <b>Connect</b></div><div class="sub">${esc(DB.school().name)}</div></div>
      <button class="chip" id="whoami" title="Switch role">${esc(me.name.split(' (')[0])} · ${me.role}</button></header>
    <main id="view"></main>
    <nav class="tabs">${tabs.map(([r,i,l])=>`<a href="#/${r}" class="${r===route?'on':''}" data-tab="${r}"><span>${i}</span>${l}${r==='alerts'&&unread?`<i class="badge">${unread}</i>`:''}</a>`).join('')}</nav>`;
  $('#whoami').onclick = () => { me = null; sessionStorage.removeItem('ldc_me'); location.hash = ''; render(); };
  const v = $('#view');
  const fn = VIEWS[route] || VIEWS.notices;
  fn(v, arg);
}

function renderLogin() {
  const opts = role => DB.users(role).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  $('#app').innerHTML = `<main class="login">
    <div class="logo">LD</div><h1>LearnDesk <b>Connect</b></h1><p class="muted">School-to-parent messaging · ${esc(DB.school().name)}</p>
    <div class="card"><p class="demo">DEMO — no password. Pick a role to try the app. All data stays on this device.</p>
    <div class="roles">${['admin','teacher','parent'].map(r=>`<button class="role" data-role="${r}">${{admin:'🏫 Admin / Proprietor',teacher:'👩🏾‍🏫 Teacher',parent:'👨🏾‍👩🏾‍👧🏾 Parent'}[r]}</button>`).join('')}</div>
    <label>Sign in as<select id="who"></select></label>
    <button class="btn primary" id="go">Continue</button></div>
    <button class="link" id="reset">Reset demo data</button></main>`;
  let role = 'admin';
  const pick = r => { role = r; document.querySelectorAll('.role').forEach(b=>b.classList.toggle('on', b.dataset.role===r)); $('#who').innerHTML = opts(r); };
  document.querySelectorAll('.role').forEach(b => b.onclick = () => pick(b.dataset.role));
  pick('admin');
  $('#go').onclick = () => { me = DB.user($('#who').value); sessionStorage.setItem('ldc_me', JSON.stringify(me)); location.hash = '#/notices'; render(); };
  $('#reset').onclick = () => { if (confirm('Reset all demo data?')) { DB.reset(); toast('Demo data reset'); render(); } };
}

const VIEWS = {
  notices(v, id) {
    if (id) return VIEWS.notice(v, id);
    const list = DB.announcementsFor(me);
    const canPost = me.role !== 'parent';
    v.innerHTML = `<h2>${me.role==='parent'?'School notices':'Announcements'}</h2>
      ${canPost?`<details class="card" id="compose"><summary class="btn primary">+ New announcement</summary>
        <label>Send to<select id="scope"><option value="school|">Whole school</option>
        ${DB.LEVELS.map(l=>`<option value="level|${l}">All ${l}</option>`).join('')}
        ${DB.classes().map(c=>`<option value="class|${c.id}">${c.level}${c.arm} only</option>`).join('')}</select></label>
        <label>Title<input id="ttl" maxlength="80" placeholder="e.g. PTA meeting"></label>
        <label>Message<textarea id="bdy" rows="4" placeholder="Write your notice…"></textarea></label>
        <p class="muted small" id="aud"></p><button class="btn primary" id="post">Post</button></details>`:''}
      <div class="list">${list.map(a=>{
        const r = DB.receipts(a), unread = me.role==='parent' && !DB.isRead(a.id, me.id);
        return `<a class="card notice ${unread?'unread':''}" href="#/notices/${a.id}">
          <div class="row"><span class="tag">${esc(scopeLabel(a))}</span><span class="muted small">${fmtTime(a.created_at)}</span></div>
          <h3>${unread?'<i class="dot"></i>':''}${esc(a.title)}</h3><p class="clip">${esc(a.body)}</p>
          <div class="muted small">${esc(DB.user(a.author_id).name)}${me.role!=='parent'?` · <b class="seen">Seen by ${r.seen.length} of ${r.audience.length}</b>`:''}</div></a>`; }).join('') || '<p class="empty">No notices yet.</p>'}</div>`;
    if (canPost) {
      const upd = () => { const [s,val] = $('#scope').value.split('|'); $('#aud').textContent = `Reaches ${DB.parentsInScope(s,val).length} parent(s).`; };
      $('#scope').onchange = upd; upd();
      $('#post').onclick = () => {
        const [s,val] = $('#scope').value.split('|'); const t = $('#ttl').value.trim(), b = $('#bdy').value.trim();
        if (!t || !b) return toast('Add a title and message');
        DB.postAnnouncement(me.id, s, val, t, b); toast('Announcement posted'); render();
      };
    }
  },
  notice(v, id) {
    const a = DB.announcementsFor(me).find(a=>a.id===id); if (!a) { v.innerHTML = '<p class="empty">Not found.</p>'; return; }
    if (me.role==='parent') DB.markRead(a.id, me.id);
    const r = DB.receipts(a);
    v.innerHTML = `<a class="back" href="#/notices">‹ Notices</a><article class="card">
      <div class="row"><span class="tag">${esc(scopeLabel(a))}</span><span class="muted small">${fmtTime(a.created_at)}</span></div>
      <h2>${esc(a.title)}</h2><p class="pre">${esc(a.body)}</p><p class="muted small">From ${esc(DB.user(a.author_id).name)}</p></article>
      ${me.role!=='parent'?`<div class="card"><h3>Seen by ${r.seen.length} of ${r.audience.length}</h3>
        <div class="bar"><i style="width:${r.audience.length?Math.round(r.seen.length/r.audience.length*100):0}%"></i></div>
        <h4>✓ Seen</h4><ul class="plain">${r.seen.map(p=>`<li>${esc(DB.user(p).name)}</li>`).join('')||'<li class="muted">Nobody yet</li>'}</ul>
        <h4>Not seen yet</h4><ul class="plain">${r.unseen.map(p=>`<li>${esc(DB.user(p).name)}</li>`).join('')||'<li class="muted">Everyone has seen it 🎉</li>'}</ul>
        ${r.unseen.length?`<button class="btn" id="nudge">Nudge ${r.unseen.length} by SMS (demo)</button>`:''}</div>`:''}`;
    const n = $('#nudge'); if (n) n.onclick = () => toast('Demo: SMS fallback would go to '+r.unseen.length+' parent(s). No SMS sent.');
  },
  chat(v, id) {
    if (id) return VIEWS.thread(v, id);
    const ths = DB.threadsFor(me);
    let starter = '';
    if (me.role==='parent') {
      const kids = DB.childrenOf(me.id);
      starter = `<details class="card"><summary class="btn primary">+ Message a teacher</summary>
        <label>About<select id="kid">${kids.map(k=>`<option value="${k.id}">${esc(k.name)} (${DB.className(k.class_id)})</option>`).join('')}</select></label>
        <label>Teacher<select id="tch">${DB.users('teacher').map(t=>`<option value="${t.id}">${esc(t.name)} — ${esc(t.subject)}</option>`).join('')}</select></label>
        <button class="btn primary" id="start">Open chat</button></details>`;
    } else {
      starter = `<details class="card"><summary class="btn primary">+ Message a parent</summary>
        <label>Student<select id="kid">${DB.students().map(k=>`<option value="${k.id}">${esc(k.name)} (${DB.className(k.class_id)}) — ${esc(DB.user(k.parent_id).name)}</option>`).join('')}</select></label>
        <button class="btn primary" id="start">Open chat</button></details>`;
    }
    v.innerHTML = `<h2>Chats</h2><p class="muted small">🔒 Phone numbers are never shared.</p>${starter}
      <div class="list">${ths.map(t=>{ const other = DB.user(me.role==='parent'?t.teacher_id:t.parent_id); const last = DB.messages(t.id).slice(-1)[0];
        return `<a class="card" href="#/chat/${t.id}"><div class="row"><b>${esc(other.name)}</b><span class="muted small">${last?fmtTime(last.created_at):''}</span></div>
        <div class="muted small">Re: ${esc(DB.student(t.student_id).name)}</div><p class="clip">${esc(last?last.body:'No messages yet')}</p></a>`; }).join('') || '<p class="empty">No chats yet.</p>'}</div>`;
    $('#start').onclick = () => {
      const s = DB.student($('#kid').value);
      const t = me.role==='parent' ? DB.getOrCreateThread($('#tch').value, me.id, s.id) : DB.getOrCreateThread(me.id, s.parent_id, s.id);
      location.hash = '#/chat/'+t.id;
    };
  },
  thread(v, id) {
    const t = DB.thread(id); if (!t || (t.parent_id!==me.id && t.teacher_id!==me.id)) { v.innerHTML='<p class="empty">Not found.</p>'; return; }
    const teacher = DB.user(t.teacher_id), other = DB.user(me.role==='parent'?t.teacher_id:t.parent_id);
    const open = DB.inOfficeHours(t.teacher_id);
    v.innerHTML = `<a class="back" href="#/chat">‹ Chats</a><div class="card chathead"><b>${esc(other.name)}</b><div class="muted small">Re: ${esc(DB.student(t.student_id).name)} · Office hours ${teacher.office_start}–${teacher.office_end}, Mon–Fri</div></div>
      ${me.role==='parent'&&!open?`<div class="notice-banner">🌙 Outside office hours. ${esc(teacher.name)} will see your message from ${teacher.office_start} on the next school day.</div>`:''}
      <div class="msgs" id="msgs">${DB.messages(id).map(m=>`<div class="msg ${m.sender_id===me.id?'mine':''}">${esc(m.body)}<span>${fmtTime(m.created_at)}${m.queued?' · queued (after hours)':''}</span></div>`).join('')||'<p class="empty">Say hello 👋</p>'}</div>
      <form class="composer" id="cf"><input id="msg" placeholder="Type a message" autocomplete="off"><button class="btn primary">Send</button></form>`;
    const m = $('#msgs'); m.scrollTop = m.scrollHeight;
    $('#cf').onsubmit = e => { e.preventDefault(); const b = $('#msg').value.trim(); if (!b) return; const r = DB.sendMessage(id, me.id, b); if (r.queued) toast('Sent — queued until office hours'); render(); };
  },
  fees(v) {
    if (me.role==='parent') {
      v.innerHTML = `<h2>School fees</h2><p class="muted small">${DB.TERM}</p>` + DB.childrenOf(me.id).map(k=>{ const f = DB.feeFor(k.id), bal = f.amount-f.paid;
        return `<div class="card"><div class="row"><b>${esc(k.name)}</b><span class="tag">${DB.className(k.class_id)}</span></div>
          <div class="kv"><span>Term fee</span><b>${naira(f.amount)}</b><span>Paid</span><b>${naira(f.paid)}</b><span>Balance</span><b class="${bal?'due':'ok'}">${naira(bal)}</b></div>
          ${bal?`<a class="btn primary pay" href="${DB.paystackLink(k.id)}" target="_blank" rel="noopener" data-sid="${k.id}">Pay ${naira(bal)} now</a>
          <p class="demo small">DEMO: placeholder Paystack link — no real payment is taken.</p>
          <button class="link sim" data-sid="${k.id}">Simulate successful payment (demo)</button>`:'<p class="ok">✓ Fully paid. Thank you!</p>'}</div>`; }).join('');
      v.querySelectorAll('.sim').forEach(b=>b.onclick=()=>{ const f=DB.feeFor(b.dataset.sid); DB.recordPayment(b.dataset.sid, f.amount-f.paid); toast('Demo payment recorded'); render(); });
      return;
    }
    const fees = DB.fees(); const tot = fees.reduce((a,f)=>a+f.amount,0), paid = fees.reduce((a,f)=>a+f.paid,0);
    v.innerHTML = `<h2>Fees</h2><p class="muted small">${DB.TERM}</p>
      <div class="stats"><div><b>${naira(paid)}</b><span>collected</span></div><div><b class="due">${naira(tot-paid)}</b><span>outstanding</span></div><div><b>${fees.filter(f=>f.paid>=f.amount).length}/${fees.length}</b><span>fully paid</span></div></div>
      <div class="row"><select id="ff"><option value="all">All students</option><option value="unpaid">Owing only</option><option value="paid">Paid only</option></select>
      <button class="btn" id="remindAll">Remind all owing</button></div>
      <div class="list" id="fl"></div>`;
    const draw = () => { const flt = $('#ff').value;
      $('#fl').innerHTML = fees.filter(f=> flt==='all' || (flt==='paid') === (f.paid>=f.amount)).map(f=>{ const s = DB.student(f.student_id), bal=f.amount-f.paid;
        return `<div class="card fee"><div class="row"><b>${esc(s.name)}</b><span class="tag ${bal?'due':'ok'}">${bal?(f.paid?'Part-paid':'Unpaid'):'Paid'}</span></div>
        <div class="muted small">${DB.className(s.class_id)} · Parent: ${esc(DB.user(s.parent_id).name)}</div>
        <div class="row"><label class="inline">Term fee ₦<input type="number" min="0" step="500" value="${f.amount}" data-sid="${s.id}" class="amt"></label><span>Balance <b class="${bal?'due':'ok'}">${naira(bal)}</b></span></div>
        ${bal?`<button class="btn small rem" data-sid="${s.id}">Send reminder</button>${f.last_reminder_at?` <span class="muted small">Last reminded ${fmtTime(f.last_reminder_at)}</span>`:''}`:''}</div>`; }).join('');
      v.querySelectorAll('.amt').forEach(i=>i.onchange=()=>{ DB.setFee(i.dataset.sid, +i.value); toast('Fee updated'); render(); });
      v.querySelectorAll('.rem').forEach(b=>b.onclick=()=>{ DB.sendReminder(b.dataset.sid); toast('Reminder sent to parent'); render(); });
    };
    $('#ff').onchange = draw; draw();
    $('#remindAll').onclick = () => { const owing = fees.filter(f=>f.paid<f.amount); owing.forEach(f=>DB.sendReminder(f.student_id)); toast(`Reminders sent to ${owing.length} parent(s)`); render(); };
  },
  register(v) {
    const cls = DB.classes().filter(c=>DB.students().some(s=>s.class_id===c.id));
    const sel = sessionStorage.getItem('ldc_cls') || 'ss2b';
    const date = sessionStorage.getItem('ldc_date') || today();
    const studs = DB.students().filter(s=>s.class_id===sel), ex = DB.attendance(date);
    v.innerHTML = `<h2>Class register</h2><div class="row"><select id="cls">${cls.map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${c.level}${c.arm}</option>`).join('')}</select><input type="date" id="dt" value="${date}"></div>
      <div class="list">${studs.map(s=>{ const st = (ex.find(a=>a.student_id===s.id)||{}).status||'present';
        return `<div class="card att"><b>${esc(s.name)}</b><div class="seg" data-sid="${s.id}">${['present','late','absent'].map(o=>`<button class="${o===st?'on '+o:''}" data-v="${o}">${o[0].toUpperCase()+o.slice(1)}</button>`).join('')}</div></div>`; }).join('')}</div>
      <button class="btn primary" id="saveAtt">Save register</button><p class="muted small">Absent students' parents get an instant alert.</p>`;
    $('#cls').onchange = e => { sessionStorage.setItem('ldc_cls', e.target.value); render(); };
    $('#dt').onchange = e => { sessionStorage.setItem('ldc_date', e.target.value); render(); };
    v.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ b.parentNode.querySelectorAll('button').forEach(x=>x.className=''); b.className='on '+b.dataset.v; });
    $('#saveAtt').onclick = () => { const recs = [...v.querySelectorAll('.seg')].map(s=>({ student_id:s.dataset.sid, status:s.querySelector('.on').dataset.v }));
      const n = DB.markAttendance(date, recs, me.id); toast(`Register saved${n?` · ${n} absence alert(s) sent`:''}`); };
  },
  calendar(v) {
    const ev = DB.events(), t = today();
    v.innerHTML = `<h2>Events calendar</h2>${me.role==='admin'?`<details class="card"><summary class="btn primary">+ Add event</summary>
      <label>Date<input type="date" id="ed" value="${t}"></label><label>Title<input id="et" placeholder="e.g. Cultural day"></label>
      <label>Type<select id="ek">${['PTA','Exams','Midterm','Sports','Resumption','Holiday','Other'].map(k=>`<option>${k}</option>`).join('')}</select></label><button class="btn primary" id="addEv">Add</button></details>`:''}
      <div class="list">${ev.map(e=>`<div class="card ev ${e.date<t?'past':''}"><div class="date"><b>${new Date(e.date+'T00:00:00').getDate()}</b><span>${new Date(e.date+'T00:00:00').toLocaleDateString('en-NG',{month:'short'})}</span></div>
        <div><b>${esc(e.title)}</b><div class="muted small">${fmtDate(e.date)} · <span class="tag">${esc(e.kind)}</span></div></div></div>`).join('')}</div>`;
    const b = $('#addEv'); if (b) b.onclick = () => { const ti = $('#et').value.trim(); if (!ti) return toast('Add a title'); DB.addEvent($('#ed').value, ti, $('#ek').value); toast('Event added'); render(); };
  },
  reports(v) {
    v.innerHTML = `<h2>Report cards</h2><p class="muted small">${DB.TERM} · Upload one PDF per student (demo limit ~1 MB; stored on this device).</p>
      <div class="list">${DB.students().map(s=>{ const r = DB.reportFor(s.id)[0];
        return `<div class="card"><div class="row"><b>${esc(s.name)}</b><span class="tag">${DB.className(s.class_id)}</span></div>
        <div class="muted small">${r?`✓ ${esc(r.name)} · ${fmtTime(r.created_at)}`:'No report uploaded'}</div>
        <label class="btn small file">${r?'Replace PDF':'Upload PDF'}<input type="file" accept="application/pdf" data-sid="${s.id}" hidden></label></div>`; }).join('')}</div>`;
    v.querySelectorAll('input[type=file]').forEach(i=>i.onchange=()=>{ const f = i.files[0]; if (!f) return;
      if (f.type!=='application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return toast('Please choose a PDF');
      if (f.size > 1.2e6) return toast('PDF too large for the demo (max ~1 MB)');
      const rd = new FileReader(); rd.onload = () => { if (DB.uploadReport(i.dataset.sid, f.name, rd.result)) { toast('Report uploaded · parent notified'); render(); } }; rd.readAsDataURL(f); });
  },
  child(v) {
    v.innerHTML = `<h2>My children</h2>` + DB.childrenOf(me.id).map(k=>{ const r = DB.reportFor(k.id)[0]; const f = DB.feeFor(k.id);
      const abs = DB.absences(k.id);
      return `<div class="card"><div class="row"><b>${esc(k.name)}</b><span class="tag">${DB.className(k.class_id)}</span></div>
        <div class="kv"><span>Fees balance</span><b class="${f.amount-f.paid?'due':'ok'}">${naira(f.amount-f.paid)}</b><span>Days absent this term</span><b>${abs}</b></div>
        <h4>Report card · ${DB.TERM}</h4>${r?`<div class="row"><a class="btn" href="${r.dataUrl}" target="_blank" rel="noopener">View</a><a class="btn primary" href="${r.dataUrl}" download="${esc(r.name)}">Download PDF</a></div>`:'<p class="muted small">Not yet released.</p>'}</div>`; }).join('')
      + `<a class="btn" href="#/calendar">📅 School calendar</a>`;
  },
  alerts(v) {
    const ns = DB.notifications(me.id);
    v.innerHTML = `<h2>Alerts</h2><div class="list">${ns.map(n=>`<div class="card alert ${n.kind} ${n.read?'':'unread'}"><div class="row"><b>${{absence:'⚠️',fee:'₦',announcement:'📢',chat:'💬',report:'📄'}[n.kind]||'🔔'} ${esc(n.title)}</b><span class="muted small">${fmtTime(n.created_at)}</span></div><p>${esc(n.body)}</p></div>`).join('')||'<p class="empty">No alerts yet.</p>'}</div>`;
    DB.markNotificationsRead(me.id);
    const b = document.querySelector('[data-tab=alerts] .badge'); if (b) b.remove();
  },
  more(v) {
    const t = me.role==='teacher' ? DB.users('teacher').find(u=>u.id===me.id) : null;
    v.innerHTML = `<h2>Settings</h2>
      ${t?`<div class="card"><h3>Office hours</h3><p class="muted small">Parents messaging outside these hours see a notice and their message is queued.</p>
        <div class="row"><label class="inline">From<input type="time" id="os" value="${t.office_start}"></label><label class="inline">To<input type="time" id="oe" value="${t.office_end}"></label></div>
        <button class="btn primary" id="saveOh">Save</button></div>`:''}
      <div class="card"><label class="inline"><input type="checkbox" id="ld" ${DB.settings().lowData?'checked':''}> Low-data mode (text only, no animations)</label></div>
      ${me.role!=='parent'?`<a class="card" href="#/calendar">📅 Events calendar</a>`:''}${me.role==='teacher'?'':''}
      <div class="card"><h3>Alerts</h3><a href="#/alerts">View my alerts</a></div>
      <div class="card small muted">LearnDesk Connect v1 prototype · demo data stored only on this device.</div>`;
    const s = $('#saveOh'); if (s) s.onclick = () => { if ($('#os').value >= $('#oe').value) return toast('End must be after start'); DB.setOfficeHours(me.id, $('#os').value, $('#oe').value); toast('Office hours saved'); };
    $('#ld').onchange = e => { DB.setLowData(e.target.checked); render(); };
  },
};

window.addEventListener('hashchange', render);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
