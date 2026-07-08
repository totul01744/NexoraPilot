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
  /* AI Backend — Hugging Face Inference API (সম্পূর্ণ বিনামূল্যে) */
  HF_URL:  'https://api-inference.huggingface.co/models/',
  HF_MODELS: [
    'mistralai/Mistral-7B-Instruct-v0.3',
    'microsoft/Phi-3.5-mini-instruct',
    'HuggingFaceH4/zephyr-7b-beta',
    'mistralai/Mistral-7B-Instruct-v0.1',
    'google/flan-t5-xxl',
  ],

  /* OpenRouter (backup — admin key দিলে ব্যবহার হবে) */
  OPENROUTER_URL:   'https://openrouter.ai/api/v1/chat/completions',
  OPENROUTER_MODELS: [
    'meta-llama/llama-3.1-8b-instruct:free',
    'qwen/qwen-2.5-7b-instruct:free',
    'google/gemma-3-12b-it:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ],
  get OPENROUTER_MODEL(){ return this.OPENROUTER_MODELS[0]; },
  get OPENROUTER_MODEL_BACKUP(){ return this.OPENROUTER_MODELS[1]; },
  ADMIN_UID:        'd8uASRNpNVbpPeCKAWI5OQAg1UF2',   /* আপনার UID */
  ADMIN_EMAIL:      'totul01744@gmail.com',             /* আপনার email */
  BKASH_NUMBER:     '01859-393487',

  /* ── নতুন Feature Config ── */
  WINNING_LOCKED_COUNT: 10,        /* Winning Products এর প্রথম কতটি Pro-only */
  AI_TOOL_FREE_LIMIT:   3,         /* Normal User এর lifetime AI tool ব্যবহার limit */
  WHATSAPP_GROUP_LINK:  'https://chat.whatsapp.com/EV4u4W3KRLq9EhouPeyvmk',
  EXPIRY_REMINDER_DAYS: [7, 3, 0], /* মেয়াদ শেষের কত দিন আগে reminder (0 = expiry day) */
};

/* ── Firebase Instances ── */
let db = null;
let auth = null;
let currentUser = null;
let currentUserData = null; /* Firestore user doc data */

/* ── Initialize Firebase ── */
function initFirebase() {
  /* Already initialized by earlyInit() — skip */
  if(auth && db) { console.log('Firebase already initialized, skipping'); return; }
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(FB_CONFIG);
      }
      db   = firebase.firestore();
      auth = firebase.auth();
      Store.loadApiKeyFromFirestore();
      if(typeof GStore !== 'undefined') GStore.loadKeyFromFirestore();
      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          await loadUserData(user.uid);
          await FB.checkAndApplyExpiry();
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
      /* Firebase Auth এ আছে কিন্তু Firestore এ document নেই (পুরোনো/ভাঙা registration)
         — login হওয়ার সময় এখনই ঠিক করে দাও, যাতে Admin Panel এ user দেখা যায়। */
      try {
        const u = auth.currentUser;
        const repaired = {
          uid,
          name: u?.displayName || (u?.email||'').split('@')[0] || 'User',
          address: '',
          whatsapp: '',
          facebook: '',
          email: u?.email || '',
          isPro: false,
          plan: 'free',
          banned: false,
          createdAt: new Date().toISOString(),
        };
        await db.collection('users').doc(uid).set(repaired);
        currentUserData = repaired;
        console.log('Repaired missing user doc for', u?.email);
      } catch(e2) {
        console.warn('User doc repair failed:', e2);
        currentUserData = null;
      }
    }
  } catch(e) {
    console.warn('Error loading user data:', e);
    currentUserData = null;
  }
}

/* ── Called when auth state is ready (override in pages) ── */
function onAuthStateReady(user) {
  updateHeaderUser();
  /* Pages override this by redefining it */
}

/* ════════ LOCAL STORE — Only for Admin/System config ════════ */
const Store = {
  get(k){ try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) },
  rm(k){ localStorage.removeItem(k) },
  D(){ return this.get('es_sys')||{} },
  SD(d){ this.set('es_sys',d) },

  /* API Key — Firestore এ save হয়, localStorage cache হিসেবে */
  getApiKey(){
    /* First try memory cache */
    if(window._cachedApiKey) return window._cachedApiKey;
    /* Then try localStorage cache */
    return this.D().systemApiKey||'';
  },
  async setApiKey(k){
    /* Save to localStorage */
    const d=this.D(); d.systemApiKey=k; this.SD(d);
    window._cachedApiKey = k;
    /* Also save to Firestore so all users get it */
    if(db){
      try{
        await db.collection('settings').doc('config').set(
          {systemApiKey: k, updatedAt: new Date().toISOString()},
          {merge: true}
        );
      }catch(e){ console.warn('Firestore key save failed:', e); }
    }
  },

  /* Load API Key from Firestore on startup */
  async loadApiKeyFromFirestore(){
    if(!db) return;
    try{
      const snap = await db.collection('settings').doc('config').get();
      if(snap.exists && snap.data().systemApiKey){
        const k = snap.data().systemApiKey;
        window._cachedApiKey = k;
        const d = this.D(); d.systemApiKey = k; this.SD(d);
        console.log('API Key loaded from Firestore ✅');
      }
    }catch(e){ console.warn('Firestore key load failed:', e); }
  },

  /* bKash Number */
  getBkashNumber(){ return this.D().bkashNumber||CONFIG.BKASH_NUMBER },
  async setBkashNumber(n){
    const d=this.D(); d.bkashNumber=n; this.SD(d);
    if(db){ try{ await db.collection('settings').doc('config').set({bkashNumber:n},{merge:true}); }catch(e){} }
  },

  /* Banners */
  getBanners(){ return this.D().banners||getDefaultBanners() },
  setBanners(b){ const d=this.D(); d.banners=b; this.SD(d) },

  isAdmin(){
    if(!currentUser) return false;
    return currentUser.uid === CONFIG.ADMIN_UID || currentUser.email?.toLowerCase() === CONFIG.ADMIN_EMAIL;
  },
};

