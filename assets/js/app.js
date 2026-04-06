/* ============================================================
   NexoraPilot — Core Engine v6.0 (Unified Firebase)
   Firebase Auth + Firestore — NO localStorage for user data
   ============================================================ */

/* ── Firebase Config (User Provided) ── */
const FB_CONFIG = {
  apiKey: "*****",
  authDomain: "ecomspark-cd4ea.firebaseapp.com",
  projectId: "ecomspark-cd4ea",
  storageBucket: "ecomspark-cd4ea.firebasestorage.app",
  messagingSenderId: "877618570666",
  appId: "1:877618570666:web:bff0a0012eb3538caab7d3",
  measurementId: "G-TW3D84FQEJ"
};

/* ── App Config ── */
const CONFIG = {
  GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  FREE_DAILY_LIMIT: 3,
  ADMIN_EMAIL: 'admin@ecomspark.com', /* Default admin email */
  BKASH_NUMBER: '01859-393487',
};

/* ── Firebase Instances ── */
let db = null;
let auth = null;
let currentUser = null;
let currentUserData = null;

/* ── Initialize Firebase ── */
function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(FB_CONFIG);
      }
      db   = firebase.firestore();
      auth = firebase.auth();

      /* Listen for auth state changes */
      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          await loadUserData(user.uid);
        } else {
          currentUserData = null;
        }
        updateUsageDisplay();
        if (typeof onAuthStateReady === 'function') onAuthStateReady(user);
      });

      console.log('Firebase connected ✅');
    }
  } catch(e) {
    console.warn('Firebase init error:', e);
  }
}

/* ── Load user data from Firestore ── */
async function loadUserData(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      currentUserData = doc.data();
    } else {
      currentUserData = null;
    }
  } catch(e) {
    console.warn('Error loading user data:', e);
    currentUserData = null;
  }
}

/* ════════ SYSTEM STORE (localStorage for Admin Settings only) ════════ */
const Store = {
  get(k){ try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) },
  D(){ return this.get('es_sys')||{} },
  SD(d){ this.set('es_sys',d) },

  getApiKey(){ return this.D().systemApiKey||'' },
  setApiKey(k){ const d=this.D(); d.systemApiKey=k; this.SD(d) },

  getBkashNumber(){ return this.D().bkashNumber||CONFIG.BKASH_NUMBER },
  setBkashNumber(n){ const d=this.D(); d.bkashNumber=n; this.SD(d) },

  getBanners(){ return this.D().banners||getDefaultBanners() },
  setBanners(b){ const d=this.D(); d.banners=b; this.SD(d) },
};

/* ════════ FIREBASE DATA LAYER ════════ */
const FB = {
  /* Usage tracking */
  async getUsage() {
    const today = new Date().toDateString();
    if(!currentUser) {
      const key = 'es_usage_' + today;
      return { count: parseInt(localStorage.getItem(key)||'0'), date: today };
    }
    try {
      const doc = await db.collection('usage').doc(currentUser.uid + '_' + today).get();
      return { count: doc.exists ? (doc.data().count||0) : 0, date: today };
    } catch(e) { return { count: 0, date: today }; }
  },

  async incUsage() {
    const today = new Date().toDateString();
    if(!currentUser) {
      const key = 'es_usage_' + today;
      const count = parseInt(localStorage.getItem(key)||'0') + 1;
      localStorage.setItem(key, count);
      return count;
    }
    try {
      const ref = db.collection('usage').doc(currentUser.uid + '_' + today);
      await ref.set({ count: firebase.firestore.FieldValue.increment(1), uid: currentUser.uid, date: today }, { merge: true });
      const doc = await ref.get();
      return doc.data().count||1;
    } catch(e) { return 1; }
  },

  isPro() {
    if(!currentUserData) return false;
    if(currentUserData.banned) return false;
    if(currentUserData.plan === 'admin') return true;
    if(!currentUserData.isPro) return false;
    if(currentUserData.expiryDate && new Date() > new Date(currentUserData.expiryDate)) return false;
    return true;
  },

  isAdmin() {
    return currentUserData?.plan === 'admin';
  },

  /* Products */
  async getProducts() {
    try {
      const snap = await db.collection('products').orderBy('date','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  async addProduct(data) {
    data.date = new Date().toISOString();
    const ref = await db.collection('products').add(data);
    return { id: ref.id, ...data };
  },

  async updateProduct(id, data) {
    await db.collection('products').doc(id).update(data);
  },

  async deleteProduct(id) {
    await db.collection('products').doc(id).delete();
  },

  /* Help & Agency */
  async addHelp(data) {
    data.date = new Date().toISOString();
    data.status = 'pending';
    return await db.collection('help').add(data);
  },

  async addAgency(data) {
    data.date = new Date().toISOString();
    data.status = 'pending';
    return await db.collection('agency').add(data);
  },

  /* Payments */
  async addPayment(data) {
    data.date = new Date().toISOString();
    data.status = 'pending';
    data.uid = currentUser?.uid || null;
    return await db.collection('payments').add(data);
  },

  async getPayments() {
    const snap = await db.collection('payments').orderBy('date','desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* User Auth Actions */
  async register(data) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(data.email, data.password);
      const uid = cred.user.uid;
      const userData = {
        uid,
        name: data.name,
        address: data.address,
        phone: data.phone,
        whatsapp: data.whatsapp || '',
        fbLink: data.fbLink || '',
        email: data.email,
        isPro: false,
        plan: 'free',
        createdAt: new Date().toISOString()
      };
      await db.collection('users').doc(uid).set(userData);
      currentUserData = userData;
      return { success: true };
    } catch(e) { return { success: false, error: getAuthError(e.code) }; }
  },

  async login(email, pass) {
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      return { success: true };
    } catch(e) { return { success: false, error: getAuthError(e.code) }; }
  }
};

/* ── Auth Helpers ── */
function getAuthError(code) {
  const errs = {
    'auth/email-already-in-use': 'এই email ইতোমধ্যে ব্যবহৃত।',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।',
    'auth/user-not-found': 'Email বা পাসওয়ার্ড ভুল।',
    'auth/wrong-password': 'Email বা পাসওয়ার্ড ভুল।',
    'auth/invalid-credential': 'Email বা পাসওয়ার্ড ভুল।',
  };
  return errs[code] || 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}

/* ════════ UI HELPERS ════════ */
const R = {
  skeleton: (n=1) => Array(n).fill('<div class="skeleton" style="height:100px;margin-bottom:12px"></div>').join(''),
  error: (m) => `<div class="alert alert-error">❌ ${m}</div>`,
  noKey: () => `<div class="alert alert-warning">⚠️ System API Key সেট করা নেই। Admin-এর সাথে যোগাযোগ করুন।</div>`,
  limitReached: () => `<div class="alert alert-amber">🚀 আজকের ফ্রি লিমিট শেষ! আনলিমিটেড এক্সেস পেতে Pro নিন।</div>`,
  scoreCircle: (s) => `<div class="score-ring" style="border-color:${s>=80?'var(--a1)':s>=60?'var(--a3)':'#f87171'}">${s}</div>`,
  scoreBar: (s,c) => `<div class="meter"><div class="meter-bar" style="width:${s}%;background:${c}"></div></div>`,
  tags: (ts,cl) => `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${(ts||[]).map(t=>`<span class="tag ${cl}">${t}</span>`).join('')}</div>`,
  list: (ls,ic) => `<ul style="list-style:none;padding:0;margin-top:8px">${(ls||[]).map(l=>`<li style="padding:4px 0;font-size:.85rem;color:var(--text2)"><span style="color:var(--a1);margin-right:8px">${ic}</span>${l}</li>`).join('')}</ul>`,
  copyBox: (t,l) => `<div class="copy-box"><div class="copy-box-inner">${t}</div><button class="copy-btn" onclick="copyText(this.previousSibling.textContent,this)">${l}</button></div>`
};

function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  const old = btn.textContent; btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = old, 2000);
}

