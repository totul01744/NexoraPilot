/* ============================================================
   NexoraPilot — Core Engine v5.0
   Firebase Auth + Firestore — NO localStorage for user data
   ============================================================ */

/* ── Firebase Config ── */
const FB_CONFIG = {
  apiKey: "AIzaSyDgqlhFa_zRj7w1h5YiMPV3ajQUbGGrnEI",
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
  ADMIN_EMAIL: 'admin@ecomspark.com', /* Admin Firebase Auth email */
  BKASH_NUMBER: '01859-393487',
};

/* ── Firebase Instances ── */
let db = null;
let auth = null;
let currentUser = null;
let currentUserData = null; /* Firestore user doc data */

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
        onAuthStateReady(user);
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

/* ── Called when auth state is ready (override in pages) ── */
function onAuthStateReady(user) {
  /* Pages can override this */
  if (typeof renderProducts === 'function') renderProducts();
  if (typeof renderBanners === 'function') renderBanners();
}

/* ════════ LOCAL STORE — Only for Admin/System config ════════ */
const Store = {
  get(k){ try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) },
  rm(k){ localStorage.removeItem(k) },
  D(){ return this.get('es_sys')||{} },
  SD(d){ this.set('es_sys',d) },

  /* System API Key (admin sets, all benefit) */
  getApiKey(){ return this.D().systemApiKey||'' },
  setApiKey(k){ const d=this.D(); d.systemApiKey=k; this.SD(d) },

  /* bKash Number */
  getBkashNumber(){ return this.D().bkashNumber||CONFIG.BKASH_NUMBER },
  setBkashNumber(n){ const d=this.D(); d.bkashNumber=n; this.SD(d) },

  /* Banners */
  getBanners(){ return this.D().banners||getDefaultBanners() },
  setBanners(b){ const d=this.D(); d.banners=b; this.SD(d) },

  isAdmin(){
    if(!currentUser) return false;
    return currentUserData?.plan === 'admin';
  },
};