/* ════════ FIREBASE DATA LAYER ════════ */
const FB = {

  /* ── Usage tracking per user per day ── */
  async getUsage() {
    if(!currentUser) {
      const today = new Date().toDateString();
      const key = 'es_usage_' + today;
      const count = parseInt(localStorage.getItem(key)||'0');
      return { count, date: today };
    }
    const today = new Date().toDateString();
    try {
      const ref = db.collection('usage').doc(currentUser.uid + '_' + today);
      const doc = await ref.get();
      if(doc.exists) return { count: doc.data().count||0, date: today };
      return { count: 0, date: today };
    } catch(e) { return { count: 0, date: today }; }
  },

  async incUsage() {
    if(!currentUser) {
      const today = new Date().toDateString();
      const key = 'es_usage_' + today;
      const count = parseInt(localStorage.getItem(key)||'0') + 1;
      localStorage.setItem(key, count);
      return count;
    }
    const today = new Date().toDateString();
    try {
      const ref = db.collection('usage').doc(currentUser.uid + '_' + today);
      await ref.set({ count: firebase.firestore.FieldValue.increment(1), uid: currentUser.uid, date: today }, { merge: true });
      const doc = await ref.get();
      return doc.data().count||1;
    } catch(e) { return 1; }
  },

  /* ── AI Tool Lifetime Usage (Normal User: সর্বোচ্চ ৩ বার, Pro User: Unlimited) ──
     এটা পুরোনো দিন-ভিত্তিক usage থেকে আলাদা — সম্পূর্ণ lifetime count,
     Firestore এর aiUsage/{uid} ডকুমেন্টে সংরক্ষিত হয়। */
  async getAiUsageCount() {
    if(!currentUser) return 0;
    try {
      const doc = await db.collection('aiUsage').doc(currentUser.uid).get();
      return doc.exists ? (doc.data().count||0) : 0;
    } catch(e) { return 0; }
  },

  async incAiUsageCount() {
    if(!currentUser) return 0;
    try {
      const ref = db.collection('aiUsage').doc(currentUser.uid);
      await ref.set({
        count: firebase.firestore.FieldValue.increment(1),
        uid: currentUser.uid,
        email: currentUser.email || '',
        lastUsedAt: new Date().toISOString(),
      }, { merge: true });
      const doc = await ref.get();
      return doc.data().count || 1;
    } catch(e) { return 0; }
  },

  /* Admin Panel থেকে কোনো user এর AI usage reset করা */
  async resetAiUsage(uid) {
    try {
      await db.collection('aiUsage').doc(uid).set({ count: 0, resetAt: new Date().toISOString() }, { merge: true });
      await FB.logAdminActivity('ai_usage_reset', { uid });
      return true;
    } catch(e) { return false; }
  },

  /* Normal User এর AI Tool ব্যবহার করার অনুমতি আছে কিনা — Pro হলে সবসময় true */
  async canUseAiTool() {
    if(FB.isPro()) return true;
    const count = await FB.getAiUsageCount();
    return count < CONFIG.AI_TOOL_FREE_LIMIT;
  },

  async aiToolUsesRemaining() {
    if(FB.isPro()) return 999;
    const count = await FB.getAiUsageCount();
    return Math.max(0, CONFIG.AI_TOOL_FREE_LIMIT - count);
  },

  /* ── Pro check ── */
  isPro() {
    if(!currentUser) return false;
    /* Admin সবসময় Pro */
    if(currentUser.uid === CONFIG.ADMIN_UID) return true;
    if(currentUser.email?.toLowerCase() === CONFIG.ADMIN_EMAIL) return true;
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

  isAdmin() {
    if(!currentUser) return false;
    if(currentUser.uid === CONFIG.ADMIN_UID) return true;
    if(currentUser.email?.toLowerCase() === CONFIG.ADMIN_EMAIL) return true;
    return currentUserData?.plan === 'admin';
  },

  /* ── Membership Expiry চেক করে দরকার হলে Auto-Downgrade করে ──
     Login হওয়ার সময় call হয় — expire হয়ে গেলে Firestore এ লিখে
     isPro:false করে দেয়, যাতে admin panel ও সব জায়গায় সঠিক status দেখায়। */
  async checkAndApplyExpiry() {
    if(!currentUser || !currentUserData) return;
    if(currentUserData.plan === 'admin') return;
    if(!currentUserData.isPro) return;
    if(!currentUserData.expiryDate) return; /* মেয়াদ নির্দিষ্ট না থাকলে (lifetime/manual) skip */
    const exp = new Date(currentUserData.expiryDate);
    if(new Date() > exp) {
      try {
        await db.collection('users').doc(currentUser.uid).update({
          isPro: false,
          plan: 'free',
          expiredAt: new Date().toISOString(),
        });
        currentUserData.isPro = false;
        currentUserData.plan = 'free';
        await FB.addNotification(currentUser.uid, 'membership_expired', {
          title: '⏰ আপনার Pro Membership শেষ হয়ে গেছে',
          body: 'আপনার মেয়াদ শেষ হয়েছে এবং আপনি এখন Normal User। আবার Pro নিতে চাইলে upgrade করুন।',
        });
      } catch(e) { console.warn('Expiry downgrade failed:', e); }
    } else {
      /* মেয়াদ এখনো বাকি — Expiry Reminder (৭ দিন/৩ দিন/expiry day) দরকার কিনা চেক করো */
      await FB.checkExpiryReminders(exp);
    }
  },

  /* Expiry এর CONFIG.EXPIRY_REMINDER_DAYS (৭/৩/০ দিন) আগে একবার করে reminder পাঠায়।
     sentReminders array এ পাঠানো reminder-গুলো track করা হয় যাতে duplicate না হয়। */
  async checkExpiryReminders(expDate) {
    if(!currentUser || !currentUserData) return;
    const daysLeft = Math.ceil((expDate - new Date()) / (24*60*60*1000));
    const sent = currentUserData.sentReminders || [];
    for(const threshold of CONFIG.EXPIRY_REMINDER_DAYS) {
      if(daysLeft === threshold && !sent.includes(threshold)) {
        const msg = threshold === 0
          ? '⏰ আজই আপনার Pro Membership শেষ হয়ে যাচ্ছে! মেয়াদ বাড়াতে চাইলে এখনই upgrade করুন।'
          : `⏰ আপনার Pro Membership আর ${threshold} দিনের মধ্যে শেষ হয়ে যাবে। মেয়াদ শেষ হওয়ার আগে Extend করুন।`;
        try {
          await FB.addNotification(currentUser.uid, 'membership_expiry_reminder', {
            title: threshold === 0 ? '⏰ আজ মেয়াদ শেষ!' : `⏰ আর ${threshold} দিন বাকি`,
            body: msg,
          });
          const newSent = [...sent, threshold];
          await db.collection('users').doc(currentUser.uid).update({ sentReminders: newSent });
          currentUserData.sentReminders = newSent;
        } catch(e) { console.warn('Reminder send failed:', e); }
      }
    }
  },

  /* ── User এর Pro হওয়ার জন্য Payment Pending কিনা ── */
  async hasPendingProPayment() {
    if(!currentUser) return false;
    try {
      const snap = await db.collection('payments')
        .where('uid','==',currentUser.uid)
        .where('status','==','pending')
        .limit(1).get();
      return !snap.empty;
    } catch(e) { return false; }
  },

  /* ── User Personal API Key ── */
  async getUserApiKey() {
    if(!currentUser) return '';
    /* Memory cache */
    if(window._userApiKey) return window._userApiKey;
    /* Firestore থেকে load */
    try {
      const snap = await db.collection('users').doc(currentUser.uid).get();
      if(snap.exists && snap.data().geminiKey) {
        window._userApiKey = snap.data().geminiKey;
        return window._userApiKey;
      }
    } catch(e){}
    return '';
  },

  async setUserApiKey(key) {
    if(!currentUser) return false;
    window._userApiKey = key;
    try {
      await db.collection('users').doc(currentUser.uid).update({ geminiKey: key });
      return true;
    } catch(e) {
      /* If update fails (doc doesn't exist), use set with merge */
      try {
        await db.collection('users').doc(currentUser.uid).set({ geminiKey: key }, { merge: true });
        return true;
      } catch(e2) { return false; }
    }
  },

  async removeUserApiKey() {
    if(!currentUser) return;
    window._userApiKey = '';
    try {
      await db.collection('users').doc(currentUser.uid).update({ geminiKey: '' });
    } catch(e){}
  },

  /* ── Products — sortOrder দিয়ে manual ordering ── */
  async getProducts() {
    try {
      const snap = await db.collection('products').orderBy('sortOrder','asc').get();
      if(snap.empty){
        const snap2 = await db.collection('products').orderBy('date','desc').get();
        return snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      /* sortOrder field না থাকা product থাকলে fallback */
      try {
        const snap2 = await db.collection('products').orderBy('date','desc').get();
        return snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e2) { return []; }
    }
  },

  async addProduct(data) {
    data.date = new Date().toISOString();
    data.createdBy = currentUser?.uid || 'admin';
    if(data.sortOrder === undefined){
      /* নতুন product সবার শেষে — সবচেয়ে বড় sortOrder + 1 */
      try {
        const snap = await db.collection('products').orderBy('sortOrder','desc').limit(1).get();
        data.sortOrder = snap.empty ? 0 : (snap.docs[0].data().sortOrder||0) + 1;
      } catch(e){ data.sortOrder = Date.now(); }
    }
    const ref = await db.collection('products').add(data);
    return { id: ref.id, ...data };
  },

  /* Product টি উপরে/নিচে move করো — দুই product এর sortOrder swap করো */
  async moveProduct(products, fromIdx, direction) {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if(toIdx < 0 || toIdx >= products.length) return false;
    const a = products[fromIdx], b = products[toIdx];
    const aOrder = a.sortOrder ?? fromIdx;
    const bOrder = b.sortOrder ?? toIdx;
    await Promise.all([
      db.collection('products').doc(a.id).update({ sortOrder: bOrder }),
      db.collection('products').doc(b.id).update({ sortOrder: aOrder }),
    ]);
    return true;
  },

  /* সব product এর sortOrder normalize করো (প্রথমবার migrate করতে) */
  async normalizeProductOrder() {
    try {
      const snap = await db.collection('products').orderBy('date','desc').get();
      const batch = db.batch();
      snap.docs.forEach((d, idx) => {
        batch.update(d.ref, { sortOrder: idx });
      });
      await batch.commit();
      return true;
    } catch(e){ return false; }
  },

  async updateProduct(id, data) {
    await db.collection('products').doc(id).update(data);
  },

  async deleteProduct(id) {
    await db.collection('products').doc(id).delete();
    await FB.logAdminActivity('winning_product_deleted', { id });
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

  async updateHelp(id, data) {
    await db.collection('help').doc(id).update(data);
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

  async activateProUser(uid, data) {
    await db.collection('users').doc(uid).set(data, { merge: true });
  },

  /* duration: '7' | '15' | '30' | '90' | 'custom' | 'lifetime', customDate: ISO string (যখন duration==='custom') */
  computeExpiryDate(duration, customDate) {
    if(duration === 'lifetime') return null;
    if(duration === 'custom' && customDate) return new Date(customDate).toISOString();
    const days = parseInt(duration) || 30;
    return new Date(Date.now() + days*24*60*60*1000).toISOString();
  },

  /* email দিয়ে Pro activate করে — duration অনুযায়ী expiry সেট করে।
     Return: 'activated' (user পাওয়া গেছে ও activate হয়েছে) | 'pending' (register করেনি) | 'error' */
  async addProUserByEmail(email, name, plan, duration='30', customDate=null) {
    try {
      const snap = await db.collection('users').where('email','==',email).get();
      const expiryDate = FB.computeExpiryDate(duration, customDate);
      if(!snap.empty) {
        const doc = snap.docs[0];
        const updateData = {
          isPro: true, plan, proActivatedAt: new Date().toISOString(),
          expiryDate: expiryDate, /* null হলে lifetime */
          sentReminders: [], /* নতুন মেয়াদের জন্য reminder track রিসেট */
        };
        await db.collection('users').doc(doc.id).update(updateData);
        await FB.addNotification(doc.id, 'pro_approved', {
          title: '🎉 আপনার Pro Membership Activate হয়েছে!',
          body: `Plan: ${plan}${expiryDate ? ' — মেয়াদ শেষ: ' + new Date(expiryDate).toLocaleDateString('bn-BD') : ' — Lifetime'}`,
        });
        await FB.logAdminActivity('pro_activated', { email, plan, duration });
        return 'activated';
      } else {
        await db.collection('pendingPro').add({ email, name, plan, duration, customDate, date: new Date().toISOString() });
        return 'pending';
      }
    } catch(e) { console.warn('addProUserByEmail error:', e); return 'error'; }
  },

  /* Subscription extend করা — বর্তমান expiry তে দিন যোগ হবে (expiry না থাকলে আজ থেকে শুরু হবে) */
  async extendProUser(uid, extraDays) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      const data = doc.data() || {};
      const base = data.expiryDate ? new Date(data.expiryDate) : new Date();
      const newExpiry = new Date(base.getTime() + extraDays*24*60*60*1000).toISOString();
      await db.collection('users').doc(uid).update({ isPro:true, expiryDate:newExpiry, sentReminders: [] });
      await FB.addNotification(uid, 'pro_approved', {
        title: '⏳ আপনার Pro Membership Extend হয়েছে',
        body: `নতুন মেয়াদ শেষ: ${new Date(newExpiry).toLocaleDateString('bn-BD')}`,
      });
      await FB.logAdminActivity('pro_extended', { uid, extraDays });
      return true;
    } catch(e) { return false; }
  },

  /* Admin Panel থেকে Normal User কে Pro করা (manual control) */
  async upgradeToProManual(uid, plan, duration, customDate) {
    const expiryDate = FB.computeExpiryDate(duration, customDate);
    try {
      await db.collection('users').doc(uid).update({
        isPro: true, plan: plan || 'Pro Monthly', expiryDate, proActivatedAt: new Date().toISOString(), sentReminders: [],
      });
      await FB.addNotification(uid, 'pro_approved', {
        title: '🎉 Admin আপনাকে Pro Member করেছেন!',
        body: expiryDate ? `মেয়াদ শেষ: ${new Date(expiryDate).toLocaleDateString('bn-BD')}` : 'Lifetime Pro Access',
      });
      await FB.logAdminActivity('pro_manual_upgrade', { uid, plan, duration });
      return true;
    } catch(e) { return false; }
  },

  /* Admin Panel থেকে Pro User কে Normal করা (manual control) */
  async removeProUser(uid) {
    await db.collection('users').doc(uid).update({ isPro: false, plan: 'free', expiryDate: null });
    await FB.logAdminActivity('pro_removed', { uid });
  },

  async banUser(uid) {
    await db.collection('users').doc(uid).update({ banned: true });
    await FB.logAdminActivity('user_banned', { uid });
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
      const [prods, helps, agency, payments, proUsers, allUsers, mktProds, pendingReq, approvedReq, rejectedReq] = await Promise.all([
        db.collection('products').get(),
        db.collection('help').where('status','==','pending').get(),
        db.collection('agency').get(),
        db.collection('payments').where('status','==','pending').get(),
        db.collection('users').where('isPro','==',true).get(),
        db.collection('users').get(),
        db.collection('marketplaceProducts').get(),
        db.collection('productRequests').where('status','==','pending').get(),
        db.collection('productRequests').where('status','==','approved').get(),
        db.collection('productRequests').where('status','==','rejected').get(),
      ]);
      return {
        products: prods.size,
        helpPending: helps.size,
        agency: agency.size,
        paymentsPending: payments.size,
        proUsers: proUsers.size,
        totalUsers: allUsers.size,
        normalUsers: Math.max(0, allUsers.size - proUsers.size),
        marketplaceProducts: mktProds.size,
        requestsPending: pendingReq.size,
        requestsApproved: approvedReq.size,
        requestsRejected: rejectedReq.size,
      };
    } catch(e) {
      return { products:0, helpPending:0, agency:0, paymentsPending:0, proUsers:0, totalUsers:0, normalUsers:0, marketplaceProducts:0, requestsPending:0, requestsApproved:0, requestsRejected:0 };
    }
  },

  /* ════════ ADMIN ACTIVITY LOGGING ════════ */
  async logAdminActivity(action, data={}) {
    if(!db) return;
    try {
      await db.collection('adminLogs').add({
        action, data,
        adminUid: currentUser?.uid || 'unknown',
        adminEmail: currentUser?.email || 'unknown',
        date: new Date().toISOString(),
      });
    } catch(e) { console.warn('Admin log failed:', e); }
  },

  async getAdminLogs(limit=100) {
    try {
      const snap = await db.collection('adminLogs').orderBy('date','desc').limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  /* ════════ DIGITAL PRODUCT MARKETPLACE ════════ */

  /* ── Marketplace Products (Admin CRUD) ── */
  async getMarketplaceProducts() {
    try {
      const snap = await db.collection('marketplaceProducts').orderBy('createdAt','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      /* createdAt না থাকা পুরোনো ডকুমেন্ট থাকলে fallback */
      try { const snap = await db.collection('marketplaceProducts').get(); return snap.docs.map(d=>({id:d.id,...d.data()})); }
      catch(e2){ return []; }
    }
  },

  async getMarketplaceProduct(id) {
    try {
      const doc = await db.collection('marketplaceProducts').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch(e) { return null; }
  },

  /* type: 'free' | 'paid' */
  async addMarketplaceProduct(data) {
    try {
      await db.collection('marketplaceProducts').add({
        name: data.name || '',
        description: data.description || '',
        image: data.image || '',
        category: data.category || '',
        price: data.type === 'paid' ? (data.price || '') : '',
        type: data.type === 'paid' ? 'paid' : 'free',
        createdAt: new Date().toISOString(),
      });
      await FB.logAdminActivity('marketplace_product_added', { name: data.name });
      return true;
    } catch(e) { console.warn('addMarketplaceProduct error:', e); return false; }
  },

  async updateMarketplaceProduct(id, data) {
    try {
      await db.collection('marketplaceProducts').doc(id).update(data);
      await FB.logAdminActivity('marketplace_product_updated', { id });
      return true;
    } catch(e) { return false; }
  },

  async deleteMarketplaceProduct(id) {
    try {
      await db.collection('marketplaceProducts').doc(id).delete();
      await FB.logAdminActivity('marketplace_product_deleted', { id });
      return true;
    } catch(e) { return false; }
  },

  /* ── Product Requests (User submits → Admin reviews) ── */
  /* data: { productId, productName, productType, fullName, email, whatsapp, bkashNumber, transactionId } */
  async submitProductRequest(data) {
    if(!currentUser) return false;
    try {
      await db.collection('productRequests').add({
        uid: currentUser.uid,
        productId: data.productId,
        productName: data.productName,
        productType: data.productType,        /* free | paid */
        fullName: data.fullName,
        email: data.email,
        whatsapp: data.whatsapp,
        bkashNumber: data.bkashNumber || '',
        transactionId: data.transactionId || '',
        status: 'pending',                     /* pending | approved | rejected */
        deliveryMethod: '',
        deliveryContent: '',
        date: new Date().toISOString(),
      });
      return true;
    } catch(e) { console.warn('submitProductRequest error:', e); return false; }
  },

  async getProductRequests(status='all') {
    try {
      let q = db.collection('productRequests');
      if(status !== 'all') q = q.where('status','==',status);
      const snap = await q.orderBy('date','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      /* orderBy index না থাকলে fallback (unsorted) */
      try {
        let q = db.collection('productRequests');
        if(status !== 'all') q = q.where('status','==',status);
        const snap = await q.get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e2) { return []; }
    }
  },

  async getMyProductRequests() {
    if(!currentUser) return [];
    try {
      const snap = await db.collection('productRequests').where('uid','==',currentUser.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  /* Admin Approve — Delivery Method ('email'|'whatsapp') ও content/link/message সহ */
  async approveProductRequest(id, { deliveryMethod, deliveryContent } = {}) {
    try {
      const doc = await db.collection('productRequests').doc(id).get();
      const data = doc.data();
      await db.collection('productRequests').doc(id).update({
        status: 'approved',
        deliveryMethod: deliveryMethod || '',
        deliveryContent: deliveryContent || '',
        approvedAt: new Date().toISOString(),
      });
      if(data?.uid) {
        await FB.addNotification(data.uid, 'product_request_approved', {
          title: '✅ আপনার Product Request Approved!',
          body: `"${data.productName}" approve হয়েছে। Delivery: ${deliveryMethod==='email'?'📧 Email':'📱 WhatsApp'} এ পাঠানো হবে।`,
        });
        await FB.addNotification(data.uid, 'product_delivered', {
          title: '🚀 আপনার Product পাঠানো হয়েছে',
          body: deliveryContent || 'আপনার product পাঠানো হয়েছে, দেখে নিন।',
        });
      }
      await FB.logAdminActivity('product_request_approved', { id, productName: data?.productName });
      return true;
    } catch(e) { console.warn('approveProductRequest error:', e); return false; }
  },

  async rejectProductRequest(id, reason='') {
    try {
      const doc = await db.collection('productRequests').doc(id).get();
      const data = doc.data();
      await db.collection('productRequests').doc(id).update({
        status: 'rejected', rejectReason: reason, rejectedAt: new Date().toISOString(),
      });
      if(data?.uid) {
        await FB.addNotification(data.uid, 'product_request_rejected', {
          title: '❌ আপনার Product Request Reject হয়েছে',
          body: reason || `"${data.productName}" এর জন্য আপনার request reject করা হয়েছে।`,
        });
      }
      await FB.logAdminActivity('product_request_rejected', { id, productName: data?.productName });
      return true;
    } catch(e) { return false; }
  },

  /* ════════ NOTIFICATION SYSTEM ════════ */
  /* type: 'pro_approved' | 'pro_rejected' | 'product_request_approved' |
           'product_request_rejected' | 'product_delivered' |
           'membership_expiry_reminder' | 'membership_expired' */
  async addNotification(uid, type, { title, body, link='' } = {}) {
    if(!uid || !db) return;
    try {
      await db.collection('notifications').add({
        uid, type,
        title: title || '',
        body:  body  || '',
        link,
        read: false,
        date: new Date().toISOString(),
      });
    } catch(e) { console.warn('Notification create failed:', e); }
  },

  async getMyNotifications(limit=30) {
    if(!currentUser) return [];
    try {
      const snap = await db.collection('notifications')
        .where('uid','==',currentUser.uid)
        .orderBy('date','desc')
        .limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  async getUnreadNotificationCount() {
    if(!currentUser) return 0;
    try {
      const snap = await db.collection('notifications')
        .where('uid','==',currentUser.uid)
        .where('read','==',false)
        .get();
      return snap.size;
    } catch(e) { return 0; }
  },

  async markNotificationRead(id) {
    try { await db.collection('notifications').doc(id).update({ read: true }); }
    catch(e){}
  },

  async markAllNotificationsRead() {
    if(!currentUser) return;
    try {
      const snap = await db.collection('notifications')
        .where('uid','==',currentUser.uid)
        .where('read','==',false)
        .get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch(e){}
  },
};

/* ════════ AUTH FUNCTIONS ════════ */
async function registerUser(name, address, whatsapp, facebook, email, password) {
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    let userData = {
      uid: cred.user.uid,
      name, address,
      whatsapp: whatsapp||'',
      facebook: facebook||'',
      email,
      isPro: false,
      plan: 'free',
      banned: false,
      createdAt: new Date().toISOString(),
    };

    await db.collection('users').doc(cred.user.uid).set(userData);
    await cred.user.updateProfile({ displayName: name }).catch(()=>{});
    currentUserData = userData;

    /* এই email এর জন্য কোনো Pending Pro request আছে কিনা চেক করো — থাকলে activate করো
       (এটা fail করলেও user creation এ কোনো প্রভাব পড়বে না) */
    try {
      const pendingSnap = await db.collection('pendingPro').where('email','==',email).get();
      if(!pendingSnap.empty) {
        const pend = pendingSnap.docs[0].data();
        const expiryDate = FB.computeExpiryDate(pend.duration||'30', pend.customDate);
        const proUpdate = {
          isPro: true,
          plan: pend.plan || 'Pro Monthly',
          expiryDate,
          proActivatedAt: new Date().toISOString(),
        };
        await db.collection('users').doc(cred.user.uid).update(proUpdate);
        Object.assign(userData, proUpdate);
        currentUserData = userData;
        for(const d of pendingSnap.docs) await db.collection('pendingPro').doc(d.id).delete();
        await FB.addNotification(cred.user.uid, 'pro_approved', {
          title: '🎉 আপনার আগের Payment থেকে Pro Activate হয়েছে!',
          body: `Plan: ${userData.plan}${userData.expiryDate?' — মেয়াদ শেষ: '+new Date(userData.expiryDate).toLocaleDateString('bn-BD'):' — Lifetime'}`,
        });
      }
    } catch(e) { console.warn('pendingPro check failed (non-critical):', e); }

    return { success: true, ok: true };
  } catch(e) {
    console.error('registerUser error:', e.code, e.message);
    return { success: false, ok: false, error: getAuthError(e.code), msg: getAuthError(e.code) };
  }
}

/* Unified alias */
async function authRegister({name, address, whatsapp, facebook, email, password}){
  const r = await registerUser(name, address, whatsapp, facebook, email, password);
  return r.success ? {ok:true} : {ok:false, msg:r.error};
}

async function loginUser(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    return { success: true, ok: true };
  } catch(e) {
    console.error('loginUser error:', e.code, e.message);
    return { success: false, ok: false, error: getAuthError(e.code), msg: getAuthError(e.code) };
  }
}

async function authLogin(email, password){
  return await loginUser(email, password);
}

async function logoutUser() {
  await auth.signOut();
  currentUser = null;
  currentUserData = null;
  updateHeaderUser();
  Toast.success('Logout হয়েছে।');
}

async function authLogout(){
  await logoutUser();
}

async function sendPasswordReset(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true, ok: true };
  } catch(e) {
    return { success: false, ok: false, error: getAuthError(e.code), msg: getAuthError(e.code) };
  }
}

async function authForgotPassword(email){
  return await sendPasswordReset(email);
}

function getAuthError(code) {
  const errs = {
    'auth/email-already-in-use':  'এই email ইতোমধ্যে ব্যবহৃত।',
    'auth/invalid-email':         'সঠিক email দিন।',
    'auth/weak-password':         'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।',
    'auth/user-not-found':        'এই email-এ কোনো account নেই।',
    'auth/wrong-password':        'পাসওয়ার্ড ভুল।',
    'auth/invalid-credential':    'Email বা পাসওয়ার্ড ভুল।',
    'auth/too-many-requests':     'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।',
    'auth/network-request-failed':'ইন্টারনেট সংযোগ সমস্যা।',
  };
  return errs[code] || 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}

function getDefaultBanners(){
  return [
    {id:1,title:'🚀 Winning Products দ্রুত খুঁজুন',subtitle:'স্বয়ংক্রিয় গবেষণায় ecommerce সেরা পণ্য আবিষ্কার করুন',bg:'linear-gradient(135deg,#0369a1,#7c3aed)',cta:'গবেষণা শুরু করুন',link:'#tools',active:true},
    {id:2,title:'🎵 TikTok Viral Product Finder',subtitle:'TikTok Shop-এ trending products আগেই ধরুন',bg:'linear-gradient(135deg,#be185d,#7c3aed)',cta:'Products খুঁজুন',link:'#winning',active:true},
    {id:3,title:'📊 পূর্ণাঙ্গ Market Reports',subtitle:'মুহূর্তেই বিনিয়োগ-মানের বাজার বিশ্লেষণ তৈরি করুন',bg:'linear-gradient(135deg,#0f766e,#0369a1)',cta:'Report তৈরি করুন',link:'#tools',active:true},
  ];
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

/* ════════ ENGINE (OpenRouter) ════════ */
const Engine = {
  async getActiveKey(){
    /* Admin system key only — user-এর নিজস্ব key লাগবে না */
    await Store.loadApiKeyFromFirestore();
    const sysKey = Store.getApiKey();
    if(sysKey) return { key: sysKey, source: 'system' };
    return { key: '', source: 'none' };
  },

  async call(prompt){
    const { key } = await Engine.getActiveKey();
    if(key){
      try{ return await Engine.callOpenRouter(key, prompt); }
      catch(e){ console.warn('OpenRouter failed:', e.message); }
    }
    /* Claude API — always works */
    return await Engine.callClaude(prompt);
  },

  async callClaude(prompt){
    const lang = window._toolLang || 'Bengali';
    const systemMsg = 'You are an expert ecommerce AI assistant for Bangladesh market. ' +
      (lang==='Bengali' ? 'Respond in Bengali language.' : 'Respond in English.') +
      ' Always respond with valid JSON only. No markdown, no backticks, no explanation text outside JSON.';
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 4000,
          system: systemMsg,
          messages: [{ role: 'user', content: prompt +
            '\n\nIMPORTANT: Reply with ONLY valid JSON. No text before or after the JSON object.' }]
        })
      });
    } catch(e){ throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।'); }

    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(`AI Error (${res.status}): ${err.error?.message||'সমস্যা হয়েছে'}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g,'').trim();
    const fi = clean.indexOf('{'), li = clean.lastIndexOf('}');
    if(fi>-1&&li>fi){ try{ return JSON.parse(clean.slice(fi,li+1)); }catch{} }
    try{ return JSON.parse(clean); }catch{}
    throw new Error('ফলাফল parse করতে সমস্যা। আবার চেষ্টা করুন।');
  },

    async callOpenRouter(apiKey, prompt, modelIdx=0){
    const models = CONFIG.OPENROUTER_MODELS;
    const useModel = models[modelIdx] || models[0];
    const lang = window._toolLang || 'Bengali';
    const fullPrompt = prompt +
      `\n\nOUTPUT LANGUAGE: ${lang}. Write ALL text content in ${lang}. Only JSON field names stay in English.` +
      `\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks. Raw JSON only.`;
    let res;
    try {
      res = await fetch(CONFIG.OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer':  window.location.origin || 'https://nexora-pilot.vercel.app',
          'X-Title':       'NexoraPilot AI Tools'
        },
        body: JSON.stringify({
          model: useModel,
          messages: [{ role: 'user', content: fullPrompt }],
          temperature:  0.75,
          max_tokens:   4000,
        }),
      });
    } catch(e){ throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।'); }

    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      const msg = err.error?.message || '';
      const status = res.status;

      /* 401 = key ভুল */
      if(status===401) throw new Error('OpenRouter Key ভুল। Admin panel থেকে সঠিক key দিন।');

      /* 404/429/502/503 = model সমস্যা — পরেরটি try করো */
      const tryNext = status===404 || status===429 || status===502 || status===503 ||
        msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit') ||
        msg.toLowerCase().includes('provider') || msg.toLowerCase().includes('endpoint') ||
        msg.toLowerCase().includes('not found');

      if(tryNext){
        if(modelIdx + 1 < models.length){
          console.log(`[${status}] ${useModel} failed → trying ${models[modelIdx+1]}`);
          return await Engine.callOpenRouter(apiKey, prompt, modelIdx + 1);
        }
        throw new Error('সব AI model এ সমস্যা। ৫ মিনিট পরে চেষ্টা করুন।');
      }

      throw new Error(`AI Error (${status}): ${msg.substring(0,120) || 'অজানা সমস্যা'}`);
    }

    const data = await res.json();
    const raw   = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, m => m.replace(/```json|```/g,'').trim()).trim();
    /* JSON বের করো */
    const jsonMatch = clean.match(/[\s\S]*?(\{[\s\S]*\})/); 
    const jsonStr   = jsonMatch ? jsonMatch[1] : clean;
    try{ return JSON.parse(jsonStr); }
    catch{
      /* Last attempt: find first { and last } */
      const fi = clean.indexOf('{'); const li = clean.lastIndexOf('}');
      if(fi>-1 && li>fi){ try{ return JSON.parse(clean.slice(fi,li+1)); }catch{} }
      throw new Error('ফলাফল parse করতে সমস্যা। আবার চেষ্টা করুন।');
    }
  },

  /* AI Tools Usage Limitation System:
     Pro User → Unlimited (কোনো limit নেই)
     Normal User → Lifetime সর্বোচ্চ CONFIG.AI_TOOL_FREE_LIMIT (৩) বার, তারপর Locked */
  async checkLimit(){
    if(FB.isPro()) return true;
    if(!Store.getApiKey()) return false; /* system key ছাড়া চলবে না */
    return await FB.canUseAiTool();
  },

  async remaining(){
    if(FB.isPro()) return 999;
    return await FB.aiToolUsesRemaining();
  },
};

/* ════════ PROMPTS ════════ */
const Prompts = {
  product_research:(v)=>`You are a senior ecommerce product research analyst. Give a DETAILED, ACTIONABLE analysis.
Product: "${v.product||'posture corrector'}", Category: "${v.category||'health'}", Market: "${v.market||'Bangladesh'}"
Provide SPECIFIC numbers, real market insights, and concrete advice based on current ecommerce trends.
Return ONLY this JSON (all text values in the output language):
{"product_name":"exact product name","overall_score":82,"demand_score":80,"competition_score":65,"saturation_score":55,"trend_direction":"rising","verdict":"winner","summary":"3-4 sentence detailed market summary with specific insights","demand_analysis":"2-3 sentences about current demand with specific reasons","competition_analysis":"2-3 sentences about competition landscape","profit_margin_estimate":"35-55%","suggested_price_range":"specific price range for this market","target_audience":["specific demographic 1","specific demographic 2","specific demographic 3"],"key_selling_points":["compelling point 1 with detail","compelling point 2 with detail","compelling point 3 with detail","compelling point 4 with detail"],"risk_factors":["specific risk 1","specific risk 2","specific risk 3"],"recommendations":["actionable step 1","actionable step 2","actionable step 3","actionable step 4"],"marketing_channels":["best channel 1","best channel 2","best channel 3"],"estimated_monthly_sales":"realistic estimate for this market"}`,

  tiktok_viral:(v)=>`You are a TikTok ecommerce expert. Find HIGH-POTENTIAL viral products with specific content strategies.
Niche: "${v.niche||'beauty'}", Budget: "${v.budget||'medium'}", Market: "${v.market||'Bangladesh'}"
Return ONLY this JSON (all text in output language):
{"products":[{"rank":1,"product":"specific product name","viral_score":92,"trending_hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4"],"estimated_monthly_searches":45000,"video_view_potential":"high","hooks":["proven hook 1 that works","proven hook 2 that works","proven hook 3 that works"],"content_angle":"specific content strategy explanation","why_viral":"detailed explanation of virality potential","profit_potential":"high","suggested_price":"price range","content_ideas":["idea 1","idea 2","idea 3"]},{"rank":2,"product":"specific product name 2","viral_score":87,"trending_hashtags":["#hashtag1","#hashtag2","#hashtag3"],"estimated_monthly_searches":32000,"video_view_potential":"high","hooks":["hook 1","hook 2","hook 3"],"content_angle":"specific strategy","why_viral":"detailed explanation","profit_potential":"high","suggested_price":"price range","content_ideas":["idea 1","idea 2"]},{"rank":3,"product":"specific product name 3","viral_score":78,"trending_hashtags":["#hashtag1","#hashtag2"],"estimated_monthly_searches":18000,"video_view_potential":"medium","hooks":["hook 1","hook 2"],"content_angle":"strategy","why_viral":"explanation","profit_potential":"medium","suggested_price":"price range","content_ideas":["idea 1","idea 2"]}],"trending_categories":["category 1","category 2","category 3"],"action_plan":["step 1 with detail","step 2 with detail","step 3 with detail","step 4 with detail"]}`,

  ad_creative:(v)=>`You are an expert ad creative director for ecommerce brands. Create HIGH-CONVERTING ad creatives.
Product: "${v.product}", Platform: "${v.platform||'TikTok & Facebook'}", Target Audience: "${v.audience||'18-35'}", USP: "${v.usp||'not specified'}"
Write COMPLETE, READY-TO-USE copy — not templates with "...". Write actual compelling copy.
Return ONLY this JSON (all copy in output language):
{"ad_angles":[{"angle":"Pain Point Attack","emotion":"frustration","headline":"compelling headline addressing pain point","body_copy":"complete ad body copy 3-4 sentences addressing the problem and solution","cta":"specific call to action","why_works":"psychological reason this works"},{"angle":"Social Proof","emotion":"trust","headline":"social proof headline","body_copy":"complete copy using social proof","cta":"specific CTA","why_works":"psychological reason"},{"angle":"Curiosity Gap","emotion":"curiosity","headline":"curiosity-driven headline","body_copy":"complete copy that builds curiosity","cta":"specific CTA","why_works":"psychological reason"}],"tiktok_scripts":[{"hook":"attention-grabbing first 3 seconds","script":"complete 30-second script with actions and dialogue","duration":"30s","visual_direction":"specific visual instructions for each scene"},{"hook":"different viral hook","script":"another complete script","duration":"30s","visual_direction":"specific visual instructions"}],"facebook_ads":[{"headline":"facebook headline under 25 chars","primary_text":"complete facebook ad copy 3-5 sentences","cta_button":"Shop Now","image_direction":"specific image/video description"},{"headline":"second headline variant","primary_text":"alternative complete copy","cta_button":"Learn More","image_direction":"specific creative description"}],"ad_hooks":["scroll-stopping hook 1","scroll-stopping hook 2","scroll-stopping hook 3","scroll-stopping hook 4","scroll-stopping hook 5"]}`,

  ad_script:(v)=>`You are a professional direct response copywriter. Write a COMPLETE, WORD-FOR-WORD ad script.
Product: "${v.product}", Platform: "${v.platform||'TikTok'}", Duration: "${v.duration||'30s'}", Style: "${v.style||'UGC'}"
Write ACTUAL script content — not placeholders. Make it compelling and natural.
Return ONLY this JSON (all content in output language):
{"script":{"hook":"first 3-5 seconds word-for-word","problem":"15-20 second problem setup word-for-word","solution":"10-15 second solution reveal word-for-word","proof":"social proof or demonstration word-for-word","offer":"irresistible offer statement word-for-word","cta":"final call to action word-for-word","full_script":"COMPLETE script from start to finish, all scenes combined, word-for-word, ready to read on camera"},"b_roll_shots":["shot 1 with exact description","shot 2 with exact description","shot 3 with exact description","shot 4 with exact description","shot 5 with exact description"],"voiceover_tips":"specific delivery and tone instructions","music_suggestions":["mood/genre 1 with example","mood/genre 2","mood/genre 3"],"estimated_ctr":"realistic CTR range","performance_tips":["tip 1","tip 2","tip 3"]}`,

  product_description:(v)=>`You are an expert ecommerce copywriter. Write COMPLETE, SEO-OPTIMIZED product descriptions.
Product: "${v.product}", Features: "${v.features||'not specified'}", Target Buyer: "${v.buyer||'general'}", Tone: "${v.tone||'friendly'}"
Write ACTUAL compelling copy — not templates. All text must be complete and ready to use.
Return ONLY this JSON (all content in output language):
{"title":"complete SEO-optimized product title","tagline":"memorable one-line brand tagline","short_description":"2-3 sentence punchy short description for product listing","long_description":"complete 5-7 sentence detailed description covering all benefits, features, and emotional appeal","bullet_points":["benefit-focused point 1 with detail","benefit-focused point 2 with detail","benefit-focused point 3 with detail","benefit-focused point 4 with detail","benefit-focused point 5 with detail"],"seo_description":"150-160 character SEO meta description","emotional_copy":"3-4 sentences of emotional storytelling copy that connects with buyer","faqs":[{"q":"common question 1","a":"detailed answer 1"},{"q":"common question 2","a":"detailed answer 2"},{"q":"common question 3","a":"detailed answer 3"}],"keywords":["keyword 1","keyword 2","keyword 3","keyword 4","keyword 5","keyword 6","keyword 7","keyword 8"]}`,

  supplier_finder:(v)=>`You are a product sourcing expert. Provide SPECIFIC, ACTIONABLE supplier finding strategy.
Product: "${v.product}", Budget: "${v.budget||'medium'}", Quality: "${v.quality||'medium'}"
Return ONLY this JSON (all text in output language):
{"platforms":[{"name":"Alibaba","search_terms":["exact search term 1","exact search term 2","exact search term 3"],"tips":"specific tips for this platform and product","moq":"typical minimum order quantity","lead_time":"typical lead time"},{"name":"AliExpress","search_terms":["exact search term 1","exact search term 2"],"tips":"specific tips","moq":"typical MOQ","lead_time":"lead time"},{"name":"1688.com","search_terms":["Chinese search terms or phonetic"],"tips":"how to use this platform","moq":"typical MOQ","lead_time":"lead time"}],"verification_checklist":["check 1 with specific detail","check 2 with specific detail","check 3 with specific detail","check 4 with specific detail","check 5 with specific detail"],"red_flags":["red flag 1 to watch for","red flag 2","red flag 3","red flag 4"],"outreach_email":{"subject":"specific email subject for this product","body":"complete professional sourcing inquiry email, 3-4 paragraphs, ready to send"},"negotiation_tips":["negotiation tip 1 with specific tactic","negotiation tip 2","negotiation tip 3"],"estimated_cogs":"realistic cost of goods range","recommended_margin":"recommended profit margin","sample_order_advice":"specific advice on ordering samples"}`,

  competitor_analysis:(v)=>`You are a competitive intelligence analyst for ecommerce. Provide DEEP competitor insights.
Product: "${v.product}", Known Competitors: "${v.competitors||'unknown'}", Platform: "${v.platform||'Facebook/Instagram'}"
Return ONLY this JSON (all text in output language):
{"market_overview":"3-4 sentence overview of the competitive landscape","competitors":[{"name":"specific competitor name or type","estimated_monthly_revenue":"realistic revenue estimate","price_range":"price range they operate in","strengths":["strength 1","strength 2","strength 3"],"weaknesses":["weakness 1","weakness 2"],"review_score":4.2,"marketing_strategy":"how they market"},{"name":"competitor 2","estimated_monthly_revenue":"estimate","price_range":"range","strengths":["strength 1","strength 2"],"weaknesses":["weakness 1","weakness 2"],"review_score":3.8,"marketing_strategy":"their approach"},{"name":"competitor 3","estimated_monthly_revenue":"estimate","price_range":"range","strengths":["strength 1"],"weaknesses":["weakness 1","weakness 2","weakness 3"],"review_score":4.0,"marketing_strategy":"their approach"}],"market_gaps":["specific gap 1 you can exploit","specific gap 2","specific gap 3"],"differentiation_opportunities":["opportunity 1 with detail","opportunity 2 with detail","opportunity 3 with detail"],"entry_difficulty":"easy/medium/hard","win_strategy":["strategic step 1","strategic step 2","strategic step 3","strategic step 4"],"pricing_recommendation":"specific pricing strategy to beat competitors"}`,

  market_report:(v)=>`You are a senior market research analyst. Create a COMPREHENSIVE market research report.
Product/Niche: "${v.product}", Target Market: "${v.market||'Bangladesh'}", Budget Level: "${v.budget||'medium'}"
Return ONLY this JSON (all text in output language):
{"report_title":"professional report title","executive_summary":"4-5 sentence comprehensive executive summary with key findings","market_size":"specific market size estimate","growth_rate":"annual growth rate estimate","opportunity_score":78,"demand_prediction":"increasing/stable/declining","target_demographics":[{"segment":"specific demographic","size":"size estimate","pain_points":["pain 1","pain 2"],"buying_behavior":"how they buy"},{"segment":"second demographic","size":"estimate","pain_points":["pain 1","pain 2"],"buying_behavior":"how they buy"}],"market_trends":["specific trend 1 with explanation","specific trend 2","specific trend 3","specific trend 4"],"financial_projections":{"month1":"realistic first month projection","month3":"3-month projection","month6":"6-month projection","year1":"1-year projection"},"risk_assessment":[{"risk":"specific risk 1","probability":"high/medium/low","mitigation":"specific mitigation strategy"},{"risk":"specific risk 2","probability":"medium","mitigation":"mitigation strategy"},{"risk":"specific risk 3","probability":"low","mitigation":"mitigation strategy"}],"action_plan":[{"week":1,"actions":["specific action 1","specific action 2"]},{"week":2,"actions":["action 1","action 2"]},{"week":3,"actions":["action 1","action 2"]},{"week":4,"actions":["action 1","action 2"]}],"overall_recommendation":"3-4 sentence final recommendation with specific next steps"}`,

  post_generator:(v)=>`You are a social media expert for ecommerce brands. Write COMPLETE, ENGAGING posts ready to publish.
Product: "${v.product}", Features: "${v.features||''}", Language: "${v.lang||'Bengali'}"
Write ACTUAL post content in ${v.lang||'Bengali'} — not templates. Posts must be compelling and ready to copy-paste.
Return ONLY this JSON:
{"posts":[{"type":"emotional_storytelling","title":"post title","body":"complete engaging post body 4-6 lines with emojis, storytelling, and clear value proposition","cta":"specific call to action"},{"type":"problem_solution","title":"post title","body":"complete post body 4-6 lines addressing a problem and presenting the product as solution","cta":"specific CTA"},{"type":"social_proof","title":"post title","body":"complete post with social proof elements 4-6 lines","cta":"specific CTA"},{"type":"curiosity_hook","title":"post title","body":"complete curiosity-driven post 4-6 lines","cta":"specific CTA"},{"type":"urgency_offer","title":"post title","body":"complete urgency/offer post 4-6 lines","cta":"specific CTA"}],"hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5","#hashtag6","#hashtag7","#hashtag8"],"best_posting_time":"specific best time with reason","tips":["platform-specific tip 1","tip 2","tip 3"]}`,

  viral_post:(v)=>`You are a viral content strategist. Create HIGHLY SHAREABLE social media posts.
Topic: "${v.topic}", Platform: "${v.platform||'Facebook'}", Target: "${v.target||'general'}"
Write COMPLETE, ACTUAL post content — ready to publish. Make it genuinely viral-worthy.
Return ONLY this JSON (all content in output language):
{"viral_posts":[{"hook":"irresistible scroll-stopping opening line","body":"complete viral post body 5-8 lines with psychological triggers","cta":"compelling CTA","viral_factor":"specific reason this will spread","emotion_trigger":"curiosity/shock/humor/inspiration","expected_reach":"high/medium"},{"hook":"different viral hook type","body":"complete alternative viral post","cta":"CTA","viral_factor":"reason","emotion_trigger":"different emotion","expected_reach":"high"},{"hook":"third viral angle","body":"complete post with different angle","cta":"CTA","viral_factor":"reason","emotion_trigger":"emotion","expected_reach":"medium"}],"trending_elements":["element 1 to incorporate","element 2","element 3"],"timing_tip":"specific best posting time and frequency advice","engagement_boosters":["technique 1","technique 2","technique 3"]}`,

  promo_post:(v)=>`You are a promotional copywriter. Create URGENT, HIGH-CONVERTING promotional posts.
Product: "${v.product}", Offer Type: "${v.offer||'discount'}", Duration: "${v.duration||'48 hours'}", Platform: "${v.platform||'Facebook'}"
Write COMPLETE, READY-TO-USE promotional copy in output language. Include actual prices/percentages if mentioned.
Return ONLY this JSON (all content in output language):
{"promo_posts":[{"style":"urgency_scarcity","headline":"urgent promotional headline","body":"complete urgency-driven post 4-6 lines with countdown and scarcity elements","cta":"urgent CTA","countdown_text":"specific countdown message"},{"style":"value_stacking","headline":"value-focused headline","body":"complete post stacking all the value 4-6 lines","cta":"value-focused CTA"},{"style":"social_proof_offer","headline":"social proof headline","body":"complete post with social proof + offer 4-6 lines","cta":"trust-building CTA"}],"offer_headline":"punchy promotional headline","discount_angle":"specific angle to present the discount","hashtags":["#promo1","#promo2","#promo3","#promo4","#promo5"],"best_time_to_post":"specific timing advice for this offer type"}`,

  ad_copy:(v)=>`You are a direct response copywriter. Write HIGH-CONVERTING ad copy for multiple platforms.
Product: "${v.product}", Goal: "${v.goal||'sales'}", Audience: "${v.audience||'adults'}", Budget: "${v.budget||'medium'}"
Write COMPLETE, ACTUAL ad copy — not templates. Make it compelling and specific.
Return ONLY this JSON (all copy in output language):
{"facebook_ads":[{"headline":"FB headline max 40 chars","primary_text":"complete FB ad copy 3-5 sentences addressing pain point and offering solution","description":"2 sentence description","cta":"Shop Now","pain_point":"specific pain point addressed"},{"headline":"second headline variant","primary_text":"alternative complete copy different angle","description":"description","cta":"Learn More","pain_point":"different pain point"},{"headline":"third variant","primary_text":"complete copy third angle","description":"description","cta":"Get Offer","pain_point":"third pain point"}],"google_ads":[{"headline1":"H1 max 30 chars","headline2":"H2 max 30 chars","headline3":"H3 max 30 chars","description1":"D1 max 90 chars complete description","description2":"D2 max 90 chars second description","display_url":"brand.com/product"},{"headline1":"second set H1","headline2":"H2","headline3":"H3","description1":"D1 complete","description2":"D2 complete","display_url":"brand.com/offer"}],"power_words":["power word 1","power word 2","power word 3","power word 4","power word 5","power word 6"],"conversion_tips":["specific tip 1","specific tip 2","specific tip 3","specific tip 4"]}`,

  video_script:(v)=>`You are a professional video content creator and scriptwriter. Write a COMPLETE word-for-word video script.
Topic: "${v.topic}", Duration: "${v.duration||'3-5 min'}", Style: "${v.style||'educational'}", Platform: "${v.platform||'YouTube'}"
Write ACTUAL script content — every word the presenter should say. Make it engaging and valuable.
Return ONLY this JSON (all content in output language):
{"title":"click-worthy video title","intro":{"hook":"first 15 seconds word-for-word to grab attention","presenter_line":"complete introduction word-for-word","what_to_expect":"what viewers will learn word-for-word"},"body":[{"section":"section 1 name","content":"complete word-for-word script for this section 3-5 sentences","visual_cue":"specific visual/on-screen direction","duration_seconds":60},{"section":"section 2 name","content":"complete script 3-5 sentences","visual_cue":"specific visual direction","duration_seconds":60},{"section":"section 3 name","content":"complete script 3-5 sentences","visual_cue":"visual direction","duration_seconds":60},{"section":"section 4 name","content":"complete script 3-5 sentences","visual_cue":"visual direction","duration_seconds":60}],"outro":{"summary":"complete summary word-for-word","cta":"specific call to action word-for-word","subscribe_line":"subscribe/follow line word-for-word"},"b_roll_suggestions":["shot 1 description","shot 2","shot 3","shot 4","shot 5"],"thumbnail_idea":"specific thumbnail concept with colors and text","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"]}`,

  video_prompt:(v)=>`You are an AI video generation expert. Create PROFESSIONAL prompts for AI video tools.
Scene: "${v.scene}", Style: "${v.style||'cinematic'}", Duration: "${v.duration||'15 seconds'}"
Write DETAILED, SPECIFIC prompts that will generate high-quality videos.
Return ONLY this JSON:
{"prompts":[{"title":"Hero Product Shot","prompt":"highly detailed cinematic prompt: specific camera angle, lighting setup, background, product placement, color grade, motion, atmosphere - make it specific and vivid","negative_prompt":"what to avoid: blurry, distorted, bad quality, watermark, text","camera_movement":"specific camera movement","lighting":"specific lighting setup","mood":"specific mood/atmosphere"},{"title":"Lifestyle Scene","prompt":"detailed lifestyle/usage scene prompt with specific demographics, environment, action, emotion","negative_prompt":"avoid list","camera_movement":"camera motion","lighting":"lighting description","mood":"mood"},{"title":"Brand Aesthetic","prompt":"detailed brand/marketing focused prompt","negative_prompt":"avoid list","camera_movement":"motion","lighting":"lighting","mood":"mood"}],"style_tips":["specific tip 1 for this style","tip 2","tip 3"],"best_tool":"recommended AI video tool for this style","render_settings":"recommended settings"}`,

  storyboard:(v)=>`You are a professional video director and storyboard artist. Create a DETAILED production-ready storyboard.
Topic: "${v.topic}", Video Type: "${v.type||'product showcase'}", Duration: "${v.duration||'30 seconds'}"
Return ONLY this JSON (all content in output language):
{"title":"video title","concept":"3-4 sentence creative concept and overall vision","scenes":[{"scene_number":1,"duration_seconds":5,"visual":"detailed visual description - exactly what viewers see","audio":"exact dialogue or narration text","text_overlay":"on-screen text if any","camera_angle":"specific camera angle and movement","transition":"transition to next scene"},{"scene_number":2,"duration_seconds":6,"visual":"detailed visual","audio":"exact audio","text_overlay":"text","camera_angle":"angle","transition":"transition"},{"scene_number":3,"duration_seconds":6,"visual":"detailed visual","audio":"exact audio","text_overlay":"text","camera_angle":"angle","transition":"transition"},{"scene_number":4,"duration_seconds":7,"visual":"detailed visual","audio":"exact audio","text_overlay":"text","camera_angle":"angle","transition":"transition"},{"scene_number":5,"duration_seconds":6,"visual":"closing visual","audio":"closing audio","text_overlay":"final text/CTA","camera_angle":"angle","transition":"end"}],"music_mood":"specific music style and BPM","color_palette":["#hex1","#hex2","#hex3"],"director_notes":"specific production notes and tips"}`,

  subtitle_translator:(v)=>`You are a professional translator and localization expert.
Text to translate: "${v.text}", From: "${v.from||'English'}", To: "${v.to||'Bengali'}", Style: "${v.style||'natural conversational'}"
Translate accurately while preserving tone, emotion, and cultural context.
Return ONLY this JSON:
{"translated_lines":[{"original":"original text line","translated":"accurate translated text"},{"original":"second line","translated":"translation"}],"translation_notes":"specific translation decisions and choices made","cultural_adaptations":["adaptation 1 with explanation","adaptation 2"],"formality_level":"formal/informal/casual","alternative_phrases":[{"original":"phrase","alternative":"more natural alternative translation"},{"original":"phrase2","alternative":"alternative2"}],"localization_tips":["tip for this language pair 1","tip 2","tip 3"]}`,

  ad_funnel:(v)=>`You are a performance marketing expert. Design a COMPLETE, DATA-DRIVEN ad funnel strategy.
Product: "${v.product}", Daily Budget: "${v.budget||'medium (5000-10000 BDT/day)'}", Goal: "${v.goal||'sales'}", Timeline: "${v.timeline||'30 days'}"
Return ONLY this JSON (all content in output language):
{"funnel_overview":"4-5 sentence overview of the complete funnel strategy with expected results","stages":[{"stage":"Awareness (TOFU)","objective":"specific awareness objective","ad_type":"specific ad format","audience":"detailed audience description with interests and demographics","budget_percentage":"30%","content":"specific content strategy for this stage","kpi":"specific KPI to track","example_copy":"complete example ad copy for this stage"},{"stage":"Consideration (MOFU)","objective":"consideration objective","ad_type":"ad format","audience":"retargeting audience description","budget_percentage":"40%","content":"content strategy","kpi":"KPI","example_copy":"complete example copy"},{"stage":"Conversion (BOFU)","objective":"conversion objective","ad_type":"ad format","audience":"hot audience description","budget_percentage":"30%","content":"content strategy","kpi":"KPI","example_copy":"complete example copy"}],"retargeting_strategy":"detailed retargeting plan with specific windows and messaging","expected_roas":"realistic ROAS range with explanation","timeline":["week 1 activities","week 2 activities","week 3 activities","week 4 activities"],"scaling_strategy":"how to scale when profitable"}`,

  concept_architect:(v)=>`You are a business strategy consultant and marketing expert. Create a COMPREHENSIVE business blueprint.
Business Idea: "${v.idea}", Industry: "${v.industry||'ecommerce'}", Budget: "${v.budget||'startup'}", Goal: "${v.goal||'launch and grow'}"
Return ONLY this JSON (all content in output language):
{"concept_title":"compelling business concept name","executive_summary":"5-6 sentence comprehensive summary of the concept, opportunity, and path to success","unique_value_proposition":"specific, compelling UVP statement","target_market":{"primary":"detailed primary market description","secondary":"secondary market","psychographics":["psychographic 1","psychographic 2","psychographic 3","psychographic 4"],"market_size":"estimated addressable market"},"competitive_advantage":["advantage 1 with explanation","advantage 2","advantage 3","advantage 4"],"revenue_model":{"streams":["revenue stream 1 with detail","revenue stream 2","revenue stream 3"],"pricing_strategy":"specific pricing approach","projected_monthly":"realistic monthly revenue projection","break_even":"estimated break-even timeline"},"marketing_plan":{"phase1":"month 1-2 detailed marketing plan","phase2":"month 3-4 plan","phase3":"month 5-6 plan"},"action_items":[{"week":1,"tasks":["specific task 1","specific task 2","specific task 3"]},{"week":2,"tasks":["task 1","task 2","task 3"]},{"week":3,"tasks":["task 1","task 2","task 3"]},{"week":4,"tasks":["task 1","task 2"]}],"success_metrics":["metric 1 with target","metric 2 with target","metric 3 with target","metric 4 with target"],"risk_mitigation":["risk 1 and specific mitigation","risk 2 and mitigation","risk 3 and mitigation"]}`,
};

/* ════════ RENDER HELPERS ════════ */
const R = {
  skeleton(n=3){ return Array(n).fill(0).map(()=>`<div class="card mb-2" style="padding:18px"><div class="skeleton mb-2" style="height:13px;width:55%"></div><div class="skeleton mb-1" style="height:11px;width:88%"></div><div class="skeleton" style="height:11px;width:70%"></div></div>`).join(''); },
  error(msg){ return `<div class="alert alert-error"><span>⚠️</span><div><strong>সমস্যা হয়েছে:</strong> ${msg}</div></div>`; },
  limitReached(){ return `<div class="alert alert-warning" style="flex-direction:column;gap:12px"><div>🔒 <strong>আপনার ফ্রি ব্যবহার শেষ (${CONFIG.AI_TOOL_FREE_LIMIT}/${CONFIG.AI_TOOL_FREE_LIMIT})</strong></div><div style="font-size:.85rem;color:var(--text2)">Normal User হিসেবে আপনি সর্বোচ্চ ${CONFIG.AI_TOOL_FREE_LIMIT} বার AI Tool ব্যবহার করতে পারেন। Unlimited ব্যবহারের জন্য Pro Membership নিন।</div><button class="btn btn-primary btn-sm" onclick="showPaymentModal()">🚀 মাত্র ৳১৯৯/মাসে Pro নিন</button></div>`; },
  noKey(){ return `<div class="alert alert-warning"><span>⚙️</span><div>সিস্টেম এখনো প্রস্তুত নয়। Admin-এর সাথে যোগাযোগ করুন।</div></div>`; },
  scoreBar(score,color='var(--a1)'){ const p=Math.min(100,Math.max(0,score)); const c=p>=75?'var(--a1)':p>=50?'var(--a3)':'#f87171'; return `<div class="meter-row"><div class="progress-bar"><div class="progress-fill" style="width:${p}%;background:${color||c}"></div></div><span class="meter-val" style="color:${color||c}">${p}</span></div>`; },
  scoreCircle(s){ const c=s>=75?'var(--a1)':s>=50?'var(--a3)':'#f87171'; return `<div class="score-ring" style="background:rgba(0,0,0,.28);border:3px solid ${c};color:${c}">${s}</div>`; },
  tags(items,cls='tag-mint'){ return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${(items||[]).map(t=>`<span class="tag ${cls}">${t}</span>`).join('')}</div>`; },
  list(items,icon='→'){ return `<ul style="list-style:none;padding:0">${(items||[]).map(i=>`<li style="padding:5px 0;font-size:.86rem;color:var(--text2);display:flex;gap:8px"><span style="color:var(--a1);flex-shrink:0">${icon}</span>${i}</li>`).join('')}</ul>`; },
  copyBox(text,label='Copy'){ const id='cb_'+Math.random().toString(36).slice(2); return `<div class="copy-box"><div id="${id}" class="copy-box-inner">${text||''}</div><button class="copy-btn" onclick="copyText(document.getElementById('${id}').textContent,this)">${label}</button></div>`; },
};

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

async function updateHeaderUser(){ await updateUsageDisplay(); }

async function updateUsageDisplay(){
  const r = await Engine.remaining();
  const isPro = FB.isPro();
  const isLoggedIn = !!currentUser;
  const hasUserKey = !!(await FB.getUserApiKey());
  document.querySelectorAll('.usage-display').forEach(el=>{
    el.textContent = isPro ? '∞ Pro' : `${r}/${CONFIG.AI_TOOL_FREE_LIMIT}`;
    el.style.color  = isPro ? 'var(--a1)' : r>0 ? 'var(--a3)' : '#f87171';
  });
  const badge=document.getElementById('proBadge');
  if(badge){ badge.style.display=isPro?'inline-flex':'none'; }
  const upgradeBtn=document.getElementById('upgradeBtn');
  if(upgradeBtn){ upgradeBtn.style.display=isPro?'none':'inline-flex'; }

  /* Show user display in header — works with both ID names */
  const userDisplay = document.getElementById('headerUserArea') || document.getElementById('headerUserDisplay');
  if(userDisplay){
    if(isLoggedIn && currentUserData){
      const nm = (currentUserData.name||'User').split(' ')[0];
      const unreadCount = await FB.getUnreadNotificationCount();
      userDisplay.innerHTML=`
        <button class="notif-bell-btn" onclick="openNotificationPanel()" title="Notifications" style="position:relative;background:none;border:1px solid var(--border);border-radius:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text3);flex-shrink:0">
          🔔${unreadCount>0?`<span style="position:absolute;top:-4px;right:-4px;background:#f87171;color:#fff;border-radius:10px;font-size:.6rem;font-weight:900;padding:1px 5px;min-width:16px">${unreadCount}</span>`:''}</button>
        <div class="usage-pill" style="flex-shrink:0" title="AI Tool ব্যবহার">
          <span class="glow-dot ${isPro?'mint':'violet'}"></span>
          <span style="color:${isPro?'var(--a1)':r>0?'var(--a3)':'#f87171'}">${isPro?'∞':`${r}/${CONFIG.AI_TOOL_FREE_LIMIT}`}</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;flex-shrink:0">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--a1),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;color:#0a0a14;flex-shrink:0">${nm.charAt(0).toUpperCase()}</div>
          <span class="hdr-username" style="font-size:.84rem;font-weight:700;color:#fff;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nm}</span>
          ${isPro?'<span class="tag tag-mint" style="font-size:.65rem;padding:2px 7px">PRO</span>':''}
          <button class="btn btn-sm btn-secondary" style="padding:4px 10px;font-size:.75rem" onclick="authLogout()">Logout</button>
        </div>`;
    } else {
      userDisplay.innerHTML=`
        <button class="btn btn-primary btn-sm" style="padding:7px 16px;font-size:.82rem" onclick="openAuthModal('login')">🔐 Login</button>
        <button class="btn btn-secondary btn-sm" style="margin-left:4px;padding:7px 14px;font-size:.82rem" onclick="openAuthModal('register')">✅ Register</button>`;
    }
  }
}

/* ════════ AUTH MODAL (Login + Register) ════════ */
function showAuthModal(tab='login'){
  openAuthModal(tab);
}

function openAuthModal(tab='login'){
  Modal.show('authModal');
  _setAuthTab(tab);
}

function _setAuthTab(tab){
  /* Support both naming conventions */
  ['login','register','forgot'].forEach(t=>{
    const el = document.getElementById('authForm_'+t);
    if(el) el.classList.toggle('hidden', t!==tab);
  });
  /* Legacy IDs */
  document.getElementById('authLoginForm')?.classList.toggle('hidden', tab!=='login');
  document.getElementById('authRegForm')?.classList.toggle('hidden', tab!=='register');
  document.getElementById('authForgotForm')?.classList.toggle('hidden', tab!=='forgot');

  document.getElementById('authTab_login')?.classList.toggle('active', tab==='login');
  document.getElementById('authTab_reg')?.classList.toggle('active', tab==='register');
  document.getElementById('authTabLogin')?.classList.toggle('active', tab==='login');
  document.getElementById('authTabReg')?.classList.toggle('active', tab==='register');
}

function switchAuthTab(tab){ _setAuthTab(tab); }

async function doLogin(){
  /* Support both ID conventions */
  const email = (document.getElementById('li_email')||document.getElementById('loginEmail'))?.value?.trim().toLowerCase();
  const pass  = (document.getElementById('li_pass') ||document.getElementById('loginPass'))?.value;
  if(!email||!pass){ Toast.error('Email ও পাসওয়ার্ড দিন'); return; }
  const btn = document.getElementById('li_btn')||document.getElementById('loginBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Login হচ্ছে...'; }
  const res = await authLogin(email, pass);
  if(btn){ btn.disabled=false; btn.textContent='🔐 Login করুন'; }
  if(res.ok){
    Modal.hideAll();
    Toast.success('স্বাগতম! Login সফল হয়েছে ✅');
  } else {
    Toast.error(res.msg||res.error||'সমস্যা হয়েছে');
  }
}

async function doRegister(){
  /* Support both ID conventions */
  const name     = (document.getElementById('re_name')    ||document.getElementById('regName'))?.value?.trim();
  const address  = (document.getElementById('re_address') ||document.getElementById('regAddress'))?.value?.trim();
  const whatsapp = (document.getElementById('re_whatsapp')||document.getElementById('regPhone'))?.value?.trim();
  const facebook = (document.getElementById('re_facebook')||document.getElementById('regFbLink'))?.value?.trim();
  const email    = (document.getElementById('re_email')   ||document.getElementById('regEmail'))?.value?.trim().toLowerCase();
  const pass     = (document.getElementById('re_pass')    ||document.getElementById('regPass'))?.value;
  const pass2    = (document.getElementById('re_pass2')   ||document.getElementById('regPass2'))?.value;

  if(!name||!address||!whatsapp||!email||!pass){ Toast.error('নাম, ঠিকানা, WhatsApp নম্বর, email ও পাসওয়ার্ড আবশ্যক'); return; }
  if(!email.includes('@')){ Toast.error('সঠিক email দিন'); return; }
  if(pass.length<6){ Toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে'); return; }
  if(pass !== pass2){ Toast.error('পাসওয়ার্ড দুটো মিলছে না'); return; }

  const btn = document.getElementById('re_btn')||document.getElementById('regBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Account তৈরি হচ্ছে...'; }

  /* Try new authRegister first, fallback to registerUser */
  let res;
  if(typeof authRegister === 'function'){
    res = await authRegister({name, address, whatsapp, facebook, email, password:pass});
    res = res.ok ? {success:true} : {success:false, error:res.msg};
  } else {
    res = await registerUser(name, address, whatsapp, facebook, email, pass);
  }

  if(btn){ btn.disabled=false; btn.textContent='✅ Account তৈরি করুন'; }
  if(res.success||res.ok){
    Modal.hideAll();
    Toast.success('Account তৈরি হয়েছে! স্বাগতম 🎉');
    showWhatsappWelcomeModal();
  } else {
    Toast.error(res.error||res.msg||'সমস্যা হয়েছে');
  }
}

/* নতুন Register করা User কে WhatsApp Community Group এ জয়েন করার invite দেখায় */
function showWhatsappWelcomeModal(){
  if(!document.getElementById('waWelcomeModal')){
    const m = document.createElement('div');
    m.className = 'modal-overlay hidden';
    m.id = 'waWelcomeModal';
    m.innerHTML = `
      <div class="modal-box" style="max-width:420px;text-align:center">
        <div class="modal-header" style="justify-content:flex-end;border:none;padding-bottom:0">
          <button class="modal-close" onclick="Modal.hideAll()">✕</button>
        </div>
        <div style="padding:0 8px 8px">
          <div style="font-size:2.5rem;margin-bottom:12px">🎉</div>
          <h3 style="margin-bottom:8px">স্বাগতম NexoraPilot-এ!</h3>
          <p style="color:var(--text2);font-size:.86rem;margin-bottom:20px">নতুন Product, Update বা Announcement সবার আগে জানতে আমাদের WhatsApp Community Group এ জয়েন করুন।</p>
          <a href="${CONFIG.WHATSAPP_GROUP_LINK}" target="_blank" class="btn btn-primary btn-full" style="background:linear-gradient(135deg,#25D366,#128C7E)" onclick="Modal.hideAll()">📲 WhatsApp Group এ জয়েন করুন</a>
          <button style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:.8rem;margin-top:12px" onclick="Modal.hideAll()">পরে করব</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e=>{ if(e.target===m) m.classList.add('hidden'); });
  }
  Modal.show('waWelcomeModal');
}

async function doForgotPassword(){
  const email = (document.getElementById('fp_email')||document.getElementById('forgotEmail'))?.value?.trim().toLowerCase();
  if(!email){ Toast.error('Email দিন'); return; }
  const btn = document.getElementById('fp_btn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ পাঠানো হচ্ছে...'; }
  const res = await authForgotPassword(email);
  if(btn){ btn.disabled=false; btn.textContent='📧 Reset Link পাঠান'; }
  if(res.ok||res.success){
    Toast.success('Password reset email পাঠানো হয়েছে! ✅');
    _setAuthTab('login');
  } else {
    Toast.error(res.msg||res.error||'সমস্যা হয়েছে');
  }
}

/* ════════ PAYMENT MODAL ════════ */
function showPaymentModal(){ Modal.show('paymentModal'); renderPaymentStep1(); }
function showUpgradeModal(){ showPaymentModal(); }
function renderPayStep1(){ renderPaymentStep1(); }

function renderPaymentStep1(){
  /* bKash number ─ Firestore settings থেকে, fallback localStorage */
  const bkash = window._cachedBkash || Store.getBkashNumber();
  const el = document.getElementById('paymentContent');
  if(!el) return;
  const userName  = currentUserData?.name  || (currentUser?.email?.split('@')[0]) || '';
  const userEmail = currentUser?.email     || '';
  const userPhone = currentUserData?.whatsapp || '';

  el.innerHTML = `
    <!-- Plan selector -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
      <div class="plan-opt active" id="plan_monthly" onclick="selectPlan('monthly',this)" style="background:rgba(0,245,212,.08);border:2px solid var(--a1);border-radius:12px;padding:14px;text-align:center;cursor:pointer">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:4px">মাসিক</div>
        <div style="font-family:var(--font-h);font-size:1.3rem;font-weight:900;color:var(--a1)">৳১৯৯</div>
        <div style="font-size:.7rem;color:var(--text2)">/মাস</div>
      </div>
      <div class="plan-opt" id="plan_yearly" onclick="selectPlan('yearly',this)" style="background:rgba(0,0,0,.2);border:2px solid var(--border);border-radius:12px;padding:14px;text-align:center;cursor:pointer">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:4px">বার্ষিক</div>
        <div style="font-family:var(--font-h);font-size:1.3rem;font-weight:900;color:#fff">৳১,৯৯৯</div>
        <div style="font-size:.7rem;color:var(--a1)">মাত্র ৳১৬৬/মাস</div>
      </div>
      <div class="plan-opt" id="plan_agency" onclick="selectPlan('agency',this)" style="background:rgba(0,0,0,.2);border:2px solid var(--border);border-radius:12px;padding:14px;text-align:center;cursor:pointer">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:4px">Agency</div>
        <div style="font-family:var(--font-h);font-size:1.3rem;font-weight:900;color:#a78bfa">৳৪৯৯</div>
        <div style="font-size:.7rem;color:var(--text2)">/মাস</div>
      </div>
    </div>

    <!-- bKash instruction box -->
    <div style="background:linear-gradient(135deg,rgba(236,72,153,.15),rgba(124,58,237,.1));border:1px solid rgba(236,72,153,.35);border-radius:14px;padding:18px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="font-size:1.6rem">📱</div>
        <div>
          <div style="font-weight:800;color:#fff;font-size:.92rem">bKash Send Money করুন</div>
          <div style="font-size:.78rem;color:var(--text2)">নিচের নম্বরে পাঠান</div>
        </div>
      </div>
      <div style="background:rgba(0,0,0,.3);border-radius:10px;padding:12px 16px;text-align:center;margin-bottom:10px">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:4px">bKash Number</div>
        <div style="font-family:var(--font-h);font-size:1.6rem;font-weight:900;color:#f472b6;letter-spacing:3px" id="payBkashNum">${bkash}</div>
        <button onclick="navigator.clipboard.writeText('${bkash}').then(()=>Toast.success('Copied!'))" style="background:rgba(244,114,182,.1);border:1px solid rgba(244,114,182,.3);border-radius:6px;color:#f472b6;padding:4px 12px;font-size:.72rem;cursor:pointer;margin-top:6px">📋 Copy Number</button>
      </div>
      <div style="font-size:.82rem;color:var(--text2);display:grid;gap:5px;padding:0 4px">
        <div style="display:flex;align-items:center;gap:8px"><span style="color:var(--a1);font-weight:800">১.</span> bKash App খুলুন → <strong style="color:#fff">Send Money</strong></div>
        <div style="display:flex;align-items:center;gap:8px"><span style="color:var(--a1);font-weight:800">২.</span> নম্বর: <strong style="color:#f472b6">${bkash}</strong> দিন</div>
        <div style="display:flex;align-items:center;gap:8px"><span style="color:var(--a1);font-weight:800">৩.</span> Amount দিন (নির্বাচিত plan অনুযায়ী)</div>
        <div style="display:flex;align-items:center;gap:8px"><span style="color:var(--a1);font-weight:800">৪.</span> Reference: আপনার <strong style="color:#fff">Email</strong> লিখুন</div>
        <div style="display:flex;align-items:center;gap:8px"><span style="color:var(--a1);font-weight:800">৫.</span> Transaction ID নিচে দিন → Submit করুন</div>
      </div>
    </div>

    <!-- User info form -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">আপনার নাম *</label>
        <input class="form-control" id="pay-name" placeholder="পূর্ণ নাম" value="${userName}">
      </div>
      <div class="form-group">
        <label class="form-label">Email *</label>
        <input class="form-control" id="pay-email" type="email" placeholder="you@example.com" value="${userEmail}">
      </div>
      <div class="form-group">
        <label class="form-label">আপনার Phone *</label>
        <input class="form-control" id="pay-phone" type="tel" placeholder="01XXXXXXXXX" value="${userPhone}">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">💳 bKash Transaction ID *</label>
      <input class="form-control" id="pay-txn" placeholder="e.g., 8N6X1J2ABC" style="letter-spacing:2px;font-family:monospace;font-size:1rem" oninput="this.value=this.value.toUpperCase()">
      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">Payment করার পর bKash থেকে পাওয়া Transaction ID লিখুন</div>
    </div>

    <input type="hidden" id="pay-plan-val" value="monthly">

    <button class="btn btn-primary btn-full" id="pay-submit-btn" onclick="submitPayment()" style="background:linear-gradient(135deg,#ec4899,#7c3aed);margin-top:4px">
      📤 Payment Submit করুন
    </button>
    <p style="text-align:center;font-size:.76rem;color:var(--text2);margin-top:10px">
      ✅ Admin verify করলে <strong style="color:#fff">২-১২ ঘণ্টার</strong> মধ্যে activate হবে
    </p>`;

  /* Load bKash from Firestore if not cached */
  if(!window._cachedBkash && db){
    db.collection('settings').doc('config').get().then(snap=>{
      if(snap.exists && snap.data().bkashNumber){
        window._cachedBkash = snap.data().bkashNumber;
        const el2 = document.getElementById('payBkashNum');
        if(el2) el2.textContent = window._cachedBkash;
      }
    }).catch(()=>{});
  }
}

function selectPlan(plan, el){
  document.querySelectorAll('.plan-opt').forEach(x=>{
    x.style.background='rgba(0,0,0,.2)';
    x.style.border='2px solid var(--border)';
  });
  el.style.background = plan==='agency'?'rgba(124,58,237,.12)':'rgba(0,245,212,.08)';
  el.style.border      = plan==='agency'?'2px solid rgba(124,58,237,.5)':'2px solid var(--a1)';
  document.getElementById('pay-plan-val').value = plan;
}

async function submitPayment(){
  const name  = document.getElementById('pay-name')?.value?.trim();
  const email = document.getElementById('pay-email')?.value?.trim();
  const phone = document.getElementById('pay-phone')?.value?.trim();
  const txn   = document.getElementById('pay-txn')?.value?.trim().toUpperCase();
  const plan  = document.getElementById('pay-plan-val')?.value || 'monthly';

  if(!name)  { Toast.error('নাম দিন'); return; }
  if(!email||!email.includes('@')){ Toast.error('সঠিক email দিন'); return; }
  if(!phone) { Toast.error('Phone নম্বর দিন'); return; }
  if(!txn||txn.length < 5){ Toast.error('Transaction ID দিন (কমপক্ষে ৫ অক্ষর)'); return; }

  const amountMap = {monthly:'৳১৯৯', yearly:'৳১,৯৯৯', agency:'৳৪৯৯'};
  const planMap   = {monthly:'Pro Monthly', yearly:'Pro Annual', agency:'Agency'};
  const bkash     = Store.getBkashNumber();

  const btn = document.getElementById('pay-submit-btn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Submit হচ্ছে...'; }

  try {
    await FB.addPayment({
      name, email, phone,
      plan:     planMap[plan],
      planCode: plan,
      txnId:    txn,
      amount:   amountMap[plan],
      bkashTo:  bkash,
      uid:      currentUser?.uid || null,
    });
    await FB.logEvent('payment_submit',{name,email,plan,txn});

    document.getElementById('paymentContent').innerHTML = `
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:3.5rem;margin-bottom:14px">✅</div>
        <div style="font-family:var(--font-h);font-size:1.25rem;font-weight:900;color:#fff;margin-bottom:10px">Payment Submit হয়েছে!</div>
        <div style="background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:12px;padding:16px;margin-bottom:18px;font-size:.87rem">
          <div style="display:grid;gap:8px;text-align:left">
            <div><span style="color:var(--text2)">নাম:</span> <strong style="color:#fff">${name}</strong></div>
            <div><span style="color:var(--text2)">Email:</span> <strong style="color:var(--a1)">${email}</strong></div>
            <div><span style="color:var(--text2)">Plan:</span> <strong style="color:#fff">${planMap[plan]} (${amountMap[plan]})</strong></div>
            <div><span style="color:var(--text2)">TrxID:</span> <strong style="color:#f472b6;font-family:monospace">${txn}</strong></div>
          </div>
        </div>
        <p style="font-size:.83rem;color:var(--text2);margin-bottom:18px">Admin verify করলে <strong style="color:#fff">২-১২ ঘণ্টার</strong> মধ্যে আপনার account activate হবে।</p>
        <button class="btn btn-secondary" onclick="Modal.hideAll()">✕ বন্ধ করুন</button>
      </div>`;
    Toast.success('Payment submit হয়েছে! ✅');
  } catch(e){
    if(btn){ btn.disabled=false; btn.textContent='📤 Payment Submit করুন'; }
    Toast.error('Submit করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    console.error('Payment error:', e);
  }
}

/* ════════ SUPPORT CHAT ════════ */
function toggleSupport(){
  const panel = document.getElementById('supportPanel');
  if(!panel) return;
  const isOpen = panel.classList.toggle('open');
  if(isOpen){
    const body = document.getElementById('supportBody');
    if(body && !body.innerHTML.trim()) body.innerHTML = supportBodyHTML();
  }
}
function supportBodyHTML(){
  const nm = currentUserData?.name||'';
  const em = currentUser?.email||'';
  const waMsg = encodeURIComponent('NexoraPilot থেকে যোগাযোগ করছি। ' + (nm ? 'আমার নাম '+nm+'।' : '') + ' আমার সমস্যা হলো: ');
  return `
<a href="https://wa.me/8801859393487?text=${waMsg}" target="_blank"
  style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(37,211,102,.12),rgba(18,140,126,.08));border:1.5px solid rgba(37,211,102,.35);border-radius:12px;padding:14px 16px;text-decoration:none;margin-bottom:14px;transition:all .2s"
  onmouseover="this.style.background='linear-gradient(135deg,rgba(37,211,102,.2),rgba(18,140,126,.14))'"
  onmouseout="this.style.background='linear-gradient(135deg,rgba(37,211,102,.12),rgba(18,140,126,.08))'">
  <span style="font-size:1.7rem;line-height:1">📲</span>
  <div>
    <div style="font-weight:800;color:#25D366;font-size:.9rem">WhatsApp-এ সরাসরি কথা বলুন</div>
    <div style="font-size:.78rem;color:var(--text2);margin-top:2px">+880 1859-393487 · সবচেয়ে দ্রুত সাড়া পাবেন</div>
  </div>
  <span style="margin-left:auto;color:#25D366;font-size:1.1rem">→</span>
</a>
<div style="text-align:center;color:var(--text2);font-size:.76rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
  <div style="flex:1;height:1px;background:var(--border)"></div>
  অথবা বার্তা রেখে যান
  <div style="flex:1;height:1px;background:var(--border)"></div>
</div>
<div class="form-group"><label class="form-label">আপনার নাম</label><input class="form-control" id="supp-name" placeholder="নাম লিখুন" value="${nm}"></div>
<div class="form-group"><label class="form-label">Email</label><input class="form-control" id="supp-email" type="email" placeholder="you@example.com" value="${em}"></div>
<div class="form-group"><label class="form-label">বার্তা</label><textarea class="form-control" id="supp-msg" rows="3" placeholder="কীভাবে সাহায্য করতে পারি?"></textarea></div>
<button class="btn btn-primary btn-full btn-sm" onclick="submitSupportMsg()">📤 বার্তা পাঠান</button>`;
}
async function submitSupportMsg(){
  const name  = document.getElementById('supp-name')?.value?.trim();
  const email = document.getElementById('supp-email')?.value?.trim();
  const msg   = document.getElementById('supp-msg')?.value?.trim();
  if(!name||!email||!msg){ Toast.error('সব তথ্য পূরণ করুন'); return; }
  await FB.addHelp({name,email,message:msg,category:'Support Chat'});
  await FB.logEvent('support_chat',{name,email});
  const body=document.getElementById('supportBody');
  if(body) body.innerHTML=`<div class="alert alert-success"><span>✅</span><div><strong>পাঠানো হয়েছে!</strong><br>কয়েক ঘণ্টার মধ্যে reply পাবেন।</div></div>`;
  setTimeout(()=>{ if(body) body.innerHTML=supportBodyHTML(); },5000);
}

/* ════════ NOTIFICATION CENTER (UI) ════════ */
const NOTIF_ICONS = {
  pro_approved: '🎉', pro_rejected: '❌',
  product_request_approved: '📦', product_request_rejected: '🚫',
  product_delivered: '🚀', membership_expiry_reminder: '⏰',
  membership_expired: '⌛',
};

function notifTimeAgo(iso){
  try{
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs/60000);
    if(mins < 1) return 'এখনই';
    if(mins < 60) return `${mins} মিনিট আগে`;
    const hrs = Math.floor(mins/60);
    if(hrs < 24) return `${hrs} ঘণ্টা আগে`;
    const days = Math.floor(hrs/24);
    return `${days} দিন আগে`;
  }catch(e){ return ''; }
}

function renderNotificationList(items){
  if(!items.length){
    return `<div style="text-align:center;padding:40px 20px;color:var(--text2)">
      <div style="font-size:2.5rem;margin-bottom:10px">🔔</div>
      <p>কোনো notification নেই।</p>
    </div>`;
  }
  return items.map(n=>`
    <div onclick="handleNotifClick('${n.id}','${n.link||''}')" style="display:flex;gap:12px;padding:14px 6px;border-bottom:1px solid var(--border);cursor:pointer;${n.read?'opacity:.6':''}">
      <div style="width:38px;height:38px;border-radius:50%;background:rgba(0,245,212,.08);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${NOTIF_ICONS[n.type]||'🔔'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;color:#fff;font-size:.86rem;display:flex;align-items:center;gap:6px">${n.title||''}${!n.read?'<span style="width:7px;height:7px;border-radius:50%;background:var(--a1);flex-shrink:0"></span>':''}</div>
        <div style="font-size:.8rem;color:var(--text2);margin-top:3px;line-height:1.5">${n.body||''}</div>
        <div style="font-size:.7rem;color:var(--text2);margin-top:5px">${notifTimeAgo(n.date)}</div>
      </div>
    </div>`).join('');
}

async function openNotificationPanel(){
  const el = document.getElementById('notificationListContent');
  if(!el) return; /* এই page এ panel না থাকলে skip */
  el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text2)">⏳ লোড হচ্ছে...</div>';
  Modal.show('notificationModal');
  const items = await FB.getMyNotifications();
  el.innerHTML = renderNotificationList(items);
}

async function handleNotifClick(id, link){
  await FB.markNotificationRead(id);
  await updateUsageDisplay();
  if(link){ window.location.href = link; }
}

async function markAllNotifRead(){
  await FB.markAllNotificationsRead();
  await updateUsageDisplay();
  const el = document.getElementById('notificationListContent');
  if(el){
    const items = await FB.getMyNotifications();
    el.innerHTML = renderNotificationList(items);
  }
  Toast.success('সব Notification Read করা হয়েছে।');
}

function initBanners(){
  const banners=Store.getBanners().filter(b=>b.active);
  const container=document.getElementById('bannerSlider');
  if(!container||!banners.length)return;
  container.innerHTML=banners.map((b,i)=>`<div class="banner-slide ${i===0?'active':''}" id="bs-${i}" style="background:${b.bg}"><div class="banner-content"><h2>${b.title}</h2><p>${b.subtitle}</p><a href="${b.link||'#'}" class="btn btn-primary">${b.cta||'শুরু করুন'}</a></div></div>`).join('')+
    `<button class="banner-arr banner-prev" onclick="slideBanner(-1)">‹</button><button class="banner-arr banner-next" onclick="slideBanner(1)">›</button><div class="banner-nav">${banners.map((_,i)=>`<div class="banner-dot ${i===0?'active':''}" onclick="goBanner(${i})"></div>`).join('')}</div>`;
  setInterval(()=>slideBanner(1),5500);
}
function slideBanner(dir){ const s=document.querySelectorAll('.banner-slide'),d=document.querySelectorAll('.banner-dot'); if(!s.length)return; s[bannerIdx].classList.remove('active'); d[bannerIdx]?.classList.remove('active'); bannerIdx=(bannerIdx+dir+s.length)%s.length; s[bannerIdx].classList.add('active'); d[bannerIdx]?.classList.add('active'); }
function goBanner(i){ const s=document.querySelectorAll('.banner-slide'),d=document.querySelectorAll('.banner-dot'); s[bannerIdx]?.classList.remove('active'); d[bannerIdx]?.classList.remove('active'); bannerIdx=i; s[i]?.classList.add('active'); d[i]?.classList.add('active'); }

/* ════════ TOOL RUNNERS ════════ */
async function runTool(promptFn, inputs, resultId) {
  const resultEl = document.getElementById(resultId);
  if(!resultEl) return null;

  const canRun = await Engine.checkLimit();
  if(!canRun){ resultEl.innerHTML = await R.limitReached(); return null; }

  resultEl.innerHTML = R.skeleton(2);
  try{
    const data = await Engine.call(promptFn(inputs));
    await FB.incUsage();
    await updateUsageDisplay();
    return data;
  }catch(e){
    resultEl.innerHTML = R.error(e.message);
    console.error('Tool error:', e);
    return null;
  }
}

async function runProductResearch(){
  const product=document.getElementById('pr-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.product_research,{product,category:document.getElementById('pr-category')?.value,market:document.getElementById('pr-market')?.value},'pr-result');
  if(!data)return;
  await FB.logEvent('product_research',{product});
  const vTag=data.verdict==='winner'?'tag-green':data.verdict==='potential'?'tag-amber':'tag-red';
  document.getElementById('pr-result').innerHTML=`<div class="result-card fade-up">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${R.scoreCircle(data.overall_score)}<div><h3 style="color:#fff">${data.product_name}</h3><span class="tag ${vTag}" style="margin-top:4px">● ${(data.verdict||'').toUpperCase()}</span></div><div style="margin-left:auto;text-align:right"><div style="font-size:.82rem;color:var(--text2)">Trend: <strong style="color:${data.trend_direction==='rising'?'var(--a1)':data.trend_direction==='stable'?'var(--a3)':'#f87171'}">${data.trend_direction}</strong></div>${data.estimated_monthly_sales?`<div style="font-size:.78rem;color:var(--text2);margin-top:2px">Est. Sales: <strong style="color:#fff">${data.estimated_monthly_sales}</strong></div>`:''}</div></div>
    <p style="font-size:.88rem;line-height:1.7;margin-bottom:14px">${data.summary}</p>
    ${data.demand_analysis?`<div style="background:rgba(0,245,212,.04);border:1px solid rgba(0,245,212,.1);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:.85rem;color:var(--text2)"><strong style="color:var(--a1)">📈 Demand:</strong> ${data.demand_analysis}</div>`:''}
    ${data.competition_analysis?`<div style="background:rgba(124,58,237,.04);border:1px solid rgba(124,58,237,.1);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:.85rem;color:var(--text2)"><strong style="color:#a78bfa">⚔️ Competition:</strong> ${data.competition_analysis}</div>`:''}
    <div class="meter-row"><span class="meter-label">📈 Demand</span>${R.scoreBar(data.demand_score,'var(--a1)')}</div>
    <div class="meter-row"><span class="meter-label">⚔️ Competition</span>${R.scoreBar(data.competition_score,'var(--a3)')}</div>
    <div class="meter-row"><span class="meter-label">🌊 Saturation</span>${R.scoreBar(data.saturation_score,'#f87171')}</div>
    <div class="divider"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:14px 0">
      <div style="background:rgba(0,0,0,.2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:.72rem;color:var(--text2)">💰 Margin</div><strong style="color:var(--a1)">${data.profit_margin_estimate||'—'}</strong></div>
      <div style="background:rgba(0,0,0,.2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:.72rem;color:var(--text2)">🏷️ Price</div><strong style="color:#fff;font-size:.82rem">${data.suggested_price_range||'—'}</strong></div>
      <div style="background:rgba(0,0,0,.2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:.72rem;color:var(--text2)">📊 Score</div><strong style="color:${data.overall_score>=75?'var(--a1)':data.overall_score>=50?'var(--a3)':'#f87171'};font-size:1.1rem">${data.overall_score||'—'}</strong></div>
    </div>
    <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">🎯 Target Audience</strong>${R.tags(data.target_audience,'tag-mint')}</div>
    ${data.marketing_channels?`<div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">📢 Best Channels</strong>${R.tags(data.marketing_channels,'tag-violet')}</div>`:''}
    <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⭐ Key Selling Points</strong>${R.list(data.key_selling_points,'⭐')}</div>
    <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⚠️ Risk Factors</strong>${R.list(data.risk_factors,'⚠️')}</div>
    <div><strong style="font-size:.83rem;color:var(--text2)">✅ Action Steps</strong>${R.list(data.recommendations,'→')}</div>
  </div>`;
}

async function runTikTokFinder(){
  const niche=document.getElementById('tt-niche')?.value?.trim();
  if(!niche){ Toast.error('Niche দিন'); return; }
  const data=await runTool(Prompts.tiktok_viral,{niche,budget:document.getElementById('tt-budget')?.value,market:document.getElementById('tt-market')?.value},'tt-result');
  if(!data)return;
  await FB.logEvent('tiktok',{niche});
  document.getElementById('tt-result').innerHTML=`<div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Categories</strong>${R.tags(data.trending_categories,'tag-red')}</div>
  ${(data.products||[]).map((p,i)=>`<div class="result-card fade-up">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--a4),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:.88rem;flex-shrink:0">${i+1}</div><div style="flex:1"><strong style="color:#fff">${p.product}</strong></div><div style="text-align:right"><div style="font-family:var(--font-h);font-size:1.3rem;font-weight:800;color:${p.viral_score>=80?'var(--a1)':'var(--a3)'}">${p.viral_score}</div><div style="font-size:.7rem;color:var(--text2)">Viral</div></div></div>
    <p style="font-size:.84rem;color:var(--text2);margin-bottom:10px">💡 ${p.why_viral}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;font-size:.8rem">
      ${p.estimated_monthly_searches?`<div><span style="color:var(--text2)">🔍 Monthly Searches:</span> <strong>${p.estimated_monthly_searches?.toLocaleString()}</strong></div>`:''}
      ${p.suggested_price?`<div><span style="color:var(--text2)">💰 Price:</span> <strong style="color:var(--a3)">${p.suggested_price}</strong></div>`:''}
    </div>
    <div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">🎣 Proven Hooks</strong>${R.list(p.hooks,'🎣')}</div>
    ${p.content_ideas&&p.content_ideas.length?`<div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">💡 Content Ideas</strong>${R.list(p.content_ideas,'💡')}</div>`:''}
    ${R.tags(p.trending_hashtags,'tag-red')}
  </div>`).join('')}
  <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">📋 Action Plan</strong>${R.list(data.action_plan,'→')}</div>`;
}

async function runAdCreative(){
  const product=document.getElementById('ac-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.ad_creative,{product,platform:document.getElementById('ac-platform')?.value,audience:document.getElementById('ac-audience')?.value,usp:document.getElementById('ac-usp')?.value},'ac-result');
  if(!data)return;
  await FB.logEvent('ad_creative',{product});
  const eTag=e=>e==='fear'?'tag-red':e==='greed'?'tag-amber':e==='curiosity'?'tag-mint':'tag-green';
  document.getElementById('ac-result').innerHTML=`<div class="tabs"><button class="tab-btn active" onclick="switchTab('ac','angles',this)">📐 Angles</button><button class="tab-btn" onclick="switchTab('ac','tiktok',this)">🎵 TikTok</button><button class="tab-btn" onclick="switchTab('ac','fb',this)">📘 Facebook</button><button class="tab-btn" onclick="switchTab('ac','hooks',this)">🎣 Hooks</button></div>
  <div id="ac-tab-angles">${(data.ad_angles||[]).map(a=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="tag ${eTag(a.emotion)}">${a.emotion}</span><strong style="color:#fff">${a.angle}</strong></div><div class="mb-2">${R.copyBox(a.headline,'Copy')}</div><p style="font-size:.85rem;color:var(--text2);margin-bottom:8px">${a.body_copy}</p><div style="display:flex;gap:8px"><span class="tag tag-green">CTA: ${a.cta}</span><span style="font-size:.77rem;color:var(--text2)">💡 ${a.why_works}</span></div></div>`).join('')}</div>
  <div id="ac-tab-tiktok" class="hidden">${(data.tiktok_scripts||[]).map((s,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-red mb-2">TikTok Script ${i+1} — ${s.duration}</div><div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">🎣 HOOK</strong>${R.copyBox(s.hook,'Copy')}</div><div><strong style="font-size:.8rem;color:var(--text2)">📝 FULL SCRIPT</strong>${R.copyBox(s.script,'Copy')}</div><p style="font-size:.82rem;color:var(--text2);margin-top:8px">🎬 ${s.visual_direction}</p></div>`).join('')}</div>
  <div id="ac-tab-fb" class="hidden">${(data.facebook_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-blue mb-2">Facebook Ad ${i+1}</div><div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">HEADLINE</strong>${R.copyBox(ad.headline,'Copy')}</div><div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">PRIMARY TEXT</strong>${R.copyBox(ad.primary_text,'Copy')}</div><div style="display:flex;gap:8px"><span class="tag tag-green">Button: ${ad.cta_button}</span><span style="font-size:.8rem;color:var(--text2)">📸 ${ad.image_direction}</span></div></div>`).join('')}</div>
  <div id="ac-tab-hooks" class="hidden"><div class="result-card fade-up"><strong style="font-size:.85rem;color:var(--text2)">🎣 Power Hooks</strong><div style="margin-top:10px">${(data.ad_hooks||[]).map((h,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="width:22px;height:22px;border-radius:50%;background:rgba(0,245,212,.1);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:var(--a1);flex-shrink:0">${i+1}</span><span style="flex:1;font-size:.86rem">${h}</span><button class="copy-btn" style="position:static" onclick="copyText('${h.replace(/'/g,"\\'")}',this)">Copy</button></div>`).join('')}</div></div></div>`;
}

async function runAdScript(){
  const product=document.getElementById('as-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.ad_script,{product,platform:document.getElementById('as-platform')?.value,duration:document.getElementById('as-duration')?.value,style:document.getElementById('as-style')?.value},'as-result');
  if(!data)return;
  await FB.logEvent('ad_script',{product});
  await FB.logEvent('ad_script',{product});
  const s=data.script||{};
  document.getElementById('as-result').innerHTML=`<div class="result-card fade-up"><div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-mint">${document.getElementById('as-platform')?.value}</span><span class="tag tag-blue">${document.getElementById('as-duration')?.value}</span></div><div style="display:grid;gap:10px"><div><div class="tag tag-red mb-1">🎣 HOOK</div>${R.copyBox(s.hook,'Copy')}</div><div><div class="tag tag-amber mb-1">❓ PROBLEM</div><p style="font-size:.86rem">${s.problem}</p></div><div><div class="tag tag-green mb-1">✅ SOLUTION</div><p style="font-size:.86rem">${s.solution}</p></div><div><div class="tag tag-violet mb-1">🎁 OFFER</div><p style="font-size:.86rem">${s.offer}</p></div><div><div class="tag tag-mint mb-1">📣 CTA</div>${R.copyBox(s.cta,'Copy')}</div></div><div class="divider"></div><div><strong style="font-size:.84rem;color:var(--text2)">📝 FULL SCRIPT</strong><div style="margin-top:8px">${R.copyBox(s.full_script,'📋 Copy Full')}</div></div><div class="divider"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><strong style="font-size:.82rem;color:var(--text2)">🎬 B-Roll</strong>${R.list(data.b_roll_shots,'📷')}</div><div><strong style="font-size:.82rem;color:var(--text2)">🎵 Music</strong>${R.list(data.music_suggestions,'🎵')}</div></div></div>`;
}

async function runProductDesc(){
  const product=document.getElementById('pd-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.product_description,{product,features:document.getElementById('pd-features')?.value,buyer:document.getElementById('pd-buyer')?.value,tone:document.getElementById('pd-tone')?.value},'pd-result');
  if(!data)return;
  await FB.logEvent('product_desc',{product});
  document.getElementById('pd-result').innerHTML=`<div class="tabs"><button class="tab-btn active" onclick="switchTab('pdt','main',this)">📝 Main</button><button class="tab-btn" onclick="switchTab('pdt','seo',this)">🔍 SEO</button><button class="tab-btn" onclick="switchTab('pdt','emo',this)">❤️ Emotional</button></div>
  <div id="pdt-tab-main"><div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">Title</div>${R.copyBox(data.title,'Copy')}</div><div class="result-card fade-up mb-2"><div class="tag tag-violet mb-2">Tagline</div>${R.copyBox(data.tagline,'Copy')}</div><div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">Short Description</div>${R.copyBox(data.short_description,'Copy')}</div><div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">✅ Bullet Points</div>${(data.bullet_points||[]).map(b=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.86rem;display:flex;gap:8px"><span style="color:var(--a1)">●</span>${b}</div>`).join('')}<button class="copy-btn" style="position:static;margin-top:8px" onclick="copyText('${(data.bullet_points||[]).join('\\n').replace(/'/g,"\\'")}',this)">📋 সব Copy করুন</button></div><div class="result-card fade-up"><div class="tag tag-blue mb-2">Full Description</div>${R.copyBox(data.long_description,'📋 Copy')}</div></div>
  <div id="pdt-tab-seo" class="hidden"><div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">SEO Description</div>${R.copyBox(data.seo_description,'Copy')}</div><div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🎯 Keywords</strong>${R.tags(data.keywords,'tag-mint')}</div></div>
  <div id="pdt-tab-emo" class="hidden"><div class="result-card fade-up mb-2"><div class="tag tag-red mb-2">❤️ Emotional Copy</div>${R.copyBox(data.emotional_copy,'Copy')}</div><div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">❓ FAQs</strong>${(data.faqs||[]).map(f=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-weight:800;color:#fff;font-size:.86rem;margin-bottom:4px">Q: ${f.q}</div><div style="font-size:.84rem;color:var(--text2)">A: ${f.a}</div></div>`).join('')}</div></div>`;
}

async function runSupplier(){
  const product=document.getElementById('sf-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.supplier_finder,{product,budget:document.getElementById('sf-budget')?.value,quality:document.getElementById('sf-quality')?.value},'sf-result');
  if(!data)return;
  await FB.logEvent('supplier',{product});
  document.getElementById('sf-result').innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
    ${data.estimated_cogs?`<div style="background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.15);border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:.7rem;color:var(--text2);margin-bottom:4px">💰 Est. COGS</div>
      <strong style="color:var(--a1)">${data.estimated_cogs}</strong>
    </div>`:''}
    ${data.recommended_margin?`<div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.15);border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:.7rem;color:var(--text2);margin-bottom:4px">📈 Target Margin</div>
      <strong style="color:#a78bfa">${data.recommended_margin}</strong>
    </div>`:''}
    ${data.sample_order_advice?`<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:.7rem;color:var(--text2);margin-bottom:4px">📦 Sample Order</div>
      <strong style="color:var(--a3);font-size:.78rem">${data.sample_order_advice}</strong>
    </div>`:''}
  </div>
  ${(data.platforms||[]).map(p=>`<div class="result-card fade-up mb-2">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="tag tag-mint">${p.name}</span>
      <div style="font-size:.8rem;color:var(--text2)">MOQ: <strong style="color:#fff">${p.moq||'—'}</strong> • Lead: <strong style="color:#fff">${p.lead_time||'—'}</strong></div>
    </div>
    <div class="mb-2">
      <strong style="font-size:.8rem;color:var(--text2)">🔍 Search Terms:</strong>
      ${R.tags(p.search_terms,'tag-violet')}
    </div>
    <div style="font-size:.84rem;color:var(--text2)">${p.tips}</div>
  </div>`).join('')}
  ${data.outreach_email?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">📧 Supplier Outreach Email</strong>
    <div class="mb-1 mt-1"><strong style="font-size:.8rem;color:var(--text2)">Subject:</strong> ${R.copyBox(data.outreach_email.subject||'','📋 Copy')}</div>
    ${R.copyBox(data.outreach_email.body||'','📋 Copy Email')}
  </div>`:''}
  <div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">✅ Verification Checklist</strong>
    ${R.list(data.verification_checklist,'✅')}
  </div>
  <div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">🚩 Red Flags to Avoid</strong>
    ${R.list(data.red_flags,'🚩')}
  </div>
  ${data.negotiation_tips&&data.negotiation_tips.length?`<div class="result-card fade-up">
    <strong style="font-size:.84rem;color:var(--text2)">💬 Negotiation Tips</strong>
    ${R.list(data.negotiation_tips,'💬')}
  </div>`:''}`;
}

async function runCompetitor(){
  const product=document.getElementById('ca-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.competitor_analysis,{product,competitors:document.getElementById('ca-competitors')?.value,platform:document.getElementById('ca-platform')?.value},'ca-result');
  if(!data)return;
  await FB.logEvent('competitor',{product});
  document.getElementById('ca-result').innerHTML=`
  <div class="result-card fade-up mb-2" style="background:rgba(0,0,0,.2)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <strong style="font-size:.84rem;color:var(--text2)">Market Overview</strong>
      ${data.entry_difficulty?`<span class="tag ${data.entry_difficulty==='easy'?'tag-green':data.entry_difficulty==='medium'?'tag-amber':'tag-red'}">Entry: ${data.entry_difficulty}</span>`:''}
      ${data.pricing_recommendation?`<span style="font-size:.78rem;color:var(--text2);margin-left:auto">💰 ${data.pricing_recommendation}</span>`:''}
    </div>
    <p style="font-size:.87rem;line-height:1.7">${data.market_overview}</p>
  </div>
  ${(data.competitors||[]).map((c,i)=>`<div class="result-card fade-up mb-2">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <strong style="color:#fff;font-size:.92rem">${c.name}</strong>
      <div style="display:flex;gap:8px;align-items:center">
        ${c.review_score?`<span class="tag tag-amber">⭐ ${c.review_score}</span>`:''}
        ${c.estimated_monthly_revenue?`<span style="font-size:.8rem;color:var(--a3)">~${c.estimated_monthly_revenue}/mo</span>`:''}
        ${c.price_range?`<span class="tag tag-mint">${c.price_range}</span>`:''}
      </div>
    </div>
    ${c.marketing_strategy?`<div style="font-size:.83rem;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:rgba(0,0,0,.2);border-radius:6px">📢 ${c.marketing_strategy}</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <strong style="font-size:.79rem;color:var(--a1)">✅ Strengths</strong>
        ${R.list(c.strengths,'✅')}
      </div>
      <div>
        <strong style="font-size:.79rem;color:#f87171">❌ Weaknesses</strong>
        ${R.list(c.weaknesses,'❌')}
      </div>
    </div>
  </div>`).join('')}
  ${data.market_gaps&&data.market_gaps.length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--a1)">🎯 Market Gaps (আপনার সুযোগ)</strong>
    ${R.list(data.market_gaps,'🎯')}
  </div>`:''}
  ${data.differentiation_opportunities&&data.differentiation_opportunities.length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">⚡ Differentiation Opportunities</strong>
    ${R.list(data.differentiation_opportunities,'⚡')}
  </div>`:''}
  <div class="result-card fade-up">
    <strong style="font-size:.84rem;color:var(--text2)">🏆 Win Strategy</strong>
    ${R.list(data.win_strategy,'→')}
  </div>`;
}

async function runMarketReport(){
  const product=document.getElementById('mr-product')?.value?.trim();
  if(!product){ Toast.error('Product/Niche দিন'); return; }
  const data=await runTool(Prompts.market_report,{product,market:document.getElementById('mr-market')?.value,budget:document.getElementById('mr-budget')?.value},'mr-result');
  if(!data)return;
  await FB.logEvent('market_report',{product});
  document.getElementById('mr-result').innerHTML=`
  <div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.04))">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
      ${R.scoreCircle(data.opportunity_score)}
      <div>
        <h3 style="color:#fff;font-size:.97rem">${data.report_title}</h3>
        <div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap">
          <span class="tag tag-mint">${data.market_size||'—'}</span>
          <span class="tag ${data.demand_prediction==='increasing'?'tag-green':'tag-amber'}">${data.demand_prediction||'—'}</span>
          ${data.growth_rate?`<span class="tag tag-violet">Growth: ${data.growth_rate}</span>`:''}
        </div>
      </div>
    </div>
    <p style="font-size:.87rem;line-height:1.7">${data.executive_summary}</p>
  </div>
  <div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">📈 Financial Projections</strong>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
      ${[['Month 1',data.financial_projections?.month1,'var(--a5)'],['Month 3',data.financial_projections?.month3,'var(--a1)'],['Month 6',data.financial_projections?.month6,'#4ade80'],['Year 1',data.financial_projections?.year1,'#60a5fa']].map(([l,v,c])=>`<div style="text-align:center;padding:12px;background:rgba(0,0,0,.2);border-radius:10px"><div style="font-size:.68rem;color:var(--text2)">${l}</div><strong style="color:${c};font-size:.82rem">${v||'—'}</strong></div>`).join('')}
    </div>
  </div>
  ${(data.target_demographics||[]).length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">👥 Target Demographics</strong>
    ${data.target_demographics.map(d=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;color:#fff;margin-bottom:4px">${d.segment} ${d.size?`<span class="tag tag-mint" style="font-size:.7rem">${d.size}</span>`:''}</div>
      ${d.buying_behavior?`<div style="font-size:.82rem;color:var(--text2);margin-bottom:4px">🛒 ${d.buying_behavior}</div>`:''}
      ${d.pain_points&&d.pain_points.length?R.tags(d.pain_points,'tag-amber'):''}
    </div>`).join('')}
  </div>`:''}
  <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📊 Market Trends</strong>${R.list(data.market_trends,'📊')}</div>
  <div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">⚠️ Risk Assessment</strong>
    ${(data.risk_assessment||[]).map(r=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <strong style="color:#fff">${r.risk}</strong>
        <span class="tag ${r.probability==='low'?'tag-green':r.probability==='medium'?'tag-amber':'tag-red'}">${r.probability}</span>
      </div>
      <p style="font-size:.82rem;color:var(--text2)">🛡️ ${r.mitigation}</p>
    </div>`).join('')}
  </div>
  <div class="result-card fade-up">
    <strong style="font-size:.84rem;color:var(--text2)">📅 4-Week Action Plan</strong>
    ${(data.action_plan||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="tag tag-mint mb-1" style="margin-bottom:6px">Week ${w.week}</div>
      ${R.list(w.actions,'→')}
    </div>`).join('')}
    <div style="margin-top:14px;padding:14px;background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.2);border-radius:10px;font-size:.87rem;line-height:1.6">
      <strong style="color:var(--a1)">📌 চূড়ান্ত পরামর্শ:</strong> ${data.overall_recommendation}
    </div>
  </div>`;
}

async function runPostGenerator(){
  const product=document.getElementById('pg-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.post_generator,{product,features:document.getElementById('pg-features')?.value,lang:document.getElementById('pg-lang')?.value},'pg-result');
  if(!data)return;
  await FB.logEvent('post_generator',{product});
  document.getElementById('pg-result').innerHTML=`
  ${data.best_posting_time?`<div class="result-card fade-up mb-2" style="background:rgba(0,245,212,.04);border:1px solid rgba(0,245,212,.15)">
    <div style="font-size:.84rem"><span style="color:var(--text2)">⏰ Best Posting Time:</span> <strong style="color:var(--a1)">${data.best_posting_time}</strong></div>
  </div>`:''}
  ${(data.posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class="tag tag-mint">Post ${i+1}</span>
      <span style="font-size:.78rem;color:var(--text2);text-transform:capitalize">${(p.type||'').replace(/_/g,' ')}</span>
    </div>
    ${p.title?`<div style="font-weight:800;color:#fff;font-size:.92rem;margin-bottom:10px">${p.title}</div>`:''}
    ${R.copyBox(p.body,'📋 Copy Post')}
    <div style="margin-top:8px;padding:8px 12px;background:rgba(0,245,212,.06);border-radius:8px;font-size:.84rem;color:var(--a1)">📣 ${p.cta}</div>
  </div>`).join('')}
  <div class="result-card fade-up">
    <strong style="font-size:.83rem;color:var(--text2);display:block;margin-bottom:8px">🏷️ Hashtags</strong>
    ${R.tags(data.hashtags,'tag-violet')}
    ${data.tips&&data.tips.length?`<div style="margin-top:14px"><strong style="font-size:.83rem;color:var(--text2)">💡 Expert Tips</strong>${R.list(data.tips,'💡')}</div>`:''}
  </div>`;
}

async function runViralPost(){
  const topic=document.getElementById('vp-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  const data=await runTool(Prompts.viral_post,{topic,platform:document.getElementById('vp-platform')?.value,target:document.getElementById('vp-target')?.value},'vp-result');
  if(!data)return;
  await FB.logEvent('viral_post',{topic});
  const ec={curiosity:'tag-mint',fear:'tag-red',humor:'tag-green',greed:'tag-amber',inspiration:'tag-blue',shock:'tag-red'};
  document.getElementById('vp-result').innerHTML=`
  ${(data.viral_posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span class="tag tag-pink">Viral Post ${i+1}</span>
      <span class="tag ${ec[p.emotion_trigger]||'tag-violet'}">${p.emotion_trigger}</span>
      <span class="tag ${p.expected_reach==='high'?'tag-green':'tag-amber'}" style="margin-left:auto">${p.expected_reach} reach</span>
    </div>
    <div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">🎯 HOOK</strong>
      ${R.copyBox(p.hook,'📋 Copy Hook')}
    </div>
    <strong style="font-size:.8rem;color:var(--text2)">📝 FULL POST</strong>
    ${R.copyBox(p.body,'📋 Copy Full Post')}
    <div style="margin-top:10px;padding:8px 12px;background:rgba(0,245,212,.06);border-radius:8px">
      <div style="font-size:.82rem"><strong style="color:var(--a1)">Why Viral:</strong> <span style="color:var(--text2)">${p.viral_factor}</span></div>
      <div style="font-size:.82rem;margin-top:4px;color:var(--a1)">📣 CTA: ${p.cta}</div>
    </div>
  </div>`).join('')}
  <div class="result-card fade-up">
    <strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Elements to Use</strong>
    ${R.tags(data.trending_elements,'tag-red')}
    ${data.timing_tip?`<div style="margin-top:12px;padding:10px 12px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.84rem;color:var(--text2)">⏰ ${data.timing_tip}</div>`:''}
    ${data.engagement_boosters&&data.engagement_boosters.length?`<div style="margin-top:10px"><strong style="font-size:.83rem;color:var(--text2)">💡 Engagement Boosters</strong>${R.list(data.engagement_boosters,'💡')}</div>`:''}
  </div>`;
}

async function runPromoPost(){
  const product=document.getElementById('pp-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.promo_post,{product,offer:document.getElementById('pp-offer')?.value,duration:document.getElementById('pp-duration')?.value,platform:document.getElementById('pp-platform')?.value},'pp-result');
  if(!data)return;
  await FB.logEvent('promo_post',{product});
  document.getElementById('pp-result').innerHTML=`
  <div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(236,72,153,.06));text-align:center">
    <div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:var(--a3)">${data.offer_headline||'Special Offer!'}</div>
    ${data.discount_angle?`<div style="font-size:.85rem;color:var(--text2);margin-top:6px">${data.discount_angle}</div>`:''}
    ${data.best_time_to_post?`<div style="font-size:.8rem;color:var(--a1);margin-top:6px">⏰ ${data.best_time_to_post}</div>`:''}
  </div>
  ${(data.promo_posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class="tag tag-amber">Promo ${i+1}</span>
      <span style="font-size:.78rem;color:var(--text2);text-transform:capitalize">${(p.style||'').replace(/_/g,' ')}</span>
    </div>
    <div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">📌 HEADLINE</strong>
      ${R.copyBox(p.headline,'📋 Copy')}
    </div>
    <strong style="font-size:.8rem;color:var(--text2)">📝 FULL POST</strong>
    ${R.copyBox(p.body,'📋 Copy Post')}
    ${p.countdown_text?`<div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;font-size:.84rem;color:var(--a3)">⏳ ${p.countdown_text}</div>`:''}
    <div style="margin-top:8px;padding:8px 12px;background:rgba(0,245,212,.06);border-radius:8px;font-size:.84rem;color:var(--a1)">📣 ${p.cta}</div>
  </div>`).join('')}
  <div class="result-card fade-up">${R.tags(data.hashtags,'tag-amber')}</div>`;
}

async function runAdCopy(){
  const product=document.getElementById('adc-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.ad_copy,{product,goal:document.getElementById('adc-goal')?.value,audience:document.getElementById('adc-audience')?.value,budget:document.getElementById('adc-budget')?.value},'adc-result');
  if(!data)return;
  await FB.logEvent('ad_copy',{product});
  document.getElementById('adc-result').innerHTML=`
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('adc','fb',this)">📘 Facebook Ads</button>
    <button class="tab-btn" onclick="switchTab('adc','gg',this)">🔍 Google Ads</button>
    <button class="tab-btn" onclick="switchTab('adc','tips',this)">💡 Tips</button>
  </div>
  <div id="adc-tab-fb">
    ${(data.facebook_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span class="tag tag-blue">FB Ad ${i+1}</span>
        ${ad.pain_point?`<span style="font-size:.78rem;color:var(--text2)">Pain: ${ad.pain_point}</span>`:''}
      </div>
      <div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">📌 HEADLINE</strong>
        ${R.copyBox(ad.headline,'📋 Copy')}
      </div>
      <strong style="font-size:.8rem;color:var(--text2)">📝 PRIMARY TEXT</strong>
      ${R.copyBox(ad.primary_text,'📋 Copy')}
      ${ad.description?`<div class="mt-1"><strong style="font-size:.8rem;color:var(--text2)">Description:</strong> <span style="font-size:.84rem;color:var(--text2)">${ad.description}</span></div>`:''}
      <div style="margin-top:8px"><span class="tag tag-green">Button: ${ad.cta||'Shop Now'}</span></div>
    </div>`).join('')}
  </div>
  <div id="adc-tab-gg" class="hidden">
    ${(data.google_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2">
      <div class="tag tag-green mb-2">Google Ad ${i+1}</div>
      <div class="mb-2">
        <strong style="font-size:.8rem;color:var(--text2)">HEADLINES</strong>
        ${R.copyBox([ad.headline1,ad.headline2,ad.headline3].filter(Boolean).join(' | '),'📋 Copy')}
      </div>
      <div class="mb-1">
        <strong style="font-size:.8rem;color:var(--text2)">DESCRIPTIONS</strong>
        ${R.copyBox((ad.description1||'')+(ad.description2?' | '+ad.description2:''),'📋 Copy')}
      </div>
      ${ad.display_url?`<div style="font-size:.82rem;color:var(--text2);margin-top:6px">🔗 ${ad.display_url}</div>`:''}
    </div>`).join('')}
  </div>
  <div id="adc-tab-tips" class="hidden">
    <div class="result-card fade-up mb-2">
      <strong style="font-size:.84rem;color:var(--text2)">⚡ Power Words</strong>
      ${R.tags(data.power_words,'tag-red')}
    </div>
    <div class="result-card fade-up">
      <strong style="font-size:.84rem;color:var(--text2)">💡 Conversion Tips</strong>
      ${R.list(data.conversion_tips,'💡')}
    </div>
  </div>`;
}

async function runVideoScript(){
  const topic=document.getElementById('vs-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  const data=await runTool(Prompts.video_script,{topic,duration:document.getElementById('vs-duration')?.value,style:document.getElementById('vs-style')?.value,platform:document.getElementById('vs-platform')?.value},'vs-result');
  if(!data)return;
  await FB.logEvent('video_script',{topic});
  document.getElementById('vs-result').innerHTML=`<div class="result-card fade-up mb-2"><div class="tag tag-red mb-2">📹 Video Title</div>${R.copyBox(data.title,'Copy')}</div><div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">🎬 Intro</div><div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">Hook:</strong> ${R.copyBox(data.intro?.hook,'Copy')}</div><div style="font-size:.84rem;color:var(--text2)">Presenter: ${data.intro?.presenter_line}</div></div>${(data.body||[]).map((sec,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-violet mb-2">Section ${i+1}: ${sec.section} (${sec.duration_seconds}s)</div>${R.copyBox(sec.content,'Copy')}<div style="font-size:.82rem;color:var(--text2);margin-top:6px">🎬 ${sec.visual_cue}</div></div>`).join('')}<div class="result-card fade-up mb-2"><div class="tag tag-amber mb-2">🎯 Outro</div>${R.copyBox((data.outro?.summary||'')+'\n\n'+(data.outro?.cta||''),'Copy')}</div><div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🖼️ Thumbnail</strong><div style="padding:10px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.85rem;margin-top:8px">${data.thumbnail_idea}</div>${R.tags(data.tags,'tag-blue')}</div>`;
}

async function runVideoPrompt(){
  const scene=document.getElementById('vpr-scene')?.value?.trim();
  if(!scene){ Toast.error('Scene/Product দিন'); return; }
  const data=await runTool(Prompts.video_prompt,{scene,style:document.getElementById('vpr-style')?.value,duration:document.getElementById('vpr-duration')?.value},'vpr-result');
  if(!data)return;
  await FB.logEvent('video_prompt',{scene});
  document.getElementById('vpr-result').innerHTML=`<div class="result-card fade-up mb-2" style="display:flex;align-items:center;gap:10px"><span style="font-size:1.5rem">🎬</span><div><strong style="color:var(--a1)">Best Tool:</strong> <span style="color:#fff">${data.best_tool}</span></div></div>${(data.prompts||[]).map(p=>`<div class="result-card fade-up mb-2"><div class="tag tag-violet mb-2">${p.title}</div>${R.copyBox(p.prompt,'📋 Copy')}<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:.8rem"><div><span style="color:var(--text2)">Camera:</span> <span>${p.camera_movement}</span></div><div><span style="color:var(--text2)">Light:</span> <span>${p.lighting}</span></div><div><span style="color:var(--text2)">Mood:</span> <span>${p.mood}</span></div></div></div>`).join('')}<div class="result-card fade-up">${R.list(data.style_tips,'💡')}</div>`;
}

async function runStoryboard(){
  const topic=document.getElementById('sb-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  const data=await runTool(Prompts.storyboard,{topic,type:document.getElementById('sb-type')?.value,duration:document.getElementById('sb-duration')?.value},'sb-result');
  if(!data)return;
  await FB.logEvent('storyboard',{topic});
  document.getElementById('sb-result').innerHTML=`<div class="result-card fade-up mb-2"><h3 style="color:#fff;margin-bottom:6px">${data.title}</h3><p style="font-size:.86rem">${data.concept}</p><div style="display:flex;gap:10px;margin-top:10px"><span class="tag tag-violet">Music: ${data.music_mood}</span>${(data.color_palette||[]).map(c=>`<span class="tag tag-mint">${c}</span>`).join('')}</div></div>${(data.scenes||[]).map(sc=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--a1),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;color:#0a0a14;flex-shrink:0">${sc.scene_number}</div><div style="flex:1"><strong style="color:#fff">Scene ${sc.scene_number}</strong> <span class="tag tag-mint" style="margin-left:6px">${sc.duration_seconds}s</span></div><span style="font-size:.8rem;color:var(--text2)">${sc.camera_angle}</span></div><div style="display:grid;gap:8px;font-size:.85rem"><div><span style="color:var(--text2)">🎬 Visual:</span> ${sc.visual}</div><div><span style="color:var(--text2)">🔊 Audio:</span> ${sc.audio}</div>${sc.text_overlay?`<div><span style="color:var(--text2)">📝 Text:</span> <span style="color:var(--a1)">${sc.text_overlay}</span></div>`:''}<div><span style="color:var(--text2)">↩ Transition:</span> ${sc.transition}</div></div></div>`).join('')}<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🎬 Director's Notes</strong><p style="font-size:.86rem;margin-top:8px">${data.director_notes}</p></div>`;
}

async function runSubtitleTranslator(){
  const text=document.getElementById('st-text')?.value?.trim();
  if(!text){ Toast.error('Text দিন'); return; }
  const data=await runTool(Prompts.subtitle_translator,{text,from:document.getElementById('st-from')?.value,to:document.getElementById('st-to')?.value,style:document.getElementById('st-style')?.value},'st-result');
  if(!data)return;
  await FB.logEvent('subtitle_translator',{});
  document.getElementById('st-result').innerHTML=`<div class="result-card fade-up mb-2"><div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-blue">${document.getElementById('st-from')?.value}</span><span style="color:var(--text2)">→</span><span class="tag tag-mint">${document.getElementById('st-to')?.value}</span><span class="tag tag-violet">${data.formality_level}</span></div>${(data.translated_lines||[]).map(l=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-size:.85rem;color:var(--text2)">${l.original}</div><div style="font-size:.85rem;color:var(--a1)">${l.translated}</div></div>`).join('')}</div>${data.cultural_adaptations?.length?`<div class="result-card fade-up">${R.list(data.cultural_adaptations,'🌐')}</div>`:''}`;
}

async function runAdFunnel(){
  const product=document.getElementById('af-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.ad_funnel,{product,budget:document.getElementById('af-budget')?.value,goal:document.getElementById('af-goal')?.value,timeline:document.getElementById('af-timeline')?.value},'af-result');
  if(!data)return;
  await FB.logEvent('ad_funnel',{product});
  document.getElementById('af-result').innerHTML=`
  <div class="result-card fade-up mb-2" style="background:rgba(0,0,0,.2)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
      <strong style="font-size:.84rem;color:var(--text2)">Funnel Overview</strong>
      ${data.expected_roas?`<span class="tag tag-green" style="margin-left:auto">Expected ROAS: ${data.expected_roas}</span>`:''}
    </div>
    <p style="font-size:.87rem;line-height:1.7">${data.funnel_overview}</p>
  </div>
  ${(data.stages||[]).map(s=>`<div class="result-card fade-up mb-2">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:6px">
      <span class="tag ${s.stage?.includes('Awareness')?'tag-blue':s.stage?.includes('Consideration')?'tag-amber':'tag-green'}">${s.stage}</span>
      <div style="display:flex;gap:6px">
        ${s.budget_percentage?`<span style="font-size:.78rem;color:var(--a3)">Budget: ${s.budget_percentage}</span>`:''}
        ${s.kpi?`<span style="font-size:.78rem;color:var(--text2)">KPI: ${s.kpi}</span>`:''}
      </div>
    </div>
    ${s.objective?`<div style="font-size:.83rem;color:var(--text2);margin-bottom:8px">🎯 ${s.objective}</div>`:''}
    ${s.ad_type?`<div style="font-size:.83rem;margin-bottom:8px"><strong style="color:var(--text2)">Ad Type:</strong> <span style="color:#fff">${s.ad_type}</span></div>`:''}
    ${s.audience?`<div style="font-size:.83rem;margin-bottom:8px;padding:8px;background:rgba(0,0,0,.2);border-radius:6px;color:var(--text2)">👥 ${s.audience}</div>`:''}
    ${s.example_copy?`<div><strong style="font-size:.8rem;color:var(--text2)">📝 Example Copy</strong>${R.copyBox(s.example_copy,'📋 Copy')}</div>`:''}
  </div>`).join('')}
  ${data.retargeting_strategy?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">🔄 Retargeting Strategy</strong>
    <p style="font-size:.85rem;color:var(--text2);margin-top:8px;line-height:1.6">${data.retargeting_strategy}</p>
  </div>`:''}
  ${data.timeline&&data.timeline.length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">📅 Monthly Timeline</strong>
    ${data.timeline.map((t,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start">
      <span class="tag tag-mint" style="flex-shrink:0">Week ${i+1}</span>
      <span style="font-size:.84rem;color:var(--text2)">${t}</span>
    </div>`).join('')}
  </div>`:''}
  ${data.scaling_strategy?`<div class="result-card fade-up">
    <strong style="font-size:.84rem;color:var(--a1)">🚀 Scaling Strategy</strong>
    <p style="font-size:.85rem;color:var(--text2);margin-top:8px;line-height:1.6">${data.scaling_strategy}</p>
  </div>`:''}`;
}

async function runConceptArchitect(){
  const idea=document.getElementById('con-idea')?.value?.trim();
  if(!idea){ Toast.error('Business idea দিন'); return; }
  const data=await runTool(Prompts.concept_architect,{idea,industry:document.getElementById('con-industry')?.value,budget:document.getElementById('con-budget')?.value,goal:document.getElementById('con-goal')?.value},'con-result');
  if(!data)return;
  await FB.logEvent('concept_architect',{idea:idea.substring(0,50)});
  document.getElementById('con-result').innerHTML=`
  <div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.05))">
    <h3 style="color:#fff;font-size:1.05rem;margin-bottom:8px">${data.concept_title}</h3>
    <p style="font-size:.87rem;line-height:1.7;margin-bottom:12px">${data.executive_summary}</p>
    ${data.unique_value_proposition?`<div style="padding:10px 14px;background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:8px;font-size:.86rem;font-weight:700;color:var(--a1)">"${data.unique_value_proposition}"</div>`:''}
  </div>
  ${data.target_market?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">👥 Target Market</strong>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
      <div style="background:rgba(0,0,0,.2);border-radius:8px;padding:10px">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:4px">Primary</div>
        <strong style="font-size:.84rem;color:#fff">${data.target_market.primary||'—'}</strong>
      </div>
      <div style="background:rgba(0,0,0,.2);border-radius:8px;padding:10px">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:4px">Market Size</div>
        <strong style="font-size:.84rem;color:var(--a1)">${data.target_market.market_size||'—'}</strong>
      </div>
    </div>
    ${data.target_market.psychographics&&data.target_market.psychographics.length?`<div style="margin-top:10px">${R.tags(data.target_market.psychographics,'tag-mint')}</div>`:''}
  </div>`:''}
  ${data.revenue_model?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">💰 Revenue Model</strong>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
      ${data.revenue_model.projected_monthly?`<div style="text-align:center;padding:10px;background:rgba(0,0,0,.2);border-radius:8px">
        <div style="font-size:.68rem;color:var(--text2)">Monthly Target</div>
        <strong style="color:var(--a1);font-size:.86rem">${data.revenue_model.projected_monthly}</strong>
      </div>`:''}
      ${data.revenue_model.break_even?`<div style="text-align:center;padding:10px;background:rgba(0,0,0,.2);border-radius:8px">
        <div style="font-size:.68rem;color:var(--text2)">Break Even</div>
        <strong style="color:var(--a3);font-size:.86rem">${data.revenue_model.break_even}</strong>
      </div>`:''}
      ${data.revenue_model.pricing_strategy?`<div style="text-align:center;padding:10px;background:rgba(0,0,0,.2);border-radius:8px">
        <div style="font-size:.68rem;color:var(--text2)">Pricing</div>
        <strong style="color:#a78bfa;font-size:.78rem">${data.revenue_model.pricing_strategy}</strong>
      </div>`:''}
    </div>
    ${data.revenue_model.streams&&data.revenue_model.streams.length?`<div style="margin-top:10px"><strong style="font-size:.8rem;color:var(--text2)">Revenue Streams:</strong>${R.list(data.revenue_model.streams,'💰')}</div>`:''}
  </div>`:''}
  ${data.competitive_advantage&&data.competitive_advantage.length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">⚡ Competitive Advantages</strong>
    ${R.list(data.competitive_advantage,'⚡')}
  </div>`:''}
  ${data.marketing_plan?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">📢 Marketing Plan</strong>
    ${['phase1','phase2','phase3'].map((p,i)=>data.marketing_plan[p]?`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="tag tag-violet mb-1">Phase ${i+1}</div>
      <div style="font-size:.85rem;color:var(--text2)">${data.marketing_plan[p]}</div>
    </div>`:'').join('')}
  </div>`:''}
  ${data.action_items&&data.action_items.length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">📅 First Month Action Plan</strong>
    ${data.action_items.map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="tag tag-mint mb-1" style="margin-bottom:6px">Week ${w.week}</div>
      ${R.list(w.tasks,'→')}
    </div>`).join('')}
  </div>`:''}
  ${data.success_metrics&&data.success_metrics.length?`<div class="result-card fade-up mb-2">
    <strong style="font-size:.84rem;color:var(--text2)">🎯 Success Metrics</strong>
    ${R.list(data.success_metrics,'🎯')}
  </div>`:''}
  ${data.risk_mitigation&&data.risk_mitigation.length?`<div class="result-card fade-up">
    <strong style="font-size:.84rem;color:var(--text2)">⚠️ Risks & Mitigation</strong>
    ${R.list(data.risk_mitigation,'⚠️')}
  </div>`:''}`;
}

/* ════════ INIT — Firebase তুরন্ত চালু করো ════════ */
(function earlyInit(){
  try {
    if(typeof firebase !== 'undefined'){
      if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
      db   = firebase.firestore();
      auth = firebase.auth();
      Store.loadApiKeyFromFirestore().catch(()=>{});

      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if(user){
          await loadUserData(user.uid).catch(()=>{});
          await FB.checkAndApplyExpiry().catch(()=>{});
        } else {
          currentUserData = null;
        }
        if(typeof updateUsageDisplay==='function') updateUsageDisplay().catch(()=>{});
        /* onAuthStateReady: page এর inline script লোড হওয়ার পর call করো */
        if(typeof onAuthStateReady==='function'){
          onAuthStateReady(user);
        } else {
          /* Inline script এখনো লোড হয়নি — একটু পরে আবার চেষ্টা করো */
          setTimeout(()=>{
            if(typeof onAuthStateReady==='function') onAuthStateReady(user);
          }, 100);
        }
      });
      console.log('Firebase initialized ✅');
    }
  } catch(e){ console.error('Firebase init error:', e); }
})();

document.addEventListener('DOMContentLoaded',()=>{
  if(typeof Toast!=='undefined') Toast.init();
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o)o.classList.add('hidden'); }));
});

