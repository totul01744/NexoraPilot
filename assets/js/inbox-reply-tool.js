/* ============================================================
   NexoraPilot — 💬 ইনবক্স রিপ্লাই মাস্টার
   কাস্টমারের ইনবক্স মেসেজ পেস্ট করুন → সেভ করা প্রোডাক্ট (নাম, বর্ণনা, ছবি)
   অনুযায়ী "ইনবক্সে বাজিমাত" বইয়ের টেকনিক (CARE মেথড, ৬ ভুল এড়ানো,
   ৪ ধরনের কাস্টমার, আপসেল, ফলো-আপ) মেনে কপি-রেডি উত্তর পান।

   নির্ভরতা (tools.html এ আগে থেকেই লোড হয়): app.js, gemini-engine.js, ecomnexora-tools.js
   সেভ: প্রথমে এই ব্রাউজারের IndexedDB (ছবিসহ), তারপর চেষ্টা করে Firestore
        (inboxReplyData/{uid}) — Firestore rule না থাকলে শুধু লোকালি সেভ থাকবে।
   ============================================================ */
(function(){
'use strict';
if(window.IR && window.IR.__loaded) return;   // দুবার লোড হলে আবার চালাবে না

const IR = window.IR = {};
IR.__loaded = true;
const MAX_PRODUCTS = 30;
const IMG_MAX = 640;      // AI-কে পাঠানো/লোকালি রাখা ছবির সর্বোচ্চ সাইড (px)
const THUMB_MAX = 320;    // তালিকা + ক্লাউডের জন্য ছোট ছবি
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val = id => ($(id)?.value || '').trim();
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const uid8 = () => 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ════════════════ State ════════════════ */
const S = {
  uid: null,
  loaded: false,
  data: { v: 1, updatedAt: 0, profile: {}, products: [], lastProductId: '' },
  selId: '',          // সিলেক্ট করা প্রোডাক্ট ('' = সাধারণ)
  cloud: 'unknown',   // ok | off | toolarge | unknown
  thread: [],         // [{role:'customer'|'me', text}]
  last: null,         // শেষ জেনারেশন {msg, reply, short, committed}
  editingId: null,
  formImg: '',        // ফর্মে থাকা ছবি (dataURL)
  busy: false,
};

const DEFAULT_PROFILE = {
  shop: '', owner: '', honor: 'স্যার/ম্যাম', tone: 'friendly',
  delivery: '', payment: '', policy: '', contact: '',
  order: 'নাম, পূর্ণ ঠিকানা, মোবাইল নম্বর', extra: ''
};

function normalize(d){
  d = (d && typeof d === 'object') ? d : {};
  return {
    v: 1,
    updatedAt: Number(d.updatedAt) || 0,
    profile: Object.assign({}, DEFAULT_PROFILE, d.profile || {}),
    products: Array.isArray(d.products) ? d.products.filter(p => p && p.id && p.name).map(p => ({
      id: String(p.id), name: String(p.name || ''), price: String(p.price || ''),
      desc: String(p.desc || ''), offer: String(p.offer || ''), urgency: String(p.urgency || ''),
      proof: String(p.proof || ''), guarantee: String(p.guarantee || ''), upsell: String(p.upsell || ''),
      img: String(p.img || ''), thumb: String(p.thumb || ''), updatedAt: Number(p.updatedAt) || 0
    })) : [],
    lastProductId: String(d.lastProductId || '')
  };
}

/* ════════════════ Local storage (IndexedDB → localStorage fallback) ════════════════ */
const Local = {
  _db: null,
  _open(){
    return new Promise((res, rej) => {
      if(!window.indexedDB) return rej(new Error('no indexedDB'));
      const r = indexedDB.open('nexorapilot_inbox', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(key){
    try{
      const db = this._db || (this._db = await this._open());
      return await new Promise((res, rej) => {
        const q = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => rej(q.error);
      });
    }catch(e){
      try{ return JSON.parse(localStorage.getItem('ir_' + key) || 'null'); }catch(_){ return null; }
    }
  },
  async set(key, value){
    try{
      const db = this._db || (this._db = await this._open());
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
      return true;
    }catch(e){
      try{ localStorage.setItem('ir_' + key, JSON.stringify(value)); return true; }
      catch(_){ return false; }
    }
  }
};

const byteLen = s => { try{ return new TextEncoder().encode(s).length; }catch(e){ return s.length * 3; } };

async function cloudPush(){
  if(typeof db === 'undefined' || !db || !S.uid || S.uid === 'guest') return;
  try{
    const payload = JSON.parse(JSON.stringify(S.data));
    payload.products.forEach(p => { p.img = ''; });          // বড় ছবি ক্লাউডে নয়, শুধু thumb
    let json = JSON.stringify(payload);
    if(byteLen(json) > 900000){ payload.products.forEach(p => { p.thumb = ''; }); json = JSON.stringify(payload); }
    if(byteLen(json) > 950000){ S.cloud = 'toolarge'; renderCloudBadge(); return; }
    await db.collection('inboxReplyData').doc(S.uid).set({ uid: S.uid, updatedAt: S.data.updatedAt, json });
    S.cloud = 'ok';
  }catch(e){
    S.cloud = 'off';
    console.warn('inboxReplyData cloud save failed (Firestore rule যোগ করলে সিঙ্ক চালু হবে):', e && e.message);
  }
  renderCloudBadge();
}

async function save(){
  S.data.updatedAt = Date.now();
  const ok = await Local.set(S.uid, S.data);
  if(!ok) Toast.error('এই ব্রাউজারে সেভ করা যায়নি (জায়গা শেষ?) — কিছু পুরোনো প্রোডাক্ট/ছবি মুছুন।');
  cloudPush();   // await না — ব্যাকগ্রাউন্ডে
  return ok;
}

async function load(){
  const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : 'guest';
  if(S.loaded && S.uid === uid) return;
  S.uid = uid; S.loaded = false;
  const local = await Local.get(uid);
  let data = normalize(local);
  if(typeof db !== 'undefined' && db && uid !== 'guest'){
    try{
      const snap = await db.collection('inboxReplyData').doc(uid).get();
      S.cloud = 'ok';
      if(snap.exists){
        let c = null;
        try{ c = normalize(JSON.parse(snap.data().json || 'null')); }catch(e){}
        if(c && c.updatedAt > data.updatedAt){
          const lm = new Map(data.products.map(p => [p.id, p]));
          c.products.forEach(p => {
            const l = lm.get(p.id);
            if(l && l.img) p.img = l.img; else if(!p.img && p.thumb) p.img = p.thumb;
          });
          data = c;
          await Local.set(uid, data);
        }
      }
    }catch(e){ S.cloud = 'off'; }
  }
  S.data = data;
  S.selId = data.products.some(p => p.id === data.lastProductId) ? data.lastProductId : (data.products[0]?.id || '');
  S.loaded = true;
}

/* ════════════════ Image helpers ════════════════ */
function loadImage(src){
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('ছবি পড়া যায়নি')); im.src = src; });
}
async function shrink(src, max, q){
  const im = await loadImage(src);
  const s = Math.min(1, max / Math.max(im.width, im.height));
  const w = Math.max(1, Math.round(im.width * s)), h = Math.max(1, Math.round(im.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q);
}
async function fileToCompressed(file){
  const url = URL.createObjectURL(file);
  try{ return await shrink(url, IMG_MAX, 0.75); }
  finally{ URL.revokeObjectURL(url); }
}

/* ════════════════ Gemini কল (system prompt + ছবি + JSON) ════════════════ */
async function geminiCall({ system, userText, imageDataUrl, temperature, json }){
  const key = GStore.getKey();
  if(!key) throw new Error('NO_KEY');
  const models = [GEMINI_CONFIG.TEXT_MODEL].concat(FALLBACK_MODELS.filter(m => m !== GEMINI_CONFIG.TEXT_MODEL));
  let lastErr = null;

  for(const model of models){
    for(const withImg of (imageDataUrl ? [true, false] : [false])){
      const parts = [];
      if(withImg){
        const m = imageDataUrl.match(/^data:(.*?);base64,(.*)$/);
        if(m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
      }
      parts.push({ text: userText });
      const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: Object.assign({ temperature: temperature == null ? 0.8 : temperature }, json ? { responseMimeType: 'application/json' } : {})
      };
      if(system) body.systemInstruction = { parts: [{ text: system }] };

      let res;
      for(let attempt = 0; attempt < 2; attempt++){      // মডেল ব্যস্ত (5xx) হলে একবার অপেক্ষা করে আবার
        try{
          res = await fetch(`${GEMINI_CONFIG.BASE}/${model}:generateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
        }catch(e){ throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।'); }
        if(res.status < 500 || attempt === 1) break;
        await new Promise(r => setTimeout(r, 1800));
      }

      if(res.ok){
        const data = await res.json().catch(() => ({}));
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
        if(text) return text;
        lastErr = new Error(data.promptFeedback?.blockReason ? `Gemini ব্লক করেছে: ${data.promptFeedback.blockReason}` : 'কোনো আউটপুট পাওয়া যায়নি। আবার চেষ্টা করুন।');
        continue;
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || '';
      if(res.status === 429) throw new Error('একটু বেশি রিকোয়েস্ট হয়ে গেছে (rate limit) — ১ মিনিট পর আবার চেষ্টা করুন।');
      if((res.status === 400 && /api key/i.test(msg)) || res.status === 401 || res.status === 403){
        throw new Error('Gemini API Key কাজ করছে না (' + res.status + '): ' + msg.substring(0, 120));
      }
      lastErr = new Error(`Gemini Error (${res.status}): ${msg.substring(0, 150) || 'সমস্যা হয়েছে'}`);
      // 404 = এই মডেল নেই → সরাসরি পরের মডেলে। 400 (ছবি/সেটিং সমস্যা) / 5xx → ছবি ছাড়া, তারপর পরের মডেল
      if(res.status === 404) break;
    }
  }
  throw lastErr || new Error('উত্তর তৈরি করা যায়নি। আবার চেষ্টা করুন।');
}

function parseJSON(text){
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try{ return JSON.parse(t); }catch(e){}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a){ try{ return JSON.parse(t.slice(a, b + 1)); }catch(e){} }
  return null;
}

/* ════════════════ System prompt — বইয়ের টেকনিক ════════════════ */
const SYSTEM_PROMPT = `You are an expert inbox-sales coach and copywriter for Bangladeshi online shops (Facebook page / Messenger / WhatsApp). The shop owner pastes a customer's message; you write the reply the owner will copy-paste back to the customer. The reply must keep the conversation alive, build trust, and move the customer one step closer to ordering — without pressure and without lies.

LANGUAGE
- "reply" and "short_reply" use the same language the customer used. Default = Bangla script (also when the customer writes Bangla in English letters / Banglish — answer in Bangla script). If the customer writes in English, answer in English.
- All analysis fields (situation, techniques_used, follow_up note, upsell_tip, missing_info, next_step_tip) are in Bangla.

CORE RULES (the "ইনবক্সে বাজিমাত" method)
1. Never let the conversation die. A bare price ("৫৯৯ টাকা"), a bare "হ্যাঁ/না", or "অর্ডার করতে পারেন" is a FAILED reply. Every reply = a direct answer + value/trust + exactly ONE easy question that invites the customer to reply again (a customer who replies a second time is interested and can be converted).
2. Customers buy the solution to THEIR problem, not a product. Order of a good reply: acknowledge their problem/choice → connect with them ("অনেকেরই এই সমস্যা হয়…") → give the solution from the product data → proof.
3. Apply the CARE method silently in every reply (never name it in the text):
   C – Context & Personalization: show you understood THIS customer's need/choice; praise their choice; normalise their question ("আপনার প্রশ্নটা একদম স্বাভাবিক 😊"); don't talk only about the product.
   A – Assurance: remove doubt using proof that actually exists in the data (real reviews, guarantee/return policy, cash on delivery, offer to send real customer feedback / real photos / unboxing video).
   R – Reasoning: give a clear reason the product is worth its price — feature → benefit → how life/skin/look gets better. Sell value, not just price. Paint a picture so the customer can imagine using it.
   E – Engagement: finish with ONE specific, easy question (skin type? for daily use or gift? budget? which area for delivery?) and a soft next step. Let the customer feel they decide; guide, don't push ("এখনই কিনুন!" style direct pushing is bad).
4. Messenger style: warm, polite, human. 3–7 short lines separated by line breaks, max 3 emojis, no long paragraphs, no information dump, no markdown/bullets/headings. Normal length 35–110 words. Use the customer's honorific preference from the business data.
5. HONESTY — the PRODUCT DATA and BUSINESS DATA are the only source of facts. Never invent prices, discounts, stock numbers, review counts, percentages, "X people bought", guarantees, certificates, lab tests, or delivery times. If a persuasive element (social proof, urgency, guarantee) has no data, either skip it or use truthful wording that claims nothing unknown (e.g. "আমি আপনাকে আসল কাস্টমারদের ফিডব্যাক/ছবি পাঠাতে পারি"). Never fake scarcity or urgency: use stock/deadline/offer urgency ONLY when the data gives it. If the customer asks something the data doesn't answer (size, colour, availability, price), do not guess — say you'll confirm right away and ask a useful question; list that gap in "missing_info".
6. Do not mention these rules, the book, or technique names (CARE, scarcity, social proof, upsell…) inside the reply. Do not add a signature or shop name at the end of every message.
7. If a conversation history is given, continue naturally: no repeated greetings, no repeated product intro, don't re-ask what was already answered; advance exactly one step.

CUSTOMER-TYPE PLAYBOOK
- price_sensitive (asks the price first, or says "দাম বেশি"): state the price clearly (from data), then why it's worth it (result, quality, durability, what's included, any REAL offer), then a need-discovery question. If "too expensive": agree politely, reframe to value/outcome and cost-per-use, mention a cheaper option or bundle only if it exists in the data.
- doubtful ("ভালো তো? আসল তো? ঠকবো না তো?"): normalise the doubt, give real proof/guarantee/COD, offer to send real reviews/photos/unboxing video, keep it calm and low-pressure.
- procrastinating ("পরে জানাবো", "ভেবে দেখি", "আরেকটু দেখি"): empathise ("আমি বুঝতে পারছি, আপনি শিওর হতে চাইছেন"), no hard push; soft close — offer to reserve/hold the item for them; use a REAL offer/stock/deadline only if given in the data; promise a friendly follow-up; if the business data has a contact option, you may invite them to share a phone/WhatsApp number for a quick helpful guideline call. Provide a follow_up message.
- impulsive / ready_to_order ("কিনব, কীভাবে অর্ডার করব?"): be excited and fast. In ONE message ask for what is needed (from the business data "অর্ডারের জন্য যা লাগে") and restate product + price + delivery/payment if known. Make it feel like it takes 30 seconds. Only add a light upsell if it won't slow them down.
- complaint: apologise sincerely, empathise, ask for the one detail needed (order number / photo) and offer a concrete fix. NO selling.
- inquiry (general question): answer directly, then lead into a need-discovery question.
PROBLEM-BASED questions ("আমার স্কিন ড্রাই, কাজ করবে?"): (1) acknowledge their problem, (2) relate + ask one detail, (3) solution from the product data, (4) proof if available.
COMPARING / CONFUSED customers: reduce the options — "আপনার যদি … দরকার হয়, তাহলে এটাই আপনার জন্য সেরা, কারণ …".
UPSELL: only after the main product is wanted/confirmed. Suggest at most ONE complementary product, preferably from the shop's catalog list or the product's "upsell" field, with a reason in terms of the customer's benefit. Mention a bundle/discount only if the data has an offer. Soft, never forced. If nothing suitable exists, leave upsell_tip empty.

OUTPUT — return ONLY valid JSON, no markdown fences, exactly these keys:
{
  "customer_type": "price_sensitive | doubtful | procrastinating | impulsive | ready_to_order | complaint | inquiry",
  "situation": "১ বাক্যে বাংলায়: কাস্টমারের মনে কী চলছে / সে আসলে কী চায়",
  "reply": "the main ready-to-send message",
  "short_reply": "a shorter version (about half the length) with the same goal; still ends with one question",
  "techniques_used": ["২–৪টি ছোট বাংলা পয়েন্ট — এই উত্তরে কোন কৌশল কেন ব্যবহার হয়েছে"],
  "follow_up": "a short friendly message to send if the customer doesn't reply within ~24 hours (not pushy). Empty string if not relevant",
  "upsell_tip": "১ লাইনে বাংলায় আপসেল সাজেশন, না থাকলে empty string",
  "missing_info": ["প্রোডাক্ট/ব্যবসার যে তথ্য যোগ করলে উত্তর আরও জোরালো হতো — বাংলায়, না থাকলে empty array"],
  "next_step_tip": "১ লাইনে বাংলায়: কাস্টমার এরপর কী বললে আপনি কী করবেন"
}`;

const DESCRIBE_SYSTEM = `You write product notes for a Bangladeshi online seller. Look at the product photo and describe what is clearly visible, in Bangla: product type, colour, material/texture (only if visible), design/style, notable features, and likely use. Plain text, 3–6 short lines, no markdown. Do NOT invent price, brand, size, quantity, reviews or claims that cannot be seen in the photo.`;

function buildUserPrompt(o){
  const p = o.product, pr = o.profile, L = [];
  const v = x => (x && String(x).trim()) ? String(x).trim() : '(দেওয়া নেই)';
  const cut = (x, n) => String(x || '').slice(0, n);

  L.push('## ব্যবসার তথ্য');
  L.push('দোকান/পেজের নাম: ' + v(pr.shop));
  L.push('উত্তরদাতার নাম: ' + v(pr.owner));
  L.push('কাস্টমারকে সম্বোধন: ' + v(pr.honor));
  L.push('কথার টোন: ' + ({ friendly: 'বন্ধুসুলভ ও আন্তরিক', professional: 'পেশাদার ও বিনয়ী', energetic: 'উৎসাহী ও প্রাণবন্ত' }[pr.tone] || 'বন্ধুসুলভ ও আন্তরিক'));
  L.push('ডেলিভারি তথ্য: ' + v(pr.delivery));
  L.push('পেমেন্ট পদ্ধতি: ' + v(pr.payment));
  L.push('রিটার্ন/ওয়ারেন্টি পলিসি: ' + v(pr.policy));
  L.push('কল/হোয়াটসঅ্যাপ যোগাযোগ: ' + v(pr.contact));
  L.push('অর্ডারের জন্য যা লাগে: ' + v(pr.order));
  if(pr.extra && pr.extra.trim()) L.push('ব্যবসার বিশেষ নির্দেশনা: ' + cut(pr.extra, 600));
  L.push('');

  if(p){
    L.push('## প্রোডাক্টের তথ্য (শুধু এই তথ্যকেই সত্য ধরবে' + (p.img ? '; সাথে প্রোডাক্টের ছবিও দেওয়া আছে, ছবি দেখে রং/ডিজাইন বুঝে নাও' : '') + ')');
    L.push('নাম: ' + v(p.name));
    L.push('দাম: ' + v(p.price));
    L.push('বর্ণনা/ফিচার: ' + v(cut(p.desc, 1800)));
    L.push('চলমান অফার/ডিসকাউন্ট/বান্ডেল: ' + v(p.offer));
    L.push('আসল Urgency/Scarcity তথ্য (স্টক/সময়সীমা): ' + v(p.urgency));
    L.push('আসল সোশ্যাল প্রুফ/রিভিউ তথ্য: ' + v(p.proof));
    L.push('গ্যারান্টি/ওয়ারেন্টি/রিটার্ন: ' + v(p.guarantee));
    L.push('আপসেলে যা সাজেস্ট করা যাবে: ' + v(p.upsell));
  }else{
    L.push('## প্রোডাক্ট: কোনো নির্দিষ্ট প্রোডাক্ট সিলেক্ট করা নেই — সাধারণ উত্তর দাও, প্রোডাক্টের কোনো তথ্য বানাবে না; দরকার হলে কাস্টমারকে জিজ্ঞেস করো সে কোন প্রোডাক্ট চায়।');
  }
  if(o.others && o.others.length){
    L.push('');
    L.push('## দোকানের অন্যান্য প্রোডাক্ট (আপসেল/ক্রস-সেলের জন্য — এর বাইরে কিছু বানাবে না)');
    o.others.slice(0, 12).forEach(x => L.push('- ' + x.name + (x.price ? ' — ' + x.price : '') + (x.desc ? ' — ' + cut(x.desc, 70).replace(/\s+/g, ' ') : '')));
  }

  const hist = [];
  if(o.history && o.history.trim()) hist.push('(আগে থেকে পেস্ট করা কথোপকথন)\n' + cut(o.history.trim(), 3000));
  if(o.thread && o.thread.length){
    hist.push(o.thread.slice(-12).map(t => (t.role === 'customer' ? 'কাস্টমার: ' : 'আমি: ') + t.text).join('\n'));
  }
  if(hist.length){ L.push(''); L.push('## এই কাস্টমারের সাথে এখন পর্যন্ত কথোপকথন'); L.push(hist.join('\n\n')); }

  L.push('');
  L.push('## কাস্টমারের সর্বশেষ মেসেজ (এর উত্তর দাও)');
  L.push(cut(o.msg, 2500));
  if(o.extra && o.extra.trim()){ L.push(''); L.push('## দোকানদারের অতিরিক্ত নির্দেশনা (অবশ্যই মানবে)'); L.push(cut(o.extra, 500)); }
  if(o.variant){ L.push(''); L.push('এটি আগের উত্তরের চেয়ে ভিন্ন একটি ভার্সন — ভিন্ন শুরু, ভিন্ন অ্যাঙ্গেল ও ভিন্ন প্রশ্ন ব্যবহার করো।'); }
  L.push('');
  L.push('এখন সিস্টেম নির্দেশনা মেনে শুধু JSON দাও।');
  return L.join('\n');
}

/* ════════════════ লিমিট চেক + usage (অন্য টুলগুলোর মতোই) ════════════════ */
async function guard(el){
  if(!GeminiEngine.hasKey()){ el.innerHTML = GeminiEngine.noKeyMsg(); return false; }
  const ok = await Engine.checkLimit();
  if(!ok){ el.innerHTML = await R.limitReached(); return false; }
  return true;
}
async function afterUse(name, data){
  try{ await FB.incUsage(); await updateUsageDisplay(); if(name) await FB.logEvent(name, data || {}); }catch(e){}
}

/* ════════════════ UI: skeleton HTML (tool.html) ════════════════ */
const TOOL_HTML = `
<div class="card ir-card" id="ir-root" style="padding:24px">
  <div class="ir-head">
    <h3>💬 ইনবক্স রিপ্লাই মাস্টার</h3>
    <span id="ir-cloud" class="ir-cloud"></span>
  </div>
  <p class="ir-sub">কাস্টমারের মেসেজ পেস্ট করুন, প্রোডাক্ট সিলেক্ট করুন — "ইনবক্সে বাজিমাত" বইয়ের CARE মেথড অনুযায়ী কপি-রেডি উত্তর পাবেন, যাতে কাস্টমার দাম শুনে চলে না গিয়ে আবার রিপ্লাই দেয়।</p>

  <div class="tabs">
    <button class="tab-btn active" id="ir-tab-reply" onclick="IR.tab('reply')">💬 উত্তর তৈরি</button>
    <button class="tab-btn" id="ir-tab-products" onclick="IR.tab('products')">📦 আমার প্রোডাক্ট <span id="ir-count">(0)</span></button>
    <button class="tab-btn" id="ir-tab-profile" onclick="IR.tab('profile')">⚙️ ব্যবসার তথ্য</button>
  </div>

  <!-- ═══ উত্তর তৈরি ═══ -->
  <div id="ir-pane-reply">
    <div class="form-group">
      <label class="form-label">কোন প্রোডাক্ট নিয়ে কথা হচ্ছে? *</label>
      <div class="ir-chips" id="ir-chips"></div>
      <div id="ir-prod-hint" class="ir-hint"></div>
    </div>

    <div id="ir-thread-box" class="ir-thread hidden"></div>

    <div class="form-group">
      <label class="form-label">কাস্টমারের মেসেজ * <span class="ir-opt">(ইনবক্স থেকে কপি করে পেস্ট করুন)</span></label>
      <textarea class="form-control" id="ir-msg" rows="4" placeholder="যেমন: ভাই প্রাইস কত?   /   আপু এটা ভালো তো? ঠকবো না তো?   /   পরে জানাবো"></textarea>
    </div>

    <details class="ir-more">
      <summary>➕ আরও তথ্য দিন (ঐচ্ছিক) — আগের কথোপকথন / বিশেষ নির্দেশনা</summary>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">বিশেষ নির্দেশনা</label>
        <input class="form-control" id="ir-extra" placeholder="যেমন: আজ ১০% ডিসকাউন্ট দিতে পারো / কাস্টমার ঢাকার বাইরে / নম্বর নিতে চাই">
      </div>
      <div class="form-group">
        <label class="form-label">আগের কথোপকথন (কাস্টমার মাঝপথে এলে)</label>
        <textarea class="form-control" id="ir-history" rows="4" placeholder="কাস্টমার: ...&#10;আমি: ..."></textarea>
      </div>
    </details>

    <button class="btn btn-primary" id="ir-gen-btn" onclick="IR.generate(false)">💬 সেরা উত্তর তৈরি করুন</button>
    <div id="ir-result" class="result-area mt-3"></div>
  </div>

  <!-- ═══ আমার প্রোডাক্ট ═══ -->
  <div class="hidden" id="ir-pane-products">
    <div id="ir-plist"></div>
    <div id="ir-pform" class="ir-form hidden">
      <h4 id="ir-pform-title" style="margin-bottom:14px">➕ নতুন প্রোডাক্ট</h4>
      <div class="ir-grid2">
        <div class="form-group"><label class="form-label">প্রোডাক্টের নাম *</label><input class="form-control" id="irf-name" placeholder="যেমন: অ্যালোভেরা ময়েশ্চারাইজার ক্রিম"></div>
        <div class="form-group"><label class="form-label">দাম</label><input class="form-control" id="irf-price" placeholder="যেমন: ৫৯৯ টাকা (২টা নিলে ১০৫০ টাকা)"></div>
      </div>
      <div class="form-group">
        <label class="form-label">প্রোডাক্টের ছবি <span class="ir-opt">(AI ছবি দেখে রং/ডিজাইন বুঝবে)</span></label>
        <div class="ir-imgrow">
          <img id="irf-preview" class="ir-preview hidden" alt="">
          <div>
            <input class="form-control" type="file" accept="image/*" id="irf-img" onchange="IR.pickImage(this)">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              <button type="button" class="btn btn-secondary btn-sm hidden" id="irf-rmimg" onclick="IR.removeImage()">🗑️ ছবি সরান</button>
              <button type="button" class="btn btn-secondary btn-sm hidden" id="irf-aidesc" onclick="IR.describeFromImage(this)">🤖 ছবি দেখে বর্ণনা লিখে দিন</button>
            </div>
          </div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">বর্ণনা / ফিচার / উপকারিতা *</label><textarea class="form-control" id="irf-desc" rows="5" placeholder="কী দিয়ে তৈরি, কার জন্য, কী কাজ করে, সাইজ/রং/ওজন, ব্যবহারের নিয়ম — যত বিস্তারিত, উত্তর তত নিখুঁত"></textarea></div>
      <div class="ir-grid2">
        <div class="form-group"><label class="form-label">চলমান অফার / বান্ডেল</label><input class="form-control" id="irf-offer" placeholder="যেমন: ২টা নিলে ফ্রি ডেলিভারি"></div>
        <div class="form-group"><label class="form-label">আসল স্টক / সময়সীমা (Urgency)</label><input class="form-control" id="irf-urgency" placeholder="যেমন: আজ রাত ১২টা পর্যন্ত ১০% ছাড় / স্টকে ১০টি"></div>
        <div class="form-group"><label class="form-label">আসল রিভিউ / সোশ্যাল প্রুফ</label><input class="form-control" id="irf-proof" placeholder="যেমন: গত মাসে ২০০+ অর্ডার ডেলিভারি হয়েছে"></div>
        <div class="form-group"><label class="form-label">গ্যারান্টি / ওয়ারেন্টি / রিটার্ন</label><input class="form-control" id="irf-guarantee" placeholder="যেমন: ৭ দিনের রিপ্লেসমেন্ট, ক্যাশ অন ডেলিভারি"></div>
      </div>
      <div class="form-group"><label class="form-label">সাথে সাজেস্ট করার প্রোডাক্ট (আপসেল)</label><input class="form-control" id="irf-upsell" placeholder="যেমন: সিরাম — ক্রিমের সাথে নিলে ভালো রেজাল্ট"></div>
      <div class="ir-hint" style="margin-bottom:14px">💡 <b>অফার, স্টক, রিভিউ, গ্যারান্টি</b> ঘরগুলোতে শুধু আসল তথ্য দিন। AI এই তথ্যের বাইরে কোনো সংখ্যা/রিভিউ/"স্টক শেষ" বানিয়ে বলবে না — ফাঁকা রাখলে সে ওই কৌশলটা বাদ দেবে বা সত্যি কথায় কাজ চালাবে।</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" id="irf-save" onclick="IR.saveProduct()">💾 সেভ করুন</button>
        <button class="btn btn-secondary" onclick="IR.closeForm()">বাতিল</button>
      </div>
    </div>
  </div>

  <!-- ═══ ব্যবসার তথ্য ═══ -->
  <div class="hidden" id="ir-pane-profile">
    <p class="ir-hint" style="margin-bottom:14px">এই তথ্য একবার সেভ করলে সব উত্তরে কাজে লাগবে। যা জানেন না, ফাঁকা রাখুন।</p>
    <div class="ir-grid2">
      <div class="form-group"><label class="form-label">দোকান / পেজ / কোম্পানির নাম</label><input class="form-control" id="irp-shop" placeholder="যেমন: রূপসী কালেকশন"></div>
      <div class="form-group"><label class="form-label">আপনার (উত্তরদাতার) নাম</label><input class="form-control" id="irp-owner" placeholder="যেমন: তুলি"></div>
      <div class="form-group"><label class="form-label">কাস্টমারকে সম্বোধন</label>
        <select class="form-control" id="irp-honor"><option>স্যার/ম্যাম</option><option>আপু/ভাইয়া</option><option>আপনি (লিঙ্গ-নিরপেক্ষ)</option></select></div>
      <div class="form-group"><label class="form-label">কথার টোন</label>
        <select class="form-control" id="irp-tone"><option value="friendly">😊 বন্ধুসুলভ ও আন্তরিক</option><option value="professional">👔 পেশাদার ও বিনয়ী</option><option value="energetic">🔥 উৎসাহী ও প্রাণবন্ত</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">ডেলিভারি তথ্য</label><input class="form-control" id="irp-delivery" placeholder="যেমন: ঢাকায় ৬০ টাকা (১-২ দিন), ঢাকার বাইরে ১২০ টাকা (২-৪ দিন)"></div>
    <div class="form-group"><label class="form-label">পেমেন্ট পদ্ধতি</label><input class="form-control" id="irp-payment" placeholder="যেমন: ক্যাশ অন ডেলিভারি / বিকাশ"></div>
    <div class="form-group"><label class="form-label">রিটার্ন / ওয়ারেন্টি পলিসি (সব প্রোডাক্টের জন্য)</label><input class="form-control" id="irp-policy" placeholder="যেমন: পণ্য হাতে পেয়ে চেক করে নেওয়া যাবে"></div>
    <div class="ir-grid2">
      <div class="form-group"><label class="form-label">কল / হোয়াটসঅ্যাপ নম্বর</label><input class="form-control" id="irp-contact" placeholder="01XXXXXXXXX"></div>
      <div class="form-group"><label class="form-label">অর্ডারের জন্য যা লাগে</label><input class="form-control" id="irp-order" placeholder="নাম, পূর্ণ ঠিকানা, মোবাইল নম্বর"></div>
    </div>
    <div class="form-group"><label class="form-label">বিশেষ নির্দেশনা (ঐচ্ছিক)</label><textarea class="form-control" id="irp-extra" rows="3" placeholder="যেমন: কখনো ডিসকাউন্ট অফার করবে না / সব উত্তরে ইনশাআল্লাহ বলবে"></textarea></div>
    <button class="btn btn-primary" onclick="IR.saveProfile()">💾 সেভ করুন</button>
  </div>
</div>`;

/* ════════════════ Rendering ════════════════ */
function renderCloudBadge(){
  const el = $('ir-cloud'); if(!el) return;
  const m = {
    ok: ['☁️ ক্লাউডে সেভ হচ্ছে', 'ok'],
    off: ['💾 শুধু এই ব্রাউজারে সেভ আছে', 'warn'],
    toolarge: ['💾 ক্লাউডের জন্য ডাটা বড় — শুধু এই ব্রাউজারে', 'warn'],
    unknown: ['', '']
  }[S.cloud] || ['', ''];
  el.textContent = m[0]; el.className = 'ir-cloud ' + m[1];
  el.title = S.cloud === 'off' ? 'Firestore-এ inboxReplyData rule যোগ করলে অন্য ডিভাইসেও প্রোডাক্ট পাবেন' : '';
}

function renderCount(){ const c = $('ir-count'); if(c) c.textContent = '(' + bn(S.data.products.length) + ')'; }

function renderChips(){
  const box = $('ir-chips'); if(!box) return;
  const items = [{ id: '', name: 'সাধারণ উত্তর', price: 'প্রোডাক্ট ছাড়া', thumb: '' }].concat(S.data.products);
  box.innerHTML = items.map(p => `
    <button type="button" class="ir-chip ${S.selId === p.id ? 'active' : ''}" onclick="IR.selectProduct('${esc(p.id)}')">
      ${p.thumb || p.img ? `<img src="${p.thumb || p.img}" alt="">` : `<span class="ir-chip-ph">${p.id ? '📦' : '🌐'}</span>`}
      <span class="ir-chip-t"><b>${esc(p.name)}</b><small>${esc(p.price || '')}</small></span>
    </button>`).join('');
  const hint = $('ir-prod-hint'); if(!hint) return;
  if(!S.data.products.length){
    hint.innerHTML = `👉 এখনো কোনো প্রোডাক্ট সেভ করা নেই। <a href="#" onclick="IR.tab('products');IR.openForm();return false;" style="font-weight:800">প্রথম প্রোডাক্টটি যোগ করুন</a> — তাহলে উত্তর সেই প্রোডাক্টের তথ্য অনুযায়ী আসবে।`;
  }else if(!S.selId){
    hint.textContent = 'প্রোডাক্ট সিলেক্ট না করলে AI শুধু সাধারণ উত্তর দেবে।';
  }else{
    const p = S.data.products.find(x => x.id === S.selId);
    const miss = [];
    if(p){ if(!p.desc.trim()) miss.push('বর্ণনা'); if(!p.price.trim()) miss.push('দাম'); }
    hint.innerHTML = miss.length ? `⚠️ এই প্রোডাক্টে <b>${miss.join(', ')}</b> নেই — যোগ করলে উত্তর আরও নিখুঁত হবে।` : '';
  }
}

function renderThread(){
  const box = $('ir-thread-box'); if(!box) return;
  if(!S.thread.length){ box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `
    <details>
      <summary>📜 এই কাস্টমারের সাথে কথোপকথন (${bn(S.thread.length)}টি মেসেজ মনে আছে)</summary>
      <div class="ir-thread-list">${S.thread.map(t => `<div class="ir-turn ${t.role}"><b>${t.role === 'customer' ? '👤 কাস্টমার' : '🧑‍💼 আমি'}</b>${esc(t.text)}</div>`).join('')}</div>
    </details>
    <button type="button" class="btn btn-secondary btn-sm" onclick="IR.resetThread()">🆕 নতুন কাস্টমার (কথোপকথন মুছুন)</button>`;
}

function renderProductList(){
  const box = $('ir-plist'); if(!box) return;
  const ps = S.data.products;
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div class="ir-hint" style="margin:0">${bn(ps.length)}/${bn(MAX_PRODUCTS)}টি প্রোডাক্ট সেভ আছে</div>
      <button class="btn btn-primary btn-sm" onclick="IR.openForm()">➕ নতুন প্রোডাক্ট</button>
    </div>
    ${ps.length ? ps.map(p => `
      <div class="ir-pitem">
        ${p.thumb || p.img ? `<img src="${p.thumb || p.img}" alt="">` : `<div class="ir-pitem-ph">📦</div>`}
        <div class="ir-pitem-body">
          <b>${esc(p.name)}</b>
          <span class="ir-pitem-price">${esc(p.price || 'দাম দেওয়া নেই')}</span>
          <p>${esc((p.desc || '').slice(0, 110))}${(p.desc || '').length > 110 ? '…' : ''}</p>
          <div class="ir-pitem-act">
            <button class="btn btn-secondary btn-sm" onclick="IR.useProduct('${esc(p.id)}')">💬 এটা নিয়ে উত্তর দিন</button>
            <button class="btn btn-secondary btn-sm" onclick="IR.openForm('${esc(p.id)}')">✏️ এডিট</button>
            <button class="btn btn-danger btn-sm" onclick="IR.deleteProduct('${esc(p.id)}')">🗑️</button>
          </div>
        </div>
      </div>`).join('') : `<div class="ir-empty">📦 এখনো কোনো প্রোডাক্ট নেই। "নতুন প্রোডাক্ট" চেপে নাম, বর্ণনা ও ছবি সেভ করুন — একবার সেভ করলেই হবে, বারবার দিতে হবে না।</div>`}`;
}

function fillProfileForm(){
  const p = S.data.profile;
  [['shop','irp-shop'],['owner','irp-owner'],['honor','irp-honor'],['tone','irp-tone'],['delivery','irp-delivery'],
   ['payment','irp-payment'],['policy','irp-policy'],['contact','irp-contact'],['order','irp-order'],['extra','irp-extra']]
    .forEach(([k, id]) => { const el = $(id); if(el) el.value = p[k] || ''; });
}

/* ════════════════ Public API (onclick থেকে) ════════════════ */
IR.html = TOOL_HTML;

let _lastOpen = 0;
IR.open = async function(){
  if(Date.now() - _lastOpen < 600) return;      // tools.html ও হুক দুটোই ডাকলে একবারই চলবে
  _lastOpen = Date.now();
  document.getElementById('toolLangBar')?.remove();   // এই টুলে ভাষা টগল দরকার নেই — উত্তর কাস্টমারের ভাষায় হয়
  S.thread = []; S.last = null; S.editingId = null;
  try{ await load(); }catch(e){ console.error(e); }
  renderCount(); renderChips(); renderProductList(); fillProfileForm(); renderThread(); renderCloudBadge();
};

IR.tab = function(name){
  ['reply', 'products', 'profile'].forEach(n => {
    $('ir-pane-' + n)?.classList.toggle('hidden', n !== name);
    $('ir-tab-' + n)?.classList.toggle('active', n === name);
  });
};

IR.selectProduct = async function(id){
  S.selId = id; S.data.lastProductId = id;
  renderChips();
  Local.set(S.uid, S.data);   // শুধু শেষ সিলেকশন মনে রাখা — ক্লাউডে পুশ দরকার নেই
};

IR.useProduct = function(id){ IR.selectProduct(id); IR.tab('reply'); $('ir-msg')?.focus(); };

IR.resetThread = function(){
  S.thread = []; S.last = null; renderThread();
  const r = $('ir-result'); if(r) r.innerHTML = '';
  const m = $('ir-msg'); if(m) m.value = '';
  const h = $('ir-history'); if(h) h.value = '';
  Toast.info('নতুন কাস্টমারের জন্য প্রস্তুত ✅');
};

/* ── প্রোডাক্ট ফর্ম ── */
function setFormImage(dataUrl){
  S.formImg = dataUrl || '';
  const pv = $('irf-preview');
  if(pv){ if(S.formImg){ pv.src = S.formImg; pv.classList.remove('hidden'); } else { pv.removeAttribute('src'); pv.classList.add('hidden'); } }
  $('irf-rmimg')?.classList.toggle('hidden', !S.formImg);
  $('irf-aidesc')?.classList.toggle('hidden', !S.formImg);
  const f = $('irf-img'); if(f) f.value = '';
}

IR.openForm = function(id){
  const p = id ? S.data.products.find(x => x.id === id) : null;
  if(!p && S.data.products.length >= MAX_PRODUCTS){ Toast.error(`সর্বোচ্চ ${MAX_PRODUCTS}টি প্রোডাক্ট সেভ করা যাবে — পুরোনো কিছু মুছুন।`); return; }
  S.editingId = p ? p.id : null;
  IR.tab('products');
  $('ir-pform').classList.remove('hidden');
  $('ir-pform-title').textContent = p ? '✏️ প্রোডাক্ট এডিট' : '➕ নতুন প্রোডাক্ট';
  const map = { name: 'irf-name', price: 'irf-price', desc: 'irf-desc', offer: 'irf-offer', urgency: 'irf-urgency', proof: 'irf-proof', guarantee: 'irf-guarantee', upsell: 'irf-upsell' };
  Object.keys(map).forEach(k => { $(map[k]).value = p ? (p[k] || '') : ''; });
  setFormImage(p ? p.img : '');
  $('ir-pform').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('irf-name').focus();
};

IR.closeForm = function(){ $('ir-pform')?.classList.add('hidden'); S.editingId = null; setFormImage(''); };

IR.pickImage = async function(input){
  const f = input.files && input.files[0]; if(!f) return;
  if(!/^image\//.test(f.type)){ Toast.error('শুধু ছবি (JPG/PNG/WebP) দিন'); input.value = ''; return; }
  try{ setFormImage(await fileToCompressed(f)); }
  catch(e){ Toast.error('ছবিটি পড়া যায়নি — অন্য ছবি দিন'); input.value = ''; }
};
IR.removeImage = function(){ setFormImage(''); };

IR.describeFromImage = async function(btn){
  if(!S.formImg) return;
  const el = $('ir-pform');
  if(S.busy) return;
  const holder = document.createElement('div');   // guard() এর মেসেজ দেখানোর জায়গা
  holder.className = 'mt-2';
  el.querySelector('.ir-desc-msg')?.remove(); holder.classList.add('ir-desc-msg');
  btn.parentElement.appendChild(holder);
  if(!(await guard(holder))) return;
  S.busy = true; const old = btn.textContent; btn.disabled = true; btn.textContent = '⏳ ছবি দেখছি...';
  try{
    const name = val('irf-name');
    const text = await geminiCall({
      system: DESCRIBE_SYSTEM, imageDataUrl: S.formImg, temperature: 0.4, json: false,
      userText: 'এই প্রোডাক্টের ছবি দেখে বাংলায় সংক্ষিপ্ত বর্ণনা লিখুন।' + (name ? ' প্রোডাক্টের নাম: ' + name : '')
    });
    const d = $('irf-desc');
    d.value = (d.value.trim() ? d.value.trim() + '\n' : '') + text.replace(/\*\*/g, '').trim();
    holder.remove();
    Toast.success('বর্ণনা যোগ হয়েছে — প্রয়োজনে এডিট করে নিন ✏️');
    await afterUse('inbox_reply_describe', {});
  }catch(e){
    holder.innerHTML = e.message === 'NO_KEY' ? GeminiEngine.noKeyMsg() : R.error(esc(e.message));
  }finally{
    S.busy = false; btn.disabled = false; btn.textContent = old;
  }
};

IR.saveProduct = async function(){
  const name = val('irf-name'), desc = val('irf-desc');
  if(!name){ Toast.error('প্রোডাক্টের নাম দিন'); return; }
  if(!desc && !S.formImg){ Toast.error('বর্ণনা লিখুন অথবা প্রোডাক্টের ছবি দিন'); return; }
  const btn = $('irf-save'); btn.disabled = true; btn.textContent = '⏳ সেভ হচ্ছে...';
  try{
    let thumb = '';
    if(S.formImg){ try{ thumb = await shrink(S.formImg, THUMB_MAX, 0.6); }catch(e){ thumb = ''; } }
    const rec = {
      id: S.editingId || uid8(), name, price: val('irf-price'), desc,
      offer: val('irf-offer'), urgency: val('irf-urgency'), proof: val('irf-proof'),
      guarantee: val('irf-guarantee'), upsell: val('irf-upsell'),
      img: S.formImg || '', thumb, updatedAt: Date.now()
    };
    const i = S.data.products.findIndex(p => p.id === rec.id);
    if(i >= 0) S.data.products[i] = rec; else S.data.products.unshift(rec);
    S.selId = rec.id; S.data.lastProductId = rec.id;
    await save();
    renderCount(); renderChips(); renderProductList(); IR.closeForm();
    Toast.success('প্রোডাক্ট সেভ হয়েছে ✅');
  }finally{
    btn.disabled = false; btn.textContent = '💾 সেভ করুন';
  }
};

IR.deleteProduct = async function(id){
  const p = S.data.products.find(x => x.id === id); if(!p) return;
  if(!confirm(`"${p.name}" মুছে ফেলবেন?`)) return;
  S.data.products = S.data.products.filter(x => x.id !== id);
  if(S.selId === id) S.selId = S.data.products[0]?.id || '';
  if(S.data.lastProductId === id) S.data.lastProductId = S.selId;
  await save();
  renderCount(); renderChips(); renderProductList();
  Toast.success('মুছে ফেলা হয়েছে');
};

IR.saveProfile = async function(){
  const g = id => val(id);
  S.data.profile = {
    shop: g('irp-shop'), owner: g('irp-owner'), honor: $('irp-honor').value, tone: $('irp-tone').value,
    delivery: g('irp-delivery'), payment: g('irp-payment'), policy: g('irp-policy'),
    contact: g('irp-contact'), order: g('irp-order') || DEFAULT_PROFILE.order, extra: g('irp-extra')
  };
  await save();
  Toast.success('ব্যবসার তথ্য সেভ হয়েছে ✅');
};

/* ── উত্তর জেনারেট ── */
function normalizeResult(raw, fallbackText){
  const r = (raw && typeof raw === 'object') ? raw : {};
  const arr = a => Array.isArray(a) ? a.map(x => String(x || '').trim()).filter(Boolean) : [];
  const reply = String(r.reply || fallbackText || '').trim();
  return {
    type: String(r.customer_type || 'inquiry').trim(),
    situation: String(r.situation || '').trim(),
    reply,
    short: String(r.short_reply || '').trim(),
    techniques: arr(r.techniques_used),
    followUp: String(r.follow_up || '').trim(),
    upsell: String(r.upsell_tip || '').trim(),
    missing: arr(r.missing_info),
    next: String(r.next_step_tip || '').trim()
  };
}

IR.generate = async function(variant){
  if(S.busy) return;
  const el = $('ir-result'), btn = $('ir-gen-btn');

  // ভ্যারিয়েন্ট: আগের কপি-করা টার্ন বাতিল করে একই মেসেজে আবার
  if(variant && S.last){
    if(S.last.committed){ S.thread.splice(-2, 2); S.last.committed = false; renderThread(); }
    $('ir-msg').value = S.last.msg;
  }
  const msg = val('ir-msg');
  if(!msg){ Toast.error('কাস্টমারের মেসেজ পেস্ট করুন'); $('ir-msg').focus(); return; }

  if(!(await guard(el))) return;
  S.busy = true; btn.disabled = true; btn.textContent = '⏳ উত্তর তৈরি হচ্ছে...';
  el.innerHTML = R.skeleton(3);

  const product = S.data.products.find(p => p.id === S.selId) || null;
  const others = S.data.products.filter(p => !product || p.id !== product.id).map(p => ({ name: p.name, price: p.price, desc: p.desc }));
  const userText = buildUserPrompt({
    msg, product, others, profile: S.data.profile, thread: S.thread,
    history: val('ir-history'), extra: val('ir-extra'), variant: !!variant
  });

  try{
    const text = await geminiCall({
      system: SYSTEM_PROMPT, userText, imageDataUrl: product && product.img ? product.img : '',
      temperature: variant ? 1.0 : 0.8, json: true
    });
    const parsed = parseJSON(text);
    const r = normalizeResult(parsed, parsed ? '' : text);
    if(!r.reply) throw new Error('উত্তর তৈরি হয়নি। আবার চেষ্টা করুন।');
    S.last = { msg, reply: r.reply, short: r.short, committed: false };
    await afterUse('inbox_reply', { product: product ? product.name : '', type: r.type });
    renderResult(r, product);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }catch(e){
    el.innerHTML = e.message === 'NO_KEY' ? GeminiEngine.noKeyMsg() : R.error(esc(e.message));
  }finally{
    S.busy = false; btn.disabled = false; btn.textContent = '💬 সেরা উত্তর তৈরি করুন';
  }
};

const TYPE_LABEL = {
  price_sensitive: '💰 প্রাইস-সেনসিটিভ কাস্টমার', doubtful: '🤔 সন্দেহপ্রবণ কাস্টমার',
  procrastinating: '⏳ "পরে কিনব" টাইপ কাস্টমার', impulsive: '⚡ দ্রুত সিদ্ধান্তের কাস্টমার',
  ready_to_order: '✅ অর্ডার দিতে প্রস্তুত', complaint: '🛠️ অভিযোগ / সমস্যা', inquiry: '❓ সাধারণ জিজ্ঞাসা'
};
const rowsFor = t => Math.min(14, Math.max(3, Math.ceil(t.length / 48) + (t.match(/\n/g) || []).length));

function renderResult(r, product){
  const el = $('ir-result');
  const ta = (id, text) => `<textarea class="form-control ir-ta" id="${id}" rows="${rowsFor(text)}" oninput="this.rows=Math.min(14,Math.max(3,Math.ceil(this.value.length/48)+(this.value.match(/\\n/g)||[]).length))">${esc(text)}</textarea>`;
  el.innerHTML = `
  <div class="result-card fade-up">
    <div class="ir-badges">
      <span class="tag tag-mint">${TYPE_LABEL[r.type] || '❓ সাধারণ জিজ্ঞাসা'}</span>
      ${product ? `<span class="tag tag-amber">📦 ${esc(product.name)}</span>` : ''}
    </div>
    ${r.situation ? `<p class="ir-situation">🧠 <b>কাস্টমারের মনে:</b> ${esc(r.situation)}</p>` : ''}

    <div class="ir-block">
      <div class="ir-block-h"><b>✅ কাস্টমারকে এই উত্তরটি পাঠান</b><span class="ir-opt">(দরকারে এডিট করুন)</span></div>
      ${ta('ir-out-main', r.reply)}
      <div class="ir-actions">
        <button class="btn btn-primary btn-sm" onclick="IR.copy('ir-out-main',this)">📋 কপি করুন</button>
        <button class="btn btn-secondary btn-sm" onclick="IR.generate(true)">🔄 আরেকটা ভার্সন</button>
      </div>
    </div>

    ${r.short ? `<div class="ir-block">
      <div class="ir-block-h"><b>⚡ ছোট ভার্সন</b></div>
      ${ta('ir-out-short', r.short)}
      <div class="ir-actions"><button class="btn btn-secondary btn-sm" onclick="IR.copy('ir-out-short',this)">📋 কপি করুন</button></div>
    </div>` : ''}

    ${r.techniques.length ? `<div class="ir-block ir-learn">
      <div class="ir-block-h"><b>🎓 এই উত্তরে যে কৌশল কাজ করেছে</b></div>
      <ul>${r.techniques.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>` : ''}

    ${r.next ? `<p class="ir-tip">➡️ <b>এরপর:</b> ${esc(r.next)}</p>` : ''}
    ${r.upsell ? `<p class="ir-tip">🛍️ <b>আপসেল আইডিয়া:</b> ${esc(r.upsell)}</p>` : ''}

    ${r.followUp ? `<div class="ir-block">
      <div class="ir-block-h"><b>🔔 ২৪ ঘণ্টায় রিপ্লাই না এলে ফলো-আপ মেসেজ</b></div>
      ${ta('ir-out-follow', r.followUp)}
      <div class="ir-actions"><button class="btn btn-secondary btn-sm" onclick="IR.copy('ir-out-follow',this,true)">📋 কপি করুন</button></div>
    </div>` : ''}

    ${r.missing.length ? `<div class="ir-missing">⚠️ <b>প্রোডাক্টে এই তথ্য যোগ করলে উত্তর আরও জোরালো হতো:</b> ${r.missing.map(esc).join(' • ')}</div>` : ''}

    <p class="ir-hint" style="margin-top:12px">💡 কপি করলে এই মেসেজটি কথোপকথনে যোগ হয়ে যায় — কাস্টমার রিপ্লাই দিলে শুধু তার নতুন মেসেজ পেস্ট করুন, AI আগের কথা মনে রাখবে।</p>
  </div>`;
}

function fallbackCopy(ta){
  ta.focus(); ta.select();
  try{ return document.execCommand('copy'); }catch(e){ return false; }
}

IR.copy = async function(id, btn, noCommit){
  const ta = $(id); if(!ta) return;
  const text = ta.value.trim(); if(!text) return;
  let ok = false;
  try{ await navigator.clipboard.writeText(text); ok = true; }catch(e){ ok = fallbackCopy(ta); }
  if(!ok){ Toast.error('কপি হয়নি — লেখাটি সিলেক্ট করে নিজে কপি করুন'); return; }
  if(btn){ const o = btn.textContent; btn.textContent = '✅ কপি হয়েছে!'; setTimeout(() => { btn.textContent = o; }, 1800); }

  // ফলো-আপ মেসেজ কপি করলে কথোপকথনে যোগ হয় না
  if(!noCommit && S.last && !S.last.committed){
    S.thread.push({ role: 'customer', text: S.last.msg }, { role: 'me', text });
    S.last.committed = true;
    const m = $('ir-msg'); if(m) m.value = '';
    renderThread();
    Toast.success('কপি হয়েছে ✅ — কাস্টমার রিপ্লাই দিলে তার নতুন মেসেজ পেস্ট করুন');
  }
};

/* ════════════════ টুল রেজিস্ট্রেশন ════════════════ */
if(typeof TOOLS !== 'undefined' && Array.isArray(TOOLS) && !TOOLS.some(t => t.id === 'inbox_reply_master')){
  TOOLS.unshift({
    id: 'inbox_reply_master', icon: '💬',
    name: 'ইনবক্স রিপ্লাই মাস্টার',
    desc: 'কাস্টমারের মেসেজ পেস্ট করুন — সেভ করা প্রোডাক্ট অনুযায়ী বেশি অর্ডার আনে এমন উত্তর পান (ইনবক্সে বাজিমাত টেকনিক)',
    color: 'rgba(0,245,212,.08)', border: 'rgba(0,245,212,.28)',
    html: TOOL_HTML,
    onOpen: IR.open
  });
}

/* ════════════════ openTool হুক ════════════════
   পুরোনো tools.html টুলের onOpen ডাকে না — তাই openTool মোড়ক দিয়ে ডাকা হয়।
   (নতুন tools.html হলে নিজেই ডাকে; IR.open ডিবাউন্স করা আছে, তাই সমস্যা নেই।) */
function hookOpenTool(){
  if(window.__irHooked || typeof window.openTool !== 'function') return;
  window.__irHooked = true;
  const orig = window.openTool;
  window.openTool = function(id){
    const r = orig.apply(this, arguments);
    try{
      if(id === 'inbox_reply_master' && document.getElementById('ir-root')) IR.open();
    }catch(e){ console.error('inbox tool open error:', e); }
    return r;
  };
}
document.addEventListener('DOMContentLoaded', hookOpenTool);
window.addEventListener('load', hookOpenTool);
hookOpenTool();
/* হোমপেজ থেকে tools.html#inbox_reply_master লিংকে এলে টুলটি নিজে খুলে যাবে */
(function(){
  if(location.hash!=='#inbox_reply_master') return;
  var tries=0, t=setInterval(function(){
    tries++;
    if(typeof window.openTool==='function' && typeof TOOLS!=='undefined' && typeof currentUser!=='undefined' && currentUser && document.getElementById('toolContainer')){
      clearInterval(t); try{ window.openTool('inbox_reply_master'); }catch(e){}
    } else if(tries>60) clearInterval(t);
  },250);
})();

})();
