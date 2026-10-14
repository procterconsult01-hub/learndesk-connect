// LearnDesk Connect — thin data layer (device-local demo).
// Everything goes through `DB`. To move to Supabase, replace the bodies of these
// functions with supabase-js calls; the UI only uses this module.
//
// TODO(Supabase) tables:
//  schools(id, name, city)
//  classes(id, school_id, level, arm)                        -- level: 'JSS 1'..'SS 3', arm: 'A'|'B'
//  users(id, school_id, role, name, phone, office_start, office_end)  -- role: admin|teacher|parent; phone NEVER selected for other users (RLS / view)
//  students(id, school_id, class_id, name, parent_id)        -- (needed for fees/attendance/reports)
//  announcements(id, school_id, author_id, scope, scope_value, title, body, created_at)  -- scope: school|level|class
//  reads(announcement_id, user_id, read_at)                  -- PK(announcement_id,user_id)
//  threads(id, school_id, teacher_id, parent_id, student_id)
//  messages(id, thread_id, sender_id, body, created_at, queued bool)
//  fees(id, student_id, term, amount, paid, paid_at, last_reminder_at)  -- paid via Paystack webhook
//  attendance(id, student_id, date, status, marked_by)
//  notifications(id, user_id, kind, title, body, created_at, read)
//  events(id, school_id, date, title, kind)
//  report_cards(id, student_id, term, file_path)             -- Supabase Storage bucket 'reports'
// RLS: every row scoped by school_id; parents only see rows for their own students.

const KEY = 'ldc_v1';
const TERM = '2026/2027 First Term';
const LEVELS = ['JSS 1','JSS 2','JSS 3','SS 1','SS 2','SS 3'];
const uid = p => p + '_' + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

function seed() {
  const school = { id: 'sch1', name: 'LearnDesk Academy Owerri', city: 'Owerri, Imo' };
  const classes = [];
  LEVELS.forEach(l => ['A','B'].forEach(a => classes.push({ id: (l+a).replace(' ','').toLowerCase(), school_id:'sch1', level:l, arm:a })));
  const users = [
    { id:'u_admin', role:'admin', name:'Mrs. Ngozi Okafor (Proprietor)', phone:'08030000001' },
    { id:'u_t1', role:'teacher', name:'Mr. Chidi Eze', subject:'Mathematics · Form master SS 2B', phone:'08030000011', office_start:'08:00', office_end:'16:00' },
    { id:'u_t2', role:'teacher', name:'Mrs. Amaka Nwosu', subject:'English · Form mistress JSS 1A', phone:'08030000012', office_start:'09:00', office_end:'15:00' },
    { id:'u_t3', role:'teacher', name:'Mr. Tunde Bello', subject:'Basic Science · JSS 2', phone:'08030000013', office_start:'08:00', office_end:'14:00' },
  ];
  const parentNames = ['Mr. Emeka Obi','Mrs. Chioma Uche','Mr. Ifeanyi Okeke','Mrs. Blessing Ibe','Mr. Kelechi Nnaji','Mrs. Adaeze Onu','Mr. Obinna Ani','Mrs. Funke Adeyemi'];
  parentNames.forEach((n,i)=>users.push({ id:'u_p'+(i+1), role:'parent', name:n, phone:'0803100000'+i }));
  const st = [
    ['Chinedu Obi','jss1a','u_p1'],['Adaora Obi','ss2b','u_p1'],['Tobenna Uche','jss1a','u_p2'],
    ['Ebuka Okeke','jss2a','u_p3'],['Nneka Ibe','ss2b','u_p4'],['Somto Nnaji','jss3b','u_p5'],
    ['Ugochi Onu','ss1a','u_p6'],['Kamsi Ani','ss2b','u_p7'],['Tolu Adeyemi','jss2a','u_p8'],['Ifunanya Uche','ss3a','u_p2'],
  ];
  const students = st.map((s,i)=>({ id:'s'+(i+1), school_id:'sch1', name:s[0], class_id:s[1], parent_id:s[2] }));
  const fees = students.map((s,i)=>({ id:'f'+(i+1), student_id:s.id, term:TERM, amount: s.class_id.startsWith('ss') ? 185000 : 150000, paid: i%3===0 ? (s.class_id.startsWith('ss')?185000:150000) : (i%3===1 ? 50000 : 0), last_reminder_at:null }));
  const d = (off) => { const x = new Date(); x.setDate(x.getDate()+off); return x.toISOString().slice(0,10); };
  const events = [
    { id:'e1', date:d(3), title:'PTA General Meeting, 10am, School Hall', kind:'PTA' },
    { id:'e2', date:d(10), title:'Mid-term break begins', kind:'Midterm' },
    { id:'e3', date:d(17), title:'Inter-house sports, Dan Anyiam Stadium', kind:'Sports' },
    { id:'e4', date:d(45), title:'First term examinations begin', kind:'Exams' },
    { id:'e5', date:d(-20), title:'Resumption, First Term', kind:'Resumption' },
  ];
  const ago = h => new Date(Date.now()-h*3600e3).toISOString();
  const announcements = [
    { id:'a1', author_id:'u_admin', scope:'school', scope_value:'', title:'PTA meeting this week', body:'All parents are invited to the PTA General Meeting on '+d(3)+' at 10am in the School Hall. Agenda: security, sports levy, 2nd term calendar.', created_at:ago(30) },
    { id:'a2', author_id:'u_t1', scope:'class', scope_value:'ss2b', title:'SS 2B: Maths assignment', body:'Exercise 4.3, Nos. 1–10 (New General Mathematics). Due Monday.', created_at:ago(6) },
    { id:'a3', author_id:'u_t2', scope:'level', scope_value:'JSS 1', title:'JSS 1 reading club', body:'Reading club starts Friday after school. Kindly send each child with one storybook.', created_at:ago(2) },
  ];
  const reads = [{announcement_id:'a1',user_id:'u_p1',read_at:ago(20)},{announcement_id:'a1',user_id:'u_p3',read_at:ago(10)},{announcement_id:'a1',user_id:'u_p6',read_at:ago(5)},{announcement_id:'a2',user_id:'u_p4',read_at:ago(3)}];
  const threads = [{ id:'th1', teacher_id:'u_t1', parent_id:'u_p1', student_id:'s2' }];
  const messages = [
    { id:'m1', thread_id:'th1', sender_id:'u_p1', body:'Good afternoon sir. How is Adaora doing in Maths this term?', created_at:ago(26), queued:false },
    { id:'m2', thread_id:'th1', sender_id:'u_t1', body:'Good afternoon. She is improving, but needs to practise quadratic equations at home.', created_at:ago(25), queued:false },
  ];
  return { school, classes, users, students, fees, events, announcements, reads, threads, messages, attendance:[], notifications:[], report_cards:[], settings:{ lowData:false } };
}