/* ════════ USER API KEY MODAL ════════ */
async function openApiKeyModal(){
  /* Modal নেই তাহলে তৈরি করো */
  if(!document.getElementById('userApiKeyModal')){
    const m = document.createElement('div');
    m.className = 'modal-overlay hidden';
    m.id = 'userApiKeyModal';
    m.innerHTML = `
      <div class="modal-box" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title">🔑 আপনার OpenRouter API Key</div>
          <button class="modal-close" onclick="Modal.hide('userApiKeyModal')">✕</button>
        </div>

        <!-- Status -->
        <div id="uak_status" style="margin-bottom:18px"></div>

        <!-- Info box: OpenRouter only -->
        <div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.25);border-radius:12px;padding:16px;margin-bottom:20px">
          <div style="font-weight:800;color:#a78bfa;margin-bottom:8px">🆓 OpenRouter Key পাওয়ার নিয়ম</div>
          <div style="font-size:.84rem;color:var(--text2);display:grid;gap:5px">
            <div>১. <a href="https://openrouter.ai/keys" target="_blank" style="color:#a78bfa;font-weight:700">openrouter.ai/keys</a> এ যান</div>
            <div>২. Google/GitHub দিয়ে signup করুন (ফ্রি)</div>
            <div>৩. <strong style="color:#fff">"Create Key"</strong> চাপুন</div>
            <div>৪. Key copy করুন → নিচে paste করুন (<span style="color:#a78bfa">sk-or-...</span> দিয়ে শুরু)</div>
          </div>
          <div style="margin-top:8px;padding:7px 10px;background:rgba(124,58,237,.12);border-radius:7px;font-size:.8rem;color:#a78bfa">
            🆓 সম্পূর্ণ Free — কোনো খরচ নেই
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">OpenRouter API Key</label>
          <div style="position:relative">
            <input class="form-control" id="uak_input" type="password"
              placeholder="sk-or-..." style="padding-right:80px"
              onkeydown="if(event.key==='Enter')saveUserApiKey()">
            <button onclick="const i=document.getElementById('uak_input');i.type=i.type==='password'?'text':'password'"
              style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text2);cursor:pointer;font-size:.78rem">
              👁 Show
            </button>
          </div>
          <div style="font-size:.76rem;color:var(--text2);margin-top:5px">
            Key Firebase-এ save হবে। Admin দেখতে পারবে না।
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" style="flex:1" id="uak_save_btn" onclick="saveUserApiKey()">
            💾 Key Save করুন
          </button>
          <button class="btn btn-danger btn-sm" id="uak_del_btn" onclick="deleteUserApiKey()" style="display:none">
            🗑️ মুছুন
          </button>
        </div>

        <div id="uak_result" style="margin-top:14px"></div>
      </div>`;
    m.addEventListener('click', e=>{ if(e.target===m) Modal.hide('userApiKeyModal'); });
    document.body.appendChild(m);
  }

  /* Current key দেখাও */
  const existing = await FB.getUserApiKey();
  const statusEl = document.getElementById('uak_status');
  const delBtn   = document.getElementById('uak_del_btn');
  const input    = document.getElementById('uak_input');

  if(existing){
    statusEl.innerHTML = `<div class="alert alert-success">
      <span>✅</span>
      <div><strong>API Key সেট আছে।</strong> ${FB.isPro()?'আপনি Pro User — Unlimited ব্যবহার করতে পারছেন।':'মনে রাখবেন: Normal User হিসেবে সর্বোচ্চ '+CONFIG.AI_TOOL_FREE_LIMIT+' বার ব্যবহার করতে পারবেন, এরপর Pro লাগবে।'}<br>
      <span style="font-family:monospace;color:var(--a1)">${existing.substring(0,8)}...${existing.substring(existing.length-4)}</span></div>
    </div>`;
    delBtn.style.display = 'inline-flex';
    input.placeholder = 'নতুন key দিয়ে replace করুন';
  } else {
    statusEl.innerHTML = `<div class="alert alert-warning">
      <span>⚠️</span>
      <div>API Key নেই। ${FB.isPro()?'Key দিলে আপনার নিজস্ব quota ব্যবহার হবে।':'Normal User হিসেবে সর্বোচ্চ '+CONFIG.AI_TOOL_FREE_LIMIT+' বার tool ব্যবহার করতে পারবেন।'}</div>
    </div>`;
    delBtn.style.display = 'none';
  }
  document.getElementById('uak_result').innerHTML = '';

  Modal.show('userApiKeyModal');
}