/* ════════ FIREBASE DATA LAYER ════════ */
const FB = {

  /* ── Usage tracking per user per day ── */
  async getUsage() {
    const today = new Date().toDateString();
    if(!currentUser) {
      const key = 'es_usage_' + today;
      const count = parseInt(localStorage.getItem(key)||'0');
      return { count, date: today };
    }
    try {
      const ref = db.collection('usage').doc(currentUser.uid + '_' + today);
      const doc = await ref.get();
      if(doc.exists) return { count: doc.data().count||0, date: today };
      return { count: 0, date: today };
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

  /* ── Pro check ── */
  isPro() {
    if(!currentUserData) return false;
    if(currentUserData.banned) return false;
    if(currentUserData.plan === 'admin') return true;
    if(!currentUserData.isPro) return false;
    if(currentUserData.expiryDate) {
      const exp = new Date(currentUserData.expiryDate);
      if(new Date() > exp) return false;
    }
    return true;
  },

  /* ── Products ── */
  async getProducts() {
    try {
      const snap = await db.collection('products').orderBy('date','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  async addProduct(data) {
    data.date = new Date().toISOString();
    data.createdBy = currentUser?.uid || 'admin';
    const ref = await db.collection('products').add(data);
    return { id: ref.id, ...data };
  },

  async updateProduct(id, data) {
    await db.collection('products').doc(id).update(data);
  },

  async deleteProduct(id) {
    await db.collection('products').doc(id).delete();
  },

  /* ── Help Requests ── */
  async addHelp(data) {
    data.date = new Date().toISOString();
    data.status = 'pending';
    data.uid = currentUser?.uid || null;
    const ref = await db.collection('help').add(data);
    return { id: ref.id, ...data };
  },

  async getHelp() {
    try {
      const snap = await db.collection('help').orderBy('date','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  /* ── Agency / Upgrade Inquiries ── */
  async addAgency(data) {
    data.date = new Date().toISOString();
    data.status = 'pending';
    data.uid = currentUser?.uid || null;
    const ref = await db.collection('agency').add(data);
    return { id: ref.id, ...data };
  },

  async getAgency() {
    try {
      const snap = await db.collection('agency').orderBy('date','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  /* ── Payments ── */
  async addPayment(data) {
    data.date = new Date().toISOString();
    data.status = 'pending';
    data.uid = currentUser?.uid || null;
    const ref = await db.collection('payments').add(data);
    return { id: ref.id, ...data };
  },

  async getPayments() {
    try {
      const snap = await db.collection('payments').orderBy('date','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  async updatePayment(id, data) {
    await db.collection('payments').doc(id).update(data);
  },

  /* ── Pro Users ── */
  async getProUsers() {
    try {
      const snap = await db.collection('users').where('isPro','==',true).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  async addProUserByEmail(email, name, plan) {
    try {
      const snap = await db.collection('users').where('email','==',email).get();
      if(!snap.empty) {
        const doc = snap.docs[0];
        const expiryDate = plan.includes('Annual')
          ? new Date(Date.now() + 365*24*60*60*1000).toISOString()
          : new Date(Date.now() + 30*24*60*60*1000).toISOString();
        await db.collection('users').doc(doc.id).update({
          isPro: true, plan, expiryDate, proActivatedAt: new Date().toISOString()
        });
        return true;
      } else {
        await db.collection('pendingPro').add({ email, name, plan, date: new Date().toISOString() });
        return false;
      }
    } catch(e) { return false; }
  },

  async removeProUser(uid) {
    await db.collection('users').doc(uid).update({ isPro: false, plan: 'free' });
  },

  async banUser(uid) {
    await db.collection('users').doc(uid).update({ banned: true });
  },

  /* ── Events / Analytics ── */
  async logEvent(ev, data={}) {
    try {
      await db.collection('events').add({
        ev, data,
        uid: currentUser?.uid || null,
        t: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {}
  },

  async getEvents(limit=100) {
    try {
      const snap = await db.collection('events').orderBy('t','desc').limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  /* ── Stats for dashboard ── */
  async getStats() {
    try {
      const [prods, helps, agency, payments, proUsers, allUsers] = await Promise.all([
        db.collection('products').get(),
        db.collection('help').where('status','==','pending').get(),
        db.collection('agency').get(),
        db.collection('payments').where('status','==','pending').get(),
        db.collection('users').where('isPro','==',true).get(),
        db.collection('users').get(),
      ]);
      return {
        products: prods.size,
        helpPending: helps.size,
        agency: agency.size,
        paymentsPending: payments.size,
        proUsers: proUsers.size,
        allUsers: allUsers.size,
      };
    } catch(e) { return { products:0, helpPending:0, agency:0, paymentsPending:0, proUsers:0, allUsers:0 }; }
  },
};

/* ════════ AUTH FUNCTIONS ════════ */
async function registerUser(name, address, phone, whatsapp, fbUser, email, password) {
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      uid: cred.user.uid,
      name, address, phone,
      whatsapp: whatsapp||'',
      fbUser: fbUser||'',
      email,
      isPro: false,
      plan: 'free',
      banned: false,
      createdAt: new Date().toISOString(),
    });
    await cred.user.updateProfile({ displayName: name });
    return { success: true };
  } catch(e) {
    return { success: false, error: getAuthError(e.code) };
  }
}

async function loginUser(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    return { success: true };
  } catch(e) {
    return { success: false, error: getAuthError(e.code) };
  }
}

async function logoutUser() {
  await auth.signOut();
  currentUser = null;
  currentUserData = null;
  updateUsageDisplay();
  Toast.success('Logout হয়েছে।');
}

async function sendPasswordReset(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch(e) {
    return { success: false, error: getAuthError(e.code) };
  }
}

function getAuthError(code) {
  const errs = {
    'auth/email-already-in-use': 'এই email ইতোমধ্যে ব্যবহৃত।',
    'auth/invalid-email': 'সঠিক email দিন।',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।',
    'auth/user-not-found': 'এই email-এ কোনো account নেই।',
    'auth/wrong-password': 'পাসওয়ার্ড ভুল।',
    'auth/invalid-credential': 'Email বা পাসওয়ার্ড ভুল।',
    'auth/too-many-requests': 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    'auth/network-request-failed': 'ইন্টারনেট সংযোগ সমস্যা।',
  };
  return errs[code] || 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}

/* ════════ MODALS ════════ */
const Modal = {
  show(id){ document.getElementById(id)?.classList.remove('hidden') },
  hide(id){ document.getElementById(id)?.classList.add('hidden') },
  hideAll(){ document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.add('hidden')) },
};

/* ════════ UTILS ════════ */
function copyText(text,btn){ navigator.clipboard.writeText(text).then(()=>{ const o=btn.textContent; btn.textContent='✅ Copied!'; setTimeout(()=>{ btn.textContent=o; },2000); }); }
function downloadText(text,fn){ const b=new Blob([text],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fn||'output.txt'; a.click(); }
function switchTab(prefix,tab,btn){ document.querySelectorAll(`[id^="${prefix}-tab-"]`).forEach(el=>el.classList.add('hidden')); document.getElementById(`${prefix}-tab-${tab}`)?.classList.remove('hidden'); btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }

async function updateUsageDisplay(){
  const r = await Engine.remaining();
  const isPro = FB.isPro();
  const isLoggedIn = !!currentUser;
  document.querySelectorAll('.usage-display').forEach(el=>{
    el.textContent = isPro ? '∞ Pro' : `${r}/${CONFIG.FREE_DAILY_LIMIT}`;
    el.style.color  = isPro ? 'var(--a1)' : r>0 ? 'var(--a3)' : '#f87171';
  });
  const badge=document.getElementById('proBadge');
  if(badge){ badge.style.display=isPro?'inline-flex':'none'; }
  const upgradeBtn=document.getElementById('upgradeBtn');
  if(upgradeBtn){ upgradeBtn.style.display=isPro?'none':'inline-flex'; }

  const userDisplay = document.getElementById('headerUserDisplay');
  if(userDisplay){
    if(isLoggedIn && currentUserData){
      userDisplay.innerHTML=`<span style="font-size:.82rem;color:var(--text2)">👤</span>
        <span style="font-size:.82rem;color:#fff;font-weight:700">${currentUserData.name?.split(' ')[0]||'User'}</span>
        <button class="btn btn-sm btn-secondary" style="padding:4px 10px;font-size:.75rem" onclick="logoutUser()">Logout</button>`;
    } else {
      userDisplay.innerHTML=`<button class="btn btn-sm btn-secondary" style="padding:5px 12px;font-size:.82rem" onclick="Modal.show('authModal')">🔐 Login / Register</button>`;
    }
  }
}

/* ════════ AUTH MODAL (Login + Register) ════════ */
function showAuthModal(tab='login'){
  Modal.show('authModal');
  switchAuthTab(tab);
}

function switchAuthTab(tab){
  document.getElementById('authTabLogin')?.classList.toggle('active', tab==='login');
  document.getElementById('authTabReg')?.classList.toggle('active', tab==='register');
  document.getElementById('authLoginForm')?.classList.toggle('hidden', tab!=='login');
  document.getElementById('authRegForm')?.classList.toggle('hidden', tab!=='register');
  document.getElementById('authForgotForm')?.classList.add('hidden');
}

async function doLogin(){
  const email = document.getElementById('loginEmail')?.value?.trim().toLowerCase();
  const pass  = document.getElementById('loginPass')?.value;
  if(!email||!pass){ Toast.error('Email ও পাসওয়ার্ড দিন'); return; }
  const btn = document.getElementById('loginBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Login হচ্ছে...'; }
  const res = await loginUser(email, pass);
  if(btn){ btn.disabled=false; btn.textContent='🔐 Login করুন'; }
  if(res.success){
    Modal.hideAll();
    Toast.success(`স্বাগতম! Login সফল হয়েছে। ✅`);
  } else {
    Toast.error(res.error);
  }
}

async function doRegister(){
  const name     = document.getElementById('regName')?.value?.trim();
  const address  = document.getElementById('regAddress')?.value?.trim();
  const phone    = document.getElementById('regPhone')?.value?.trim();
  const whatsapp = document.getElementById('regWhatsapp')?.value?.trim();
  const fbUser   = document.getElementById('regFbUser')?.value?.trim();
  const email    = document.getElementById('regEmail')?.value?.trim().toLowerCase();
  const pass     = document.getElementById('regPass')?.value;
  const pass2    = document.getElementById('regPass2')?.value;

  if(!name||!address||!phone||!email||!pass){ Toast.error('নাম, ঠিকানা, নম্বর, email ও পাসওয়ার্ড আবশ্যক'); return; }
  if(!email.includes('@')){ Toast.error('সঠিক email দিন'); return; }
  if(pass.length<6){ Toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে'); return; }
  if(pass !== pass2){ Toast.error('পাসওয়ার্ড দুটো মিলছে না'); return; }

  const btn = document.getElementById('regBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Account তৈরি হচ্ছে...'; }
  const res = await registerUser(name, address, phone, whatsapp, fbUser, email, pass);
  if(btn){ btn.disabled=false; btn.textContent='✅ Account তৈরি করুন'; }
  if(res.success){
    Modal.hideAll();
    Toast.success('Account তৈরি হয়েছে! স্বাগতম 🎉');
  } else {
    Toast.error(res.error);
  }
}

async function doForgotPassword(){
  const email = document.getElementById('forgotEmail')?.value?.trim().toLowerCase();
  if(!email){ Toast.error('Email দিন'); return; }
  const res = await sendPasswordReset(email);
  if(res.success){
    Toast.success('Password reset email পাঠানো হয়েছে! ✅');
    document.getElementById('authForgotForm')?.classList.add('hidden');
    document.getElementById('authLoginForm')?.classList.remove('hidden');
  } else {
    Toast.error(res.error);
  }
}

/* ════════ PAYMENT MODAL ════════ */
function showPaymentModal(){ Modal.show('paymentModal'); renderPaymentStep1(); }
function showUpgradeModal(){ showPaymentModal(); }

function renderPaymentStep1(){
  const bkash=Store.getBkashNumber();
  const modal=document.getElementById('paymentContent');
  if(!modal)return;
  const userEmail = currentUser?.email || '';
  const userName  = currentUserData?.name || '';
  modal.innerHTML=`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:2.5rem;font-weight:900;font-family:var(--font-h);color:#fff">৳১৯৯<span style="font-size:1rem;color:var(--text2)">/মাস</span></div>
      <div style="font-size:.84rem;color:var(--text2);margin-top:4px">বা ৳১,৯৯৯/বছর</div>
    </div>
    <div style="background:rgba(236,72,153,.1);border:1px solid rgba(236,72,153,.3);border-radius:14px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:1.8rem;margin-bottom:8px">📱</div>
      <div style="font-family:var(--font-h);font-weight:800;color:#fff;font-size:.95rem;margin-bottom:4px">bKash-এ পাঠান</div>
      <div style="font-size:1.4rem;font-weight:900;color:#f472b6;letter-spacing:2px;margin:8px 0">${bkash}</div>
      <div style="font-size:.82rem;color:var(--text2)">উপরের নম্বরে <strong style="color:#fff">Send Money</strong> করুন</div>
    </div>
    <div style="background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.15);border-radius:12px;padding:14px;margin-bottom:20px;font-size:.84rem;color:var(--text2)">
      <div style="margin-bottom:6px"><strong style="color:#fff">পদক্ষেপ:</strong></div>
      <div>১. bKash App → Send Money → ${bkash}</div>
      <div>২. Amount: ৳১৯৯ বা ৳১,৯৯৯ (বার্ষিক)</div>
      <div>৩. Reference: আপনার Email লিখুন</div>
      <div>৪. Transaction ID নিচে দিন</div>
    </div>
    <div class="form-group"><label class="form-label">আপনার নাম *</label><input class="form-control" id="pay-name" placeholder="পূর্ণ নাম লিখুন" value="${userName}"></div>
    <div class="form-group"><label class="form-label">Email Address *</label><input class="form-control" id="pay-email" type="email" placeholder="আপনার email" value="${userEmail}"></div>
    <div class="form-group"><label class="form-label">Plan *</label>
      <select class="form-control" id="pay-plan">
        <option value="monthly">Pro Monthly — ৳১৯৯/মাস</option>
        <option value="yearly">Pro Annual — ৳১,৯৯৯/বছর</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">bKash Transaction ID *</label><input class="form-control" id="pay-txn" placeholder="e.g., 8N6X1J2ABC" style="letter-spacing:1px"></div>
    <div class="form-group"><label class="form-label">Phone Number (bKash)</label><input class="form-control" id="pay-phone" placeholder="01XXXXXXXXX"></div>
    <button class="btn btn-primary btn-full" onclick="submitPayment()" style="background:linear-gradient(135deg,#ec4899,#7c3aed)">📤 Payment Submit করুন</button>
    <p style="text-align:center;font-size:.78rem;color:var(--text2);margin-top:12px">Admin verify করলে ২-১২ ঘণ্টার মধ্যে activate হবে।</p>`;
}

async function submitPayment(){
  const name  = document.getElementById('pay-name')?.value?.trim();
  const email = document.getElementById('pay-email')?.value?.trim();
  const plan  = document.getElementById('pay-plan')?.value;
  const txn   = document.getElementById('pay-txn')?.value?.trim();
  const phone = document.getElementById('pay-phone')?.value?.trim();
  if(!name||!email||!txn){ Toast.error('নাম, email ও Transaction ID আবশ্যক'); return; }
  if(!email.includes('@')){ Toast.error('সঠিক email দিন'); return; }
  const payment = { name, email, plan, txnId:txn, phone, amount:plan==='yearly'?'৳১,৯৯৯':'৳১৯৯' };
  try {
    await FB.addPayment(payment);
    await FB.logEvent('payment_submit',{name,email,plan,txn});
  } catch(e) { console.warn('Payment save error:', e); }
  document.getElementById('paymentContent').innerHTML=`
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:3rem;margin-bottom:14px">✅</div>
      <div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:10px">Payment Submit হয়েছে!</div>
      <div style="font-size:.88rem;color:var(--text2);margin-bottom:20px">আপনার TrxID: <strong style="color:var(--a1)">${txn}</strong><br>Admin verify করলে <strong style="color:#fff">২-১২ ঘণ্টার মধ্যে</strong> activate হবে।</div>
      <div style="background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:12px;padding:14px;font-size:.85rem;margin-bottom:20px">
        আপনার email: <strong style="color:var(--a1)">${email}</strong><br>
        <span style="color:var(--text2)">Firebase account-এ activate হবে।</span>
      </div>
      <button class="btn btn-secondary" onclick="Modal.hideAll()">বন্ধ করুন</button>
    </div>`;
  Toast.success('Payment submit হয়েছে! Admin verify করবেন।');
}

/* ════════ TOAST ════════ */
const Toast = {
  c:null,
  init(){
    if(!document.querySelector('.toast-container')){
      this.c=document.createElement('div'); this.c.className='toast-container';
      document.body.appendChild(this.c);
    } else this.c=document.querySelector('.toast-container');
  },
  show(msg,type='info',dur=3600){
    if(!this.c)this.init();
    const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
    const t=document.createElement('div'); t.className=`toast ${type}`;
    t.innerHTML=`<span>${icons[type]}</span><span>${msg}</span>`;
    this.c.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='.3s'; setTimeout(()=>t.remove(),300); },dur);
  },
  success(m){this.show(m,'success')},
  error(m){this.show(m,'error')},
  info(m){this.show(m,'info')},
  warning(m){this.show(m,'warning')},
};

/* ════════ ENGINE (Gemini) ════════ */
const Engine = {
  async call(prompt){
    const apiKey=Store.getApiKey();
    if(!apiKey) throw new Error('সিস্টেম এখনো চালু হয়নি। Admin-এর সাথে যোগাযোগ করুন।');
    const url=`${CONFIG.GEMINI_URL}?key=${apiKey}`;
    let res;
    try {
      res=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          contents:[{parts:[{text:prompt+'\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks, no extra text. Raw JSON only.'}]}],
          generationConfig:{temperature:0.7,maxOutputTokens:4000},
        }),
      });
    } catch(e){ throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।'); }

    if(!res.ok){
      const err=await res.json().catch(()=>({}));
      const msg=err.error?.message||'';
      const status=res.status;
      if(msg.includes('suspended')||msg.includes('Consumer')||status===403)
        throw new Error('সিস্টেম key সমস্যা। Admin-এর সাথে যোগাযোগ করুন।');
      if(msg.includes('quota')||status===429)
        throw new Error('সিস্টেম ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      throw new Error('সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
    const data=await res.json();
    const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    const clean=raw.replace(/```json|```/g,'').trim();
    try{ return JSON.parse(clean); }
    catch{ throw new Error('ফলাফল প্রক্রিয়া করতে সমস্যা। আবার চেষ্টা করুন।'); }
  },

  async checkLimit(){
    if(!Store.getApiKey()) return false;
    if(FB.isPro()) return true;
    const usage = await FB.getUsage();
    return usage.count < CONFIG.FREE_DAILY_LIMIT;
  },

  async remaining(){
    if(FB.isPro()) return 999;
    if(!Store.getApiKey()) return 0;
    const usage = await FB.getUsage();
    return Math.max(0, CONFIG.FREE_DAILY_LIMIT - usage.count);
  },
};

/* ════════ PROMPTS ════════ */
const Prompts = {
  product_research:(v)=>`Analyze this ecommerce product for winning potential.\nProduct: ${v.product||'posture corrector'}, Category: ${v.category||'health'}, Market: ${v.market||'US'}\nJSON: {"product_name":"...","overall_score":82,"demand_score":80,"competition_score":65,"saturation_score":55,"trend_direction":"rising","verdict":"winner","summary":"...","demand_analysis":"...","competition_analysis":"...","profit_margin_estimate":"40-65%","suggested_price_range":"$25-$45","target_audience":["..."],"key_selling_points":["..."],"risk_factors":["..."],"recommendations":["..."]}`,
  tiktok_viral:(v)=>`Find TikTok viral product opportunities.\nNiche: ${v.niche||'beauty'}, Budget: ${v.budget||'medium'}, Market: ${v.market||'US'}\nJSON: {"products":[{"rank":1,"product":"...","viral_score":92,"trending_hashtags":["#..."],"estimated_monthly_searches":45000,"video_view_potential":"high","hooks":["..."],"content_angle":"...","why_viral":"...","profit_potential":"high"}],"trending_categories":["..."],"action_plan":["..."]}`,
  ad_creative:(v)=>`Generate ad creatives for this product.\nProduct: ${v.product}, Platform: ${v.platform||'TikTok & Facebook'}, Audience: ${v.audience||'18-35'}, USP: ${v.usp||''}\nJSON: {"ad_angles":[{"angle":"...","emotion":"curiosity","headline":"...","body_copy":"...","cta":"...","why_works":"..."}],"tiktok_scripts":[{"hook":"...","script":"...","duration":"30s","visual_direction":"..."}],"facebook_ads":[{"headline":"...","primary_text":"...","cta_button":"Shop Now","image_direction":"..."}],"ad_hooks":["..."]}`,
  ad_script:(v)=>`Write a complete ad script.\nProduct: ${v.product}, Platform: ${v.platform||'TikTok'}, Duration: ${v.duration||'30s'}, Style: ${v.style||'UGC'}\nJSON: {"script":{"hook":"...","problem":"...","solution":"...","proof":"...","offer":"...","cta":"...","full_script":"..."},"b_roll_shots":["..."],"voiceover_tips":"...","music_suggestions":["..."],"estimated_ctr":"3-5%"}`,
  product_description:(v)=>`Write high-converting product descriptions.\nProduct: ${v.product}, Features: ${v.features||''}, Buyer: ${v.buyer||'general'}, Tone: ${v.tone||'friendly'}\nJSON: {"title":"...","tagline":"...","short_description":"...","long_description":"...","bullet_points":["..."],"seo_description":"...","emotional_copy":"...","faqs":[{"q":"...","a":"..."}],"keywords":["..."]}`,
  supplier_finder:(v)=>`Find supplier strategy for this product.\nProduct: ${v.product}, Budget: ${v.budget||'medium'}, Quality: ${v.quality||'medium'}\nJSON: {"platforms":[{"name":"Alibaba","search_terms":["..."],"tips":"..."},{"name":"AliExpress","search_terms":["..."],"tips":"..."}],"verification_checklist":["..."],"red_flags":["..."],"outreach_email":{"subject":"...","body":"..."},"negotiation_tips":["..."],"estimated_cogs":"...","recommended_margin":"..."}`,
  competitor_analysis:(v)=>`Analyze competitors for this product.\nProduct: ${v.product}, Competitors: ${v.competitors||'unknown'}, Platform: ${v.platform||'Amazon'}\nJSON: {"market_overview":"...","competitors":[{"name":"...","estimated_monthly_revenue":"...","price_range":"...","strengths":["..."],"weaknesses":["..."],"review_score":4.2}],"market_gaps":["..."],"differentiation_opportunities":["..."],"entry_difficulty":"medium","win_strategy":["..."]}`,
  market_report:(v)=>`Generate a complete market research report.\nProduct: ${v.product}, Market: ${v.market||'US'}, Budget: ${v.budget||'medium'}\nJSON: {"report_title":"...","executive_summary":"...","market_size":"...","growth_rate":"...","opportunity_score":78,"demand_prediction":"increasing","target_demographics":[{"segment":"...","size":"...","pain_points":["..."]}],"market_trends":["..."],"financial_projections":{"month1":"...","month3":"...","month6":"..."},"risk_assessment":[{"risk":"...","probability":"medium","mitigation":"..."}],"action_plan":[{"week":1,"actions":["..."]}],"overall_recommendation":"..."}`,
  post_generator:(v)=>`Create Facebook/social media posts for this product in ${v.lang||'Bengali'}.\nProduct: ${v.product}, Features: ${v.features||''}, Language: ${v.lang||'Bengali'}\nJSON: {"posts":[{"type":"standard","title":"...","body":"...","cta":"..."},{"type":"storytelling","title":"...","body":"...","cta":"..."},{"type":"question_hook","title":"...","body":"...","cta":"..."}],"hashtags":["..."],"best_posting_time":"...","tips":["..."]}`,
  viral_post:(v)=>`Create viral social media posts using current trends.\nTopic: ${v.topic}, Platform: ${v.platform||'Facebook'}, Target: ${v.target||'general'}\nJSON: {"viral_posts":[{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"curiosity","expected_reach":"high"},{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"greed","expected_reach":"high"},{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"humor","expected_reach":"medium"}],"trending_elements":["..."],"timing_tip":"..."}`,
  promo_post:(v)=>`Create promotional posts for this offer.\nProduct: ${v.product}, Offer: ${v.offer||'discount'}, Duration: ${v.duration||'48 hours'}, Platform: ${v.platform||'Facebook'}\nJSON: {"promo_posts":[{"style":"urgency","headline":"...","body":"...","cta":"...","countdown_text":"..."},{"style":"value_focus","headline":"...","body":"...","cta":"..."},{"style":"social_proof","headline":"...","body":"...","cta":"..."}],"offer_headline":"...","discount_angle":"...","hashtags":["..."]}`,
  ad_copy:(v)=>`Generate high-converting ad copy.\nProduct: ${v.product}, Goal: ${v.goal||'sales'}, Audience: ${v.audience||'adults'}, Budget: ${v.budget||'medium'}\nJSON: {"facebook_ads":[{"headline":"...","primary_text":"...","description":"...","cta":"Shop Now","pain_point":"..."},{"headline":"...","primary_text":"...","description":"...","cta":"Learn More","pain_point":"..."}],"google_ads":[{"headline1":"...","headline2":"...","headline3":"...","description1":"...","description2":"...","display_url":"..."}],"power_words":["..."],"conversion_tips":["..."]}`,
  video_script:(v)=>`Write a complete video script.\nTopic: ${v.topic}, Duration: ${v.duration||'3-5 min'}, Style: ${v.style||'educational'}, Platform: ${v.platform||'YouTube'}\nJSON: {"title":"...","intro":{"hook":"...","presenter_line":"...","what_to_expect":"..."},"body":[{"section":"...","content":"...","visual_cue":"...","duration_seconds":30}],"outro":{"summary":"...","cta":"...","subscribe_line":"..."},"b_roll_suggestions":["..."],"thumbnail_idea":"...","tags":["..."]}`,
  video_prompt:(v)=>`Generate AI video prompts for Veo/Sora/Kling.\nScene: ${v.scene}, Style: ${v.style||'cinematic'}, Duration: ${v.duration||'15 seconds'}\nJSON: {"prompts":[{"title":"Prompt 1","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."},{"title":"Prompt 2","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."},{"title":"Prompt 3","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."}],"style_tips":["..."],"best_tool":"Veo/Sora/Kling"}`,
  storyboard:(v)=>`Create a detailed storyboard.\nTopic: ${v.topic}, Video Type: ${v.type||'product showcase'}, Duration: ${v.duration||'30 seconds'}\nJSON: {"title":"...","concept":"...","scenes":[{"scene_number":1,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":2,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":3,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":4,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":5,"duration_seconds":10,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."}],"music_mood":"...","color_palette":["..."],"director_notes":"..."}`,
  subtitle_translator:(v)=>`Translate subtitles accurately.\nText: ${v.text}, From: ${v.from||'English'}, To: ${v.to||'Bengali'}, Style: ${v.style||'natural'}\nJSON: {"translated_lines":[{"original":"...","translated":"..."}],"translation_notes":"...","cultural_adaptations":["..."],"formality_level":"...","alternative_phrases":[{"original":"...","alternative":"..."}]}`,
};

/* ════════ INIT ════════ */
document.addEventListener('DOMContentLoaded',()=>{
  Toast.init();
  initFirebase();
  document.querySelector('.hamburger')?.addEventListener('click',()=>document.getElementById('mainNav')?.classList.toggle('open'));
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o)o.classList.add('hidden'); }));
});
