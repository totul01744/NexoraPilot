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
  OPENROUTER_URL:   'https://openrouter.ai/api/v1/chat/completions',
  OPENROUTER_MODEL: 'openai/gpt-oss-120b:free',
  OPENROUTER_MODEL_BACKUP: 'meta-llama/llama-3.3-70b-instruct:free',
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
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(FB_CONFIG);
      }
      db   = firebase.firestore();
      auth = firebase.auth();

      /* Load API Key from Firestore immediately */
      Store.loadApiKeyFromFirestore();

      /* Listen for auth state changes */
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

    /* সবার আগে users collection এ লিখে ফেলো — এটা guaranteed হতে হবে,
       পরের কোনো step fail করলেও যাতে user Firestore এ অবশ্যই থাকে */
    await db.collection('users').doc(cred.user.uid).set(userData);
    await cred.user.updateProfile({ displayName: name });
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
    /* Priority: 1) User personal key  2) System key */
    const userKey = await FB.getUserApiKey();
    if(userKey) return { key: userKey, source: 'user' };
    const sysKey = Store.getApiKey();
    if(sysKey) return { key: sysKey, source: 'system' };
    return { key: '', source: 'none' };
  },

  async call(prompt){
    const { key: apiKey } = await Engine.getActiveKey();
    if(!apiKey){
      throw new Error('API Key সেট নেই। 🔑 Key দিন বাটনে ক্লিক করুন।');
    }
    return await Engine.callOpenRouter(apiKey, prompt);
  },

  async callOpenRouter(apiKey, prompt, model=null){
    const useModel = model || CONFIG.OPENROUTER_MODEL;
    let res;
    try {
      res = await fetch(CONFIG.OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'NexoraPilot'
        },
        body: JSON.stringify({
          model: useModel,
          messages: [{
            role: 'user',
            content: prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks, no extra text. Raw JSON only.'
          }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });
    } catch(e){ throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।'); }
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      const msg = err.error?.message||'';
      const status = res.status;
      if(status===401) throw new Error('OpenRouter Key ভুল। সঠিক key দিন।');
      if(status===429){
        /* প্রধান free model busy থাকলে backup free model দিয়ে একবার চেষ্টা করো */
        if(useModel !== CONFIG.OPENROUTER_MODEL_BACKUP){
          return await Engine.callOpenRouter(apiKey, prompt, CONFIG.OPENROUTER_MODEL_BACKUP);
        }
        throw new Error('Rate limit। ১ মিনিট পরে চেষ্টা করুন।');
      }
      throw new Error(`OpenRouter Error (${status}): ${msg||'অজানা সমস্যা'}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g,'').trim();
    try{ return JSON.parse(clean); }
    catch{ throw new Error('ফলাফল প্রক্রিয়া করতে সমস্যা। আবার চেষ্টা করুন।'); }
  },

  /* AI Tools Usage Limitation System:
     Pro User → Unlimited (কোনো limit নেই)
     Normal User → Lifetime সর্বোচ্চ CONFIG.AI_TOOL_FREE_LIMIT (৩) বার, তারপর Locked */
  async checkLimit(){
    if(FB.isPro()) return true;
    if(!Store.getApiKey() && !(await FB.getUserApiKey())) return false; /* কোনো key ছাড়া চলবে না */
    return await FB.canUseAiTool();
  },

  async remaining(){
    if(FB.isPro()) return 999;
    return await FB.aiToolUsesRemaining();
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
  ad_funnel:(v)=>`Create a complete ad funnel strategy.\nProduct: ${v.product}, Budget: ${v.budget||'medium'}, Goal: ${v.goal||'sales'}, Timeline: ${v.timeline||'30 days'}\nJSON: {"funnel_overview":"...","stages":[{"stage":"Awareness","objective":"...","ad_type":"...","audience":"...","budget_percentage":"30%","content":"...","kpi":"...","example_copy":"..."},{"stage":"Consideration","objective":"...","ad_type":"...","audience":"...","budget_percentage":"40%","content":"...","kpi":"...","example_copy":"..."},{"stage":"Conversion","objective":"...","ad_type":"...","audience":"...","budget_percentage":"30%","content":"...","kpi":"...","example_copy":"..."}],"retargeting_strategy":"...","expected_roas":"...","timeline":["..."]}`,
  concept_architect:(v)=>`Create a complete business/campaign blueprint.\nIdea: ${v.idea}, Industry: ${v.industry||'ecommerce'}, Budget: ${v.budget||'startup'}, Goal: ${v.goal||'launch'}\nJSON: {"concept_title":"...","executive_summary":"...","unique_value_proposition":"...","target_market":{"primary":"...","secondary":"...","psychographics":["..."]},"competitive_advantage":["..."],"revenue_model":{"streams":["..."],"pricing_strategy":"...","projected_monthly":"..."},"marketing_plan":{"phase1":"...","phase2":"...","phase3":"..."},"action_items":[{"week":1,"tasks":["..."]},{"week":2,"tasks":["..."]},{"week":3,"tasks":["..."]},{"week":4,"tasks":["..."]}],"success_metrics":["..."],"risk_mitigation":["..."]}`,
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
        <button class="notif-bell-btn" onclick="openNotificationPanel()" title="Notifications" style="position:relative;background:none;border:1px solid var(--border);border-radius:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text3);margin-right:2px;flex-shrink:0">
          🔔${unreadCount>0?`<span style="position:absolute;top:-4px;right:-4px;background:#f87171;color:#fff;border-radius:10px;font-size:.6rem;font-weight:900;padding:1px 5px;min-width:16px">${unreadCount}</span>`:''}
        </button>
        <div class="usage-pill" style="margin-right:4px;flex-shrink:0" title="AI Tool ব্যবহার">
          <span class="glow-dot ${isPro?'mint':'violet'}"></span>
          <span style="color:${isPro?'var(--a1)':r>0?'var(--a3)':'#f87171'}">${isPro?'∞':`${r}/${CONFIG.AI_TOOL_FREE_LIMIT}`}</span>
        </div>
        <button onclick="openApiKeyModal()" title="${hasUserKey?'নিজস্ব API Key সেট আছে':'API Key দিন'}" style="background:none;border:1px solid ${hasUserKey?'rgba(34,197,94,.3)':'var(--border)'};border-radius:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${hasUserKey?'#4ade80':'var(--text3)'};flex-shrink:0">🔑</button>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--a1),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;color:#0a0a14;flex-shrink:0">${nm.charAt(0).toUpperCase()}</div>
          <span style="font-size:.84rem;font-weight:700;color:#fff;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nm}</span>
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
function toggleSupport(){ document.getElementById('supportPanel')?.classList.toggle('open') }
function supportBodyHTML(){
  const nm = currentUserData?.name||'';
  const em = currentUser?.email||'';
  return `<div class="form-group"><label class="form-label">আপনার নাম</label><input class="form-control" id="supp-name" placeholder="নাম লিখুন" value="${nm}"></div>
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

  /* Pro User: Unlimited — কোনো limit check লাগবে না, key থাকলেই চলবে */
  /* Priority: user personal key → system key → error */
  const userKey = await FB.getUserApiKey();
  let apiKey = userKey;
  if(!apiKey){
    await Store.loadApiKeyFromFirestore();
    apiKey = Store.getApiKey();
  }
  if(!apiKey){
    resultEl.innerHTML = `<div class="alert alert-warning" style="flex-direction:column;gap:12px">
      <div>🔑 <strong>API Key সেট নেই!</strong></div>
      <div style="font-size:.85rem;color:var(--text2)">Tool ব্যবহার করতে আপনার OpenRouter API Key দিন।<br>
      <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--a1)">openrouter.ai/keys</a> থেকে ফ্রি key নিন।</div>
      <button class="btn btn-primary btn-sm" onclick="openApiKeyModal()">🔑 API Key দিন</button>
    </div>`;
    return null;
  }

  /* Normal User: lifetime সর্বোচ্চ ৩ বার, Pro: unlimited */
  const canRun = await Engine.checkLimit();
  if(!canRun){ resultEl.innerHTML=R.limitReached(); return null; }

  resultEl.innerHTML = R.skeleton(2);
  try{
    const data = await Engine.call(promptFn(inputs));
    /* Normal User হলে lifetime AI usage counter বাড়াও (Pro হলে কখনোই বাড়বে না) */
    if(!FB.isPro()) await FB.incAiUsageCount();
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
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${R.scoreCircle(data.overall_score)}<div><h3 style="color:#fff">${data.product_name}</h3><span class="tag ${vTag}" style="margin-top:4px">● ${(data.verdict||'').toUpperCase()}</span></div><div style="margin-left:auto;font-size:.82rem;color:var(--text2)">Trend: <strong style="color:${data.trend_direction==='rising'?'var(--a1)':'var(--a3)'}">${data.trend_direction}</strong></div></div>
    <p style="font-size:.87rem;margin-bottom:14px">${data.summary}</p>
    <div class="divider"></div>
    <div class="meter-row"><span class="meter-label">📈 Demand</span>${R.scoreBar(data.demand_score,'var(--a1)')}</div>
    <div class="meter-row"><span class="meter-label">⚔️ Competition</span>${R.scoreBar(data.competition_score,'var(--a3)')}</div>
    <div class="meter-row"><span class="meter-label">🌊 Saturation</span>${R.scoreBar(data.saturation_score,'#f87171')}</div>
    <div class="divider"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0"><div><div style="font-size:.77rem;color:var(--text2)">💰 আনুমানিক Margin</div><strong style="color:var(--a1)">${data.profit_margin_estimate}</strong></div><div><div style="font-size:.77rem;color:var(--text2)">🏷️ মূল্য পরিসর</div><strong style="color:#fff">${data.suggested_price_range}</strong></div></div>
    <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">🎯 Target Audience</strong>${R.tags(data.target_audience,'tag-mint')}</div>
    <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⭐ Selling Points</strong>${R.list(data.key_selling_points,'⭐')}</div>
    <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⚠️ Risks</strong>${R.list(data.risk_factors,'⚠️')}</div>
    <div><strong style="font-size:.83rem;color:var(--text2)">✅ পরামর্শ</strong>${R.list(data.recommendations,'→')}</div>
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
    <div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">🎣 Hooks</strong>${R.list(p.hooks,'🎣')}</div>
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
  document.getElementById('sf-result').innerHTML=`<div class="tabs"><button class="tab-btn active" onclick="switchTab('sf','plat',this)">🏭 Platforms</button><button class="tab-btn" onclick="switchTab('sf','check',this)">✅ Checklist</button><button class="tab-btn" onclick="switchTab('sf','email',this)">📧 Outreach</button></div>
  <div id="sf-tab-plat">${(data.platforms||[]).map(p=>`<div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">🏭 ${p.name}</div><strong style="font-size:.82rem;color:var(--text2)">Search Terms:</strong>${R.tags(p.search_terms,'tag-mint')}<p style="font-size:.84rem;margin-top:8px">💡 ${p.tips}</p></div>`).join('')}<div class="result-card fade-up" style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><div style="font-size:.77rem;color:var(--text2)">📦 COGS</div><strong style="color:var(--a1)">${data.estimated_cogs}</strong></div><div><div style="font-size:.77rem;color:var(--text2)">💹 Margin</div><strong style="color:var(--a3)">${data.recommended_margin}</strong></div></div></div>
  <div id="sf-tab-check" class="hidden"><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">✅ Verification</strong>${R.list(data.verification_checklist,'✅')}</div><div class="result-card fade-up"><strong style="font-size:.84rem;color:#f87171">🚩 Red Flags</strong>${R.list(data.red_flags,'🚩')}</div></div>
  <div id="sf-tab-email" class="hidden"><div class="result-card fade-up mb-2"><div style="font-size:.82rem;color:var(--text2);margin-bottom:6px">Subject: <strong style="color:#fff">${data.outreach_email?.subject}</strong></div>${R.copyBox(data.outreach_email?.body,'📋 Copy Email')}</div><div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">💼 Negotiation</strong>${R.list(data.negotiation_tips,'💼')}</div></div>`;
}

async function runCompetitor(){
  const product=document.getElementById('ca-product')?.value?.trim();
  if(!product){ Toast.error('Product/Niche দিন'); return; }
  const data=await runTool(Prompts.competitor_analysis,{product,competitors:document.getElementById('ca-competitors')?.value,platform:document.getElementById('ca-platform')?.value},'ca-result');
  if(!data)return;
  await FB.logEvent('competitor',{product});
  document.getElementById('ca-result').innerHTML=`<div class="result-card fade-up mb-2"><p style="font-size:.86rem">${data.market_overview}</p></div>${(data.competitors||[]).map(c=>`<div class="result-card fade-up mb-2"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><strong style="color:#fff">🏢 ${c.name}</strong><strong style="color:var(--a1)">${c.estimated_monthly_revenue}/mo</strong></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px"><div><div style="font-size:.73rem;color:var(--text2)">Price</div><strong style="color:#fff">${c.price_range}</strong></div><div><div style="font-size:.73rem;color:var(--text2)">Rating</div><strong style="color:var(--a3)">⭐ ${c.review_score}</strong></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><div style="font-size:.77rem;color:var(--a1);margin-bottom:4px">✅ Strengths</div>${R.list(c.strengths,'✅')}</div><div><div style="font-size:.77rem;color:#f87171;margin-bottom:4px">❌ Weaknesses</div>${R.list(c.weaknesses,'❌')}</div></div></div>`).join('')}<div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🔓 Market Gaps</strong>${R.list(data.market_gaps,'💡')}</div><div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">🏆 Win Strategy</strong>${R.list(data.win_strategy,'→')}</div>`;
}

async function runMarketReport(){
  const product=document.getElementById('mr-product')?.value?.trim();
  if(!product){ Toast.error('Product/Niche দিন'); return; }
  const data=await runTool(Prompts.market_report,{product,market:document.getElementById('mr-market')?.value,budget:document.getElementById('mr-budget')?.value},'mr-result');
  if(!data)return;
  await FB.logEvent('market_report',{product});
  document.getElementById('mr-result').innerHTML=`<div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.04))"><div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${R.scoreCircle(data.opportunity_score)}<div><h3 style="color:#fff;font-size:.97rem">${data.report_title}</h3><div style="display:flex;gap:6px;margin-top:5px"><span class="tag tag-mint">${data.market_size}</span><span class="tag ${data.demand_prediction==='increasing'?'tag-green':'tag-amber'}">${data.demand_prediction}</span></div></div></div><p style="font-size:.86rem">${data.executive_summary}</p></div>
  <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📈 Revenue Projections</strong><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px">${[['Month 1',data.financial_projections?.month1,'var(--a5)'],['Month 3',data.financial_projections?.month3,'var(--a1)'],['Month 6',data.financial_projections?.month6,'#4ade80']].map(([l,v,c])=>`<div style="text-align:center;padding:12px;background:rgba(0,0,0,.2);border-radius:10px"><div style="font-size:.71rem;color:var(--text2)">${l}</div><strong style="color:${c};font-size:.88rem">${v}</strong></div>`).join('')}</div></div>
  <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📊 Market Trends</strong>${R.list(data.market_trends,'📊')}</div>
  <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">⚠️ Risk Assessment</strong>${(data.risk_assessment||[]).map(r=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><strong style="color:#fff">${r.risk}</strong><span class="tag ${r.probability==='low'?'tag-green':r.probability==='medium'?'tag-amber':'tag-red'}">${r.probability}</span></div><p style="font-size:.82rem">🛡️ ${r.mitigation}</p></div>`).join('')}</div>
  <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">📅 Action Plan</strong>${(data.action_plan||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="tag tag-mint mb-1">Week ${w.week}</div>${R.list(w.actions,'→')}</div>`).join('')}<div style="margin-top:14px;padding:14px;background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.2);border-radius:10px;font-size:.86rem"><strong style="color:var(--a1)">চূড়ান্ত পরামর্শ:</strong> ${data.overall_recommendation}</div></div>`;
}

async function runPostGenerator(){
  const product=document.getElementById('pg-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.post_generator,{product,features:document.getElementById('pg-features')?.value,lang:document.getElementById('pg-lang')?.value},'pg-result');
  if(!data)return;
  await FB.logEvent('post_generator',{product});
  document.getElementById('pg-result').innerHTML=`${(data.posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">Post ${i+1} — ${p.type}</div>${p.title?`<div class="mb-1"><strong style="font-size:.82rem;color:var(--text2)">Title:</strong> <span style="color:#fff">${p.title}</span></div>`:''} ${R.copyBox(p.body,'📋 Copy Post')}<div style="margin-top:8px;font-size:.84rem;color:var(--a1)">📣 CTA: ${p.cta}</div></div>`).join('')}<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🏷️ Hashtags</strong>${R.tags(data.hashtags,'tag-violet')}<div style="margin-top:10px"><strong style="font-size:.83rem;color:var(--text2)">💡 Tips</strong>${R.list(data.tips,'💡')}</div></div>`;
}

async function runViralPost(){
  const topic=document.getElementById('vp-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  const data=await runTool(Prompts.viral_post,{topic,platform:document.getElementById('vp-platform')?.value,target:document.getElementById('vp-target')?.value},'vp-result');
  if(!data)return;
  await FB.logEvent('viral_post',{topic});
  const ec={curiosity:'tag-mint',fear:'tag-red',humor:'tag-green',greed:'tag-amber'};
  document.getElementById('vp-result').innerHTML=`${(data.viral_posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="tag tag-pink">Viral ${i+1}</span><span class="tag ${ec[p.emotion_trigger]||'tag-violet'}">${p.emotion_trigger}</span><span class="tag ${p.expected_reach==='high'?'tag-green':'tag-amber'}" style="margin-left:auto">${p.expected_reach} reach</span></div><div class="mb-2">${R.copyBox(p.hook,'Copy Hook')}</div>${R.copyBox(p.body,'📋 Copy Post')}<div style="margin-top:8px;font-size:.84rem"><strong style="color:var(--text2)">Viral Factor:</strong> <span style="color:var(--a1)">${p.viral_factor}</span></div></div>`).join('')}<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Elements</strong>${R.tags(data.trending_elements,'tag-red')}<div style="margin-top:10px;font-size:.84rem;color:var(--text2)">⏰ ${data.timing_tip}</div></div>`;
}

async function runPromoPost(){
  const product=document.getElementById('pp-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.promo_post,{product,offer:document.getElementById('pp-offer')?.value,duration:document.getElementById('pp-duration')?.value,platform:document.getElementById('pp-platform')?.value},'pp-result');
  if(!data)return;
  await FB.logEvent('promo_post',{product});
  document.getElementById('pp-result').innerHTML=`<div class="result-card fade-up mb-2" style="text-align:center;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(236,72,153,.06))"><div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:var(--a3)">${data.offer_headline}</div><div style="font-size:.84rem;color:var(--text2);margin-top:4px">${data.discount_angle}</div></div>${(data.promo_posts||[]).map(p=>`<div class="result-card fade-up mb-2"><div class="tag tag-amber mb-2">${p.style}</div><div class="mb-1"><strong style="font-size:.82rem;color:var(--text2)">Headline:</strong> <span style="color:#fff;font-weight:700">${p.headline}</span></div>${R.copyBox(p.body,'📋 Copy')}${p.countdown_text?`<div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,.1);border-radius:8px;font-size:.84rem;color:var(--a3)">⏳ ${p.countdown_text}</div>`:''}<div style="margin-top:8px;font-size:.84rem;color:var(--a1)">📣 ${p.cta}</div></div>`).join('')}<div class="result-card fade-up">${R.tags(data.hashtags,'tag-amber')}</div>`;
}

async function runAdCopy(){
  const product=document.getElementById('adc-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.ad_copy,{product,goal:document.getElementById('adc-goal')?.value,audience:document.getElementById('adc-audience')?.value,budget:document.getElementById('adc-budget')?.value},'adc-result');
  if(!data)return;
  await FB.logEvent('ad_copy',{product});
  document.getElementById('adc-result').innerHTML=`<div class="tabs"><button class="tab-btn active" onclick="switchTab('adc','fb',this)">📘 Facebook</button><button class="tab-btn" onclick="switchTab('adc','gg',this)">🔍 Google</button><button class="tab-btn" onclick="switchTab('adc','tips',this)">💡 Tips</button></div>
  <div id="adc-tab-fb">${(data.facebook_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-blue mb-2">Facebook Ad ${i+1}</div><div class="mb-2">${R.copyBox(ad.headline,'Headline')}</div>${R.copyBox(ad.primary_text,'Primary Text')}<div style="margin-top:8px;font-size:.83rem;color:var(--text2)">Pain Point: ${ad.pain_point}</div></div>`).join('')}</div>
  <div id="adc-tab-gg" class="hidden">${(data.google_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">Google Ad ${i+1}</div><div style="display:grid;gap:8px"><div>${R.copyBox(ad.headline1+' | '+ad.headline2+' | '+ad.headline3,'Headlines')}</div><div>${R.copyBox(ad.description1+'\n'+ad.description2,'Descriptions')}</div></div><div style="margin-top:8px;font-size:.83rem;color:var(--text2)">URL: ${ad.display_url}</div></div>`).join('')}</div>
  <div id="adc-tab-tips" class="hidden"><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">⚡ Power Words</strong>${R.tags(data.power_words,'tag-red')}</div><div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">💡 Conversion Tips</strong>${R.list(data.conversion_tips,'💡')}</div></div>`;
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
  const stageColors=['tag-blue','tag-violet','tag-green'];
  document.getElementById('af-result').innerHTML=`<div class="result-card fade-up mb-2"><p style="font-size:.86rem">${data.funnel_overview}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px"><div><div style="font-size:.77rem;color:var(--text2)">📊 Expected ROAS</div><strong style="color:var(--a1)">${data.expected_roas}</strong></div></div></div>${(data.stages||[]).map((s,i)=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span class="tag ${stageColors[i]||'tag-mint'}">${s.stage}</span><span style="font-size:.82rem;color:var(--text2)">Budget: ${s.budget_percentage}</span></div><div style="display:grid;gap:7px;font-size:.85rem"><div><span style="color:var(--text2)">🎯 Objective:</span> ${s.objective}</div><div><span style="color:var(--text2)">📢 Ad Type:</span> ${s.ad_type}</div><div><span style="color:var(--text2)">👥 Audience:</span> ${s.audience}</div></div><div style="margin-top:10px">${R.copyBox(s.example_copy,'Copy Example')}</div></div>`).join('')}<div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🔄 Retargeting</strong><p style="font-size:.85rem;margin-top:8px">${data.retargeting_strategy}</p></div><div class="result-card fade-up">${R.list(data.timeline,'→')}</div>`;
}

async function runConceptArchitect(){
  const idea=document.getElementById('con-idea')?.value?.trim();
  if(!idea){ Toast.error('Idea দিন'); return; }
  const data=await runTool(Prompts.concept_architect,{idea,industry:document.getElementById('con-industry')?.value,budget:document.getElementById('con-budget')?.value,goal:document.getElementById('con-goal')?.value},'con-result');
  if(!data)return;
  await FB.logEvent('concept_architect',{idea});
  document.getElementById('con-result').innerHTML=`<div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.04))"><h3 style="color:#fff;margin-bottom:6px">${data.concept_title}</h3><p style="font-size:.86rem;margin-bottom:12px">${data.executive_summary}</p><div style="padding:12px;background:rgba(0,245,212,.08);border-radius:10px;font-size:.88rem"><strong style="color:var(--a1)">💎 Value Proposition:</strong> ${data.unique_value_proposition}</div></div><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🎯 Target Market</strong><div style="margin-top:10px;display:grid;gap:6px;font-size:.85rem"><div><span style="color:var(--text2)">Primary:</span> <strong style="color:#fff">${data.target_market?.primary}</strong></div><div><span style="color:var(--text2)">Secondary:</span> ${data.target_market?.secondary}</div></div>${R.tags(data.target_market?.psychographics||[],'tag-violet')}</div><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">💰 Revenue Model</strong>${R.list(data.revenue_model?.streams||[],'💰')}<div style="font-size:.85rem;margin-top:6px"><span style="color:var(--text2)">Projected Monthly:</span> <strong style="color:var(--a1)">${data.revenue_model?.projected_monthly}</strong></div></div><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📅 4-Week Action Plan</strong>${(data.action_items||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="tag tag-mint mb-1">Week ${w.week}</div>${R.list(w.tasks,'→')}</div>`).join('')}</div><div class="result-card fade-up">${R.list(data.competitive_advantage,'✅')}</div>`;
}

/* ════════ INIT ════════ */
document.addEventListener('DOMContentLoaded',()=>{
  Toast.init();
  initFirebase();
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