async function updateUsageDisplay() {
  const usage = await FB.getUsage();
  const displays = document.querySelectorAll('.usage-display');
  const rem = FB.isPro() ? '∞' : Math.max(0, CONFIG.FREE_DAILY_LIMIT - usage.count);
  displays.forEach(d => d.textContent = `${rem}/${CONFIG.FREE_DAILY_LIMIT}`);
}

/* ════════ MODALS ════════ */
const Modal = {
  show(id){ document.getElementById(id)?.classList.remove('hidden'); },
  hideAll(){ document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.add('hidden')); }
};

/* ════════ TOAST ════════ */
const Toast = {
  init(){ if(!document.querySelector('.toast-container')) { const c=document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); } },
  show(m,t='info'){
    this.init(); const c=document.querySelector('.toast-container');
    const d=document.createElement('div'); d.className=`toast ${t}`; d.textContent=m;
    c.appendChild(d); setTimeout(()=>d.remove(),3500);
  },
  success(m){ this.show(m,'success') },
  error(m){ this.show(m,'error') }
};

/* ════════ ENGINE ════════ */
const Engine = {
  async call(prompt) {
    const key = Store.getApiKey();
    if(!key) throw new Error('API Key missing');
    const res = await fetch(`${CONFIG.GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ contents: [{parts: [{text: prompt + '\nRespond ONLY in JSON.'}]}] })
    });
    if(!res.ok) throw new Error('API Error');
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return JSON.parse(raw.replace(/```json|```/g,'').trim());
  },
  async checkLimit() {
    if(FB.isPro()) return true;
    const usage = await FB.getUsage();
    return usage.count < CONFIG.FREE_DAILY_LIMIT;
  }
};

/* ════════ PROMPTS ════════ */
const Prompts = {
  product_research: (v) => `Analyze product: ${v.product}. Category: ${v.category}. Market: ${v.market}. JSON output only.`,
  tiktok_viral: (v) => `Find TikTok viral for: ${v.niche}. JSON output only.`,
  // Add other prompts as needed or copy from previous version
};

/* ════════ AUTH UI ════════ */
function showProLoginModal() { Modal.show('authModal'); }

async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  const res = await FB.login(email, pass);
  if(res.success) { Toast.success('Login সফল!'); Modal.hideAll(); }
  else Toast.error(res.error);
}

async function doRegister() {
  const data = {
    name: document.getElementById('regName').value,
    address: document.getElementById('regAddress').value,
    phone: document.getElementById('regPhone').value,
    whatsapp: document.getElementById('regWhatsapp')?.value || '',
    fbLink: document.getElementById('regFbLink').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPass').value
  };
  if(!data.name || !data.email || !data.password) return Toast.error('সব তথ্য দিন');
  const res = await FB.register(data);
  if(res.success) { Toast.success('রেজিস্ট্রেশন সফল!'); Modal.hideAll(); }
  else Toast.error(res.error);
}

/* ════════ INIT ════════ */
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  Toast.init();
});

function getDefaultBanners(){
  return [
    {id:1,title:'🚀 Winning Products দ্রুত খুঁজুন',subtitle:'স্বয়ংক্রিয় গবেষণায় ecommerce সেরা পণ্য আবিষ্কার করুন',bg:'linear-gradient(135deg,#0369a1,#7c3aed)',cta:'গবেষণা শুরু করুন',link:'#tools',active:true},
  ];
}