let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.school) return s; } catch(e){} const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch(e) { alert('Storage full on this device. Try a smaller PDF.'); return false; } }

const className = id => { const c = S.classes.find(c=>c.id===id); return c ? c.level+c.arm : id; };

const DB = {
  TERM, LEVELS, className,
  reset() { localStorage.removeItem(KEY); S = load(); },
  school: () => S.school,
  classes: () => S.classes,
  // Public profile only — phone is never exposed to the UI (mirror with a Supabase view).
  user(id) { const u = S.users.find(u=>u.id===id); if (!u) return null; const { phone, ...pub } = u; return pub; },
  users: role => S.users.filter(u=>!role||u.role===role).map(u=>DB.user(u.id)),
  students: () => S.students,
  student: id => S.students.find(s=>s.id===id),
  childrenOf: pid => S.students.filter(s=>s.parent_id===pid),
  parentsInScope(scope, val) {
    const st = S.students.filter(s => scope==='school' || (scope==='level' && S.classes.find(c=>c.id===s.class_id).level===val) || (scope==='class' && s.class_id===val));
    return [...new Set(st.map(s=>s.parent_id))];
  },
  // Announcements
  announcementsFor(user) {
    let list = S.announcements;
    if (user.role==='parent') { list = list.filter(a => DB.parentsInScope(a.scope,a.scope_value).includes(user.id)); }
    return [...list].sort((a,b)=>b.created_at.localeCompare(a.created_at));
  },
  postAnnouncement(author_id, scope, scope_value, title, body) {
    const a = { id:uid('a'), author_id, scope, scope_value, title, body, created_at:now() };
    S.announcements.push(a);
    DB.parentsInScope(scope, scope_value).forEach(p => DB.notify(p, 'announcement', 'New notice: '+title, body.slice(0,90)));
    save(); return a;
  },
  markRead(aid, user_id) { if (!S.reads.find(r=>r.announcement_id===aid&&r.user_id===user_id)) { S.reads.push({announcement_id:aid,user_id,read_at:now()}); save(); } },
  isRead: (aid, user_id) => !!S.reads.find(r=>r.announcement_id===aid&&r.user_id===user_id),
  receipts(a) { const aud = DB.parentsInScope(a.scope,a.scope_value); const seen = aud.filter(p=>DB.isRead(a.id,p)); return { audience:aud, seen, unseen: aud.filter(p=>!seen.includes(p)) }; },
  // Chat
  threadsFor(user) { return S.threads.filter(t => t.teacher_id===user.id || t.parent_id===user.id); },
  thread: id => S.threads.find(t=>t.id===id),
  getOrCreateThread(teacher_id, parent_id, student_id) {
    let t = S.threads.find(t=>t.teacher_id===teacher_id&&t.parent_id===parent_id&&t.student_id===student_id);
    if (!t) { t = { id:uid('th'), teacher_id, parent_id, student_id }; S.threads.push(t); save(); }
    return t;
  },
  messages: tid => S.messages.filter(m=>m.thread_id===tid).sort((a,b)=>a.created_at.localeCompare(b.created_at)),
  inOfficeHours(teacher_id, d = new Date()) {
    const t = S.users.find(u=>u.id===teacher_id); if (!t || !t.office_start) return true;
    const day = d.getDay(); if (day===0 || day===6) return false;
    const hm = d.toTimeString().slice(0,5); return hm >= t.office_start && hm < t.office_end;
  },
  sendMessage(tid, sender_id, body) {
    const t = DB.thread(tid); const toParent = sender_id===t.teacher_id;
    const queued = !toParent && !DB.inOfficeHours(t.teacher_id);
    const m = { id:uid('m'), thread_id:tid, sender_id, body, created_at:now(), queued };
    S.messages.push(m);
    if (toParent) DB.notify(t.parent_id, 'chat', 'Message from '+DB.user(sender_id).name, body.slice(0,90));
    save(); return m;
  },
  setOfficeHours(tid, start, end) { const u = S.users.find(u=>u.id===tid); u.office_start=start; u.office_end=end; save(); },
  // Fees
  fees: () => S.fees,
  feeFor: sid => S.fees.find(f=>f.student_id===sid),
  setFee(sid, amount) { const f = DB.feeFor(sid); f.amount = Math.max(0, Math.round(amount)); save(); },
  recordPayment(sid, amount) { const f = DB.feeFor(sid); f.paid = Math.min(f.amount, f.paid + amount); save(); }, // TODO(Supabase): only via Paystack webhook
  sendReminder(sid) {
    const f = DB.feeFor(sid), s = DB.student(sid); f.last_reminder_at = now();
    DB.notify(s.parent_id, 'fee', 'School fees reminder', `${s.name}: outstanding balance ${naira(f.amount-f.paid)} for ${TERM}.`);
    save();
  },
  // TODO: create a real Paystack payment link / transaction via an Edge Function.
  paystackLink: sid => 'https://paystack.com/pay/DEMO-learndesk-' + sid,
  // Attendance
  attendance: (date) => S.attendance.filter(a=>a.date===date),
  absences: sid => S.attendance.filter(a=>a.student_id===sid&&a.status==='absent').length,
  markAttendance(date, records, by) {
    let alerts = 0;
    records.forEach(({student_id,status}) => {
      const ex = S.attendance.find(a=>a.date===date&&a.student_id===student_id);
      const wasAbsent = ex && ex.status==='absent';
      if (ex) ex.status = status; else S.attendance.push({ id:uid('at'), student_id, date, status, marked_by:by });
      if (status==='absent' && !wasAbsent) { const s = DB.student(student_id); DB.notify(s.parent_id,'absence','Absence alert',`${s.name} (${className(s.class_id)}) was marked ABSENT on ${date}. Please contact the school.`); alerts++; }
    });
    save(); return alerts;
  },
  // Notifications (TODO: FCM push + Termii SMS fallback for critical kinds)
  notify(user_id, kind, title, body) { S.notifications.push({ id:uid('n'), user_id, kind, title, body, created_at:now(), read:false }); },
  notifications: uid_ => S.notifications.filter(n=>n.user_id===uid_).sort((a,b)=>b.created_at.localeCompare(a.created_at)),
  markNotificationsRead(uid_) { S.notifications.forEach(n=>{ if(n.user_id===uid_) n.read=true; }); save(); },
  // Events
  events: () => [...S.events].sort((a,b)=>a.date.localeCompare(b.date)),
  addEvent(date, title, kind) { S.events.push({ id:uid('e'), date, title, kind }); save(); },
  // Report cards (demo: PDF stored as data URL in localStorage; TODO: Supabase Storage)
  reportFor: sid => S.report_cards.filter(r=>r.student_id===sid),
  uploadReport(sid, name, dataUrl) {
    S.report_cards = S.report_cards.filter(r=>!(r.student_id===sid&&r.term===TERM));
    S.report_cards.push({ id:uid('rc'), student_id:sid, term:TERM, name, dataUrl, created_at:now() });
    if (!save()) { S.report_cards.pop(); return false; }
    DB.notify(DB.student(sid).parent_id,'report','Report card available',`${DB.student(sid).name}'s ${TERM} report card is ready.`); save(); return true;
  },
  settings: () => S.settings,
  setLowData(v) { S.settings.lowData = v; save(); },
};
function naira(n) { return '₦' + Number(n||0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }
window.DB = DB; window.naira = naira;