async function saveUserApiKey(){
  const key = document.getElementById('uak_input')?.value?.trim();
  if(!key || key.length < 20){
    document.getElementById('uak_result').innerHTML =
      '<div class="alert alert-error">❌ সঠিক API Key দিন</div>';
    return;
  }
  if(!key.startsWith('sk-or-')){
    document.getElementById('uak_result').innerHTML =
      '<div class="alert alert-error">❌ OpenRouter key "sk-or-" দিয়ে শুরু হওয়া উচিত।</div>';
    return;
  }

  const btn = document.getElementById('uak_save_btn');
  btn.disabled = true; btn.textContent = '⏳ Test করছি...';
  document.getElementById('uak_result').innerHTML =
    '<div class="alert alert-info">🔄 Key verify করা হচ্ছে...</div>';

  /* Key test করো */
  try {
    const res = await fetch(CONFIG.OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'NexoraPilot'
      },
      body: JSON.stringify({
        model: CONFIG.OPENROUTER_MODEL,
        messages:[{role:'user',content:'Say OK'}],
        max_tokens: 5
      })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      btn.disabled=false; btn.textContent='💾 Key Save করুন';
      document.getElementById('uak_result').innerHTML =
        `<div class="alert alert-error">❌ OpenRouter Key কাজ করছে না: ${err.error?.message||'Invalid key'}</div>`;
      return;
    }

    btn.textContent = '⏳ Saving...';
    const saved = await FB.setUserApiKey(key);
    window._userApiKey = key;
    btn.disabled=false; btn.textContent='💾 Key Save করুন';

    if(saved){
      document.getElementById('uak_input').value = '';
      document.getElementById('uak_result').innerHTML =
        '<div class="alert alert-success">✅ API Key save হয়েছে! এখন unlimited tools ব্যবহার করুন।</div>';
      await openApiKeyModal(); /* Refresh modal */
      await updateUsageDisplay();
      Toast.success('🔑 API Key সেট হয়েছে! Unlimited access চালু।');
    } else {
      document.getElementById('uak_result').innerHTML =
        '<div class="alert alert-error">❌ Save করতে সমস্যা। আবার চেষ্টা করুন।</div>';
    }
  } catch(e){
    btn.disabled=false; btn.textContent='💾 Key Save করুন';
    document.getElementById('uak_result').innerHTML =
      `<div class="alert alert-error">❌ Error: ${e.message}</div>`;
  }
}

async function deleteUserApiKey(){
  if(!confirm('API Key মুছবেন? Tools আবার limited হয়ে যাবে।')) return;
  await FB.removeUserApiKey();
  window._userApiKey = '';
  Toast.warning('API Key মুছা হয়েছে।');
  await openApiKeyModal();
  await updateUsageDisplay();
}
