/* ═══════════════════════════════════════════
   NEXORAPILOT — SHARED DATA STORE
   Key prefix: np_   (all localStorage keys)
═══════════════════════════════════════════ */

const Store = {
  KEY: 'np_data',
  PASS_KEY: 'np_pass',
  AUTH_KEY: 'np_admin_auth',
  PROF_KEY: 'np_profile',

  /* ── core ── */
  _g: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  _s: (k, v) => localStorage.setItem(k, JSON.stringify(v)),

  data()    { return this._g(this.KEY) || {}; },
  save(d)   { this._s(this.KEY, d); },

  /* ── admin auth ── */
  getPass()      { return this._g(this.PASS_KEY) || 'admin123'; },
  setPass(p)     { this._s(this.PASS_KEY, p); },
  isAdmin()      { return this._g(this.AUTH_KEY) === true; },
  loginAdmin()   { this._s(this.AUTH_KEY, true); },
  logoutAdmin()  { localStorage.removeItem(this.AUTH_KEY); },

  /* ── user profile (local device) ── */
  profile()      { return this._g(this.PROF_KEY) || {}; },
  saveProfile(p) { this._s(this.PROF_KEY, p); },

  /* ── products ── */
  products()  { return this.data().products || []; },
  saveProds(p){ const d = this.data(); d.products = p; this.save(d); },
  addProd(p) {
    const prods = this.products();
    if (!p.key) p.key = (p.cat || 'x')[0] + Date.now();
    prods.push(p); this.saveProds(prods); return p;
  },
  editProd(key, upd) {
    const prods = this.products();
    const i = prods.findIndex(p => p.key === key);
    if (i > -1) { prods[i] = { ...prods[i], ...upd }; this.saveProds(prods); }
  },
  deleteProd(key) { this.saveProds(this.products().filter(p => p.key !== key)); },

  /* ── notes ── */
  notes()           { return this.data().notes || {}; },
  setNote(key, txt) {
    const d = this.data(); if (!d.notes) d.notes = {};
    if (txt) d.notes[key] = txt; else delete d.notes[key];
    this.save(d);
  },
  getNote(key)      { return this.notes()[key] || ''; },

  /* ── payment numbers ── */
  payNums()       { return this.data().payNums || []; },
  savePayNums(p)  { const d = this.data(); d.payNums = p; this.save(d); },
  addPayNum(n)    { const nums = this.payNums(); n.id = 'pn' + Date.now(); nums.push(n); this.savePayNums(nums); return n; },
  deletePayNum(id){ this.savePayNums(this.payNums().filter(n => n.id !== id)); },
  togglePayNum(id){ const nums = this.payNums(); const n = nums.find(x => x.id === id); if (n) { n.active = !n.active; this.savePayNums(nums); } },

  /* ── pending payments ── */
  pending()       { return this.data().pending || []; },
  addPending(p)   {
    const d = this.data(); if (!d.pending) d.pending = [];
    p.id = 'p' + Date.now(); p.time = new Date().toLocaleString('bn-BD'); p.status = 'pending';
    d.pending.unshift(p); this.save(d); return p;
  },
  approve(id) {
    const d = this.data();
    const i = (d.pending || []).findIndex(p => p.id === id);
    if (i < 0) return;
    const p = d.pending[i]; d.pending.splice(i, 1);
    if (!d.subs) d.subs = [];
    const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
    const sub = {
      id: 's' + Date.now(), phone: p.phone, trx: p.trx,
      amount: p.amount, method: p.method,
      start: new Date().toLocaleDateString('bn-BD'),
      expiry: exp.toLocaleDateString('bn-BD'), status: 'active'
    };
    d.subs.unshift(sub); this.save(d); return sub;
  },
  reject(id) { const d = this.data(); d.pending = (d.pending || []).filter(p => p.id !== id); this.save(d); },

  /* ── subscribers ── */
  subs()         { return this.data().subs || []; },
  addSub(s)      { const d = this.data(); if (!d.subs) d.subs = []; s.id = 's' + Date.now(); d.subs.unshift(s); this.save(d); return s; },
  toggleSub(id)  { const d = this.data(); const s = (d.subs || []).find(x => x.id === id); if (s) { s.status = s.status === 'active' ? 'expired' : 'active'; this.save(d); } },
  isPro(phone)   { if (!phone) return false; return !!(this.subs().find(s => s.phone === phone && s.status === 'active')); },

  /* ── banners ── */
  banners()      { return this.data().banners || []; },
  saveBanners(b) { const d = this.data(); d.banners = b; this.save(d); },

  /* ── messages / support chat ── */
  messages()         { return this.data().messages || []; },
  addMessage(m)      { const d = this.data(); if (!d.messages) d.messages = []; m.id = 'm' + Date.now(); m.ts = new Date().toLocaleString('bn-BD'); d.messages.push(m); this.save(d); return m; },
  userMsgs(uid)      { return this.messages().filter(m => m.uid === uid || m.replyTo === uid); },
  markSeen(uid)      { const d = this.data(); (d.messages || []).forEach(m => { if (m.uid === uid && !m.replyTo) m.seen = true; }); this.save(d); },
  unreadCount()      { return this.messages().filter(m => !m.replyTo && !m.seen).length; },
  conversations()    {
    const users = {}; this.messages().forEach(m => {
      if (!m.replyTo && m.uid) { if (!users[m.uid]) users[m.uid] = { uid: m.uid, name: m.uname || m.uid, msgs: [] }; users[m.uid].msgs.push(m); }
    }); return Object.values(users);
  },

  /* ── settings ── */
  pricing()      { return this.data().pricing  || { price: 199, sym: '৳', btnText: '⚡ Upgrade করুন', inst: '' }; },
  savePricing(p) { const d = this.data(); d.pricing = p; this.save(d); },
  general()      { return this.data().general  || { siteName: 'NexoraPilot', wa: '01712-345678', freeFrom: 11, freeTo: 20 }; },
  saveGeneral(g) { const d = this.data(); d.general = g; this.save(d); },
  gemini()       { return this.data().gemini   || { key: '', model: 'gemini-1.5-flash', lang: 'bn', prompt: '' }; },
  saveGemini(g)  { const d = this.data(); d.gemini = g; this.save(d); },

  /* ── stats ── */
  stats() {
    return {
      subs:     this.subs().length,
      active:   this.subs().filter(s => s.status === 'active').length,
      revenue:  this.subs().length * (this.pricing().price || 199),
      pending:  this.pending().length,
      products: this.products().length,
      unread:   this.unreadCount(),
    };
  },

  /* ── first-run defaults ── */
  init() {
    const d = this.data(); let changed = false;
    if (!d.products) { d.products = DEFAULT_PRODUCTS; changed = true; }
    if (!d.payNums)  { d.payNums  = [{ id: 'pn0', method: 'বিকাশ', num: '01712-345678', label: 'NexoraPilot Official', active: true }]; changed = true; }
    if (!d.pending)  { d.pending  = []; changed = true; }
    if (!d.subs)     { d.subs     = []; changed = true; }
    if (!d.notes)    { d.notes    = {}; changed = true; }
    if (!d.banners)  { d.banners  = []; changed = true; }
    if (!d.messages) { d.messages = []; changed = true; }
    if (!d.pricing)  { d.pricing  = { price: 199, sym: '৳', btnText: '⚡ মাত্র ৳199/মাস', inst: 'উপরের বিকাশ নম্বরে ৳199 Send Money করুন। TrxID কপি করে নিচে দিন। ২৪ ঘণ্টায় Activate হবে।' }; changed = true; }
    if (!d.general)  { d.general  = { siteName: 'NexoraPilot', wa: '01712-345678', freeFrom: 11, freeTo: 20 }; changed = true; }
    if (!d.gemini)   { d.gemini   = { key: '', model: 'gemini-1.5-flash', lang: 'bn', prompt: 'আপনি একজন expert ecommerce ad copywriter। দেওয়া product-এর জন্য viral content তৈরি করুন।' }; changed = true; }
    if (changed) this.save(d);
  }
};

/* ══════════════════════════════
   DEFAULT SAMPLE PRODUCTS
══════════════════════════════ */
const DEFAULT_PRODUCTS = [
  { key:'e1', cat:'electronics', rank:1,  name:'Bone Conduction Headphones', niche:'Electronics · Audio',   img:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', demand:98, comp:34, profit:62, sales:'৳7.2L/mo', tiktok:'↑340%', price:'৳2500-3000', where:'Alibaba, AliExpress', badges:['HOT','TikTok'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'e2', cat:'electronics', rank:2,  name:'Mini WiFi Projector',         niche:'Electronics · Display', img:'https://images.unsplash.com/photo-1478860409698-8707f313ee8b?w=400', demand:94, comp:41, profit:58, sales:'৳5.8L/mo', tiktok:'↑280%', price:'৳4500-5500', where:'Alibaba', badges:['VIRAL'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'e3', cat:'electronics', rank:3,  name:'LED Mechanical Keyboard',     niche:'Electronics · PC',      img:'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', demand:91, comp:55, profit:52, sales:'৳4.7L/mo', tiktok:'↑210%', price:'৳1800-2500', where:'Alibaba', badges:['HOT'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'e4', cat:'electronics', rank:4,  name:'Wireless Charging Pad',       niche:'Electronics · Charging',img:'https://images.unsplash.com/photo-1572435555646-7ad9a149ad91?w=400', demand:88, comp:62, profit:48, sales:'৳4.0L/mo', tiktok:'↑180%', price:'৳1200-1800', where:'Alibaba', badges:[], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'e5', cat:'electronics', rank:5,  name:'Smart Ring Fitness Tracker',  niche:'Electronics · Health',  img:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', demand:86, comp:38, profit:66, sales:'৳3.8L/mo', tiktok:'↑260%', price:'৳2000-2800', where:'Alibaba', badges:['RISING'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'b1', cat:'beauty',      rank:6,  name:'Glass Skin Serum Kit',        niche:'Beauty · Skincare',     img:'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400', demand:97, comp:38, profit:74, sales:'৳7.9L/mo', tiktok:'↑520%', price:'৳1500-2000', where:'Alibaba', badges:['VIRAL','TikTok'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'b2', cat:'beauty',      rank:7,  name:'Rose Quartz Gua Sha Set',     niche:'Beauty · Face Tools',   img:'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400', demand:93, comp:32, profit:78, sales:'৳6.3L/mo', tiktok:'↑380%', price:'৳800-1200',  where:'Alibaba', badges:['HOT'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'h1', cat:'health',      rank:8,  name:'Posture Corrector Belt',       niche:'Health · Posture',      img:'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400', demand:92, comp:42, profit:68, sales:'৳6.7L/mo', tiktok:'↑320%', price:'৳1200-1800', where:'Alibaba', badges:['HOT','TikTok'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'p1', cat:'pet',         rank:9,  name:'Self-Cleaning Cat Brush',      niche:'Pet · Grooming',        img:'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400', demand:93, comp:30, profit:72, sales:'৳5.9L/mo', tiktok:'↑410%', price:'৳800-1200',  where:'Alibaba', badges:['VIRAL','TikTok'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'ho1',cat:'home',        rank:10, name:'Portable Matcha Frother',      niche:'Home · Kitchen',        img:'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', demand:95, comp:28, profit:72, sales:'৳6.9L/mo', tiktok:'↑480%', price:'৳1000-1500', where:'Alibaba', badges:['VIRAL','TikTok'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  /* ── FREE PRODUCTS (rank 11+) ── */
  { key:'e11', cat:'electronics', rank:11, name:'Phone Gaming Controller',   niche:'Electronics · Gaming',  img:'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=400', demand:74, comp:58, profit:46, sales:'৳2.2L/mo', tiktok:'↑88%',  price:'৳800-1200',  where:'Daraz, Alibaba', badges:['HOT'], fbAd:'গেমারদের জন্য সেরা controller! 🎮 এখন phone-এ console gaming-এর experience নিন।\n\nTarget: ১৮-৩০ বছর, gaming lovers\nContent: unboxing + gameplay\nHook: "এটা দিয়ে mobile gaming চিরতরে বদলে গেল!"', ttAd:'TikTok Short: unboxing → তুরন্ত gameplay demo\nBefore/After format: হাতে ব্যথা → smooth gaming\nBGM: trending gaming beat', caption:'Level up করো তোমার mobile gaming! 🎮🔥\n#gaming #mobilegaming #gamingsetup #bangladesh', budget:'শুরুতে $5-8/day দিয়ে test করো। CTR ২%+ হলে $15-20/day।\nBest time: রাত ৮টা-১২টা', adAngles:'১. Gamer pain point: হাত ব্যথা\n২. Pro gamer lifestyle\n৩. Gift for boyfriend/husband\n৪. "৳1000-এর নিচে best gaming upgrade"', note:'' },
  { key:'b11', cat:'beauty',      rank:12, name:'Charcoal Deep Cleanse Bar', niche:'Beauty · Cleansing',    img:'https://images.unsplash.com/photo-1583209814683-c023dd293cc6?w=400', demand:72, comp:52, profit:62, sales:'৳2.4L/mo', tiktok:'↑88%',  price:'৳400-600',   where:'Daraz, Alibaba', badges:[], fbAd:'Natural charcoal দিয়ে deep cleanse! ত্বকের সব ময়লা বের করে দেয়।\n\nTarget: মেয়েরা ১৮-৩৫ বছর\nContent: before/after skin comparison', ttAd:'TikTok: face wash routine দেখাও\n"এটা ব্যবহারের পর আমার মুখ এত clean!" - testimonial style', caption:'Natural charcoal diye deep cleanse! ✨\n#skincare #charcoal #cleansing #glowingskin', budget:'$3-5/day দিয়ে শুরু করো। Beauty products-এ conversion ভালো।', adAngles:'১. Acne সমস্যার সমাধান\n২. Natural/chemical-free angle\n৩. Budget-friendly skincare', note:'' },
  { key:'h11', cat:'health',      rank:13, name:'Resistance Band Set',       niche:'Health · Fitness',      img:'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400', demand:70, comp:55, profit:58, sales:'৳2.0L/mo', tiktok:'↑76%',  price:'৳500-800',   where:'Daraz, Alibaba', badges:['RISING'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'f1',  cat:'fashion',     rank:14, name:'Crystal Hair Claw Clips',   niche:'Fashion · Hair',        img:'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400', demand:70, comp:58, profit:78, sales:'৳2.0L/mo', tiktok:'↑88%',  price:'৳400-600',   where:'Alibaba, Local', badges:['HOT'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'m1',  cat:'mens',        rank:15, name:'Premium Oversized Tee',     niche:"Men's · Streetwear",   img:'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400', demand:68, comp:65, profit:68, sales:'৳1.8L/mo', tiktok:'↑72%',  price:'৳600-900',   where:'Local, Alibaba', badges:[], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'w1',  cat:'womens',      rank:16, name:'Floral Wrap Midi Dress',    niche:"Women's · Dresses",    img:'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400', demand:72, comp:48, profit:74, sales:'৳2.2L/mo', tiktok:'↑96%',  price:'৳800-1200',  where:'Local, Alibaba', badges:['RISING'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'ba1', cat:'baby',        rank:17, name:'White Noise Sleep Machine', niche:'Baby · Sleep Aid',      img:'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400', demand:76, comp:35, profit:68, sales:'৳2.5L/mo', tiktok:'↑120%', price:'৳1800-2500', where:'Alibaba', badges:['HOT'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'o1',  cat:'outdoor',     rank:18, name:'Hammock with Straps',       niche:'Outdoor · Camping',     img:'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', demand:66, comp:40, profit:74, sales:'৳1.8L/mo', tiktok:'↑82%',  price:'৳2000-2800', where:'Alibaba', badges:[], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'pe1', cat:'pet',         rank:19, name:'Automatic Pet Feeder',      niche:'Pet · Smart Home',      img:'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?w=400', demand:68, comp:44, profit:62, sales:'৳1.7L/mo', tiktok:'↑78%',  price:'৳2500-3500', where:'Alibaba', badges:['NEW'], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
  { key:'ho11',cat:'home',        rank:20, name:'Mop & Bucket Spin Set',     niche:'Home · Cleaning',       img:'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400', demand:62, comp:60, profit:54, sales:'৳1.5L/mo', tiktok:'↑66%',  price:'৳1800-2400', where:'Daraz', badges:[], fbAd:'',ttAd:'',caption:'',budget:'',adAngles:'', note:'' },
];

/* ══════════════
   TOAST HELPER
══════════════ */
function showToast(msg, type = 'ok') {
  const el = document.getElementById('np-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'np-toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}