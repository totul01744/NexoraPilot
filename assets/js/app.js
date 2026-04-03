/* ============================================================
   NexoraPilot — Core Engine v4.0
   Firebase + Gemini + bKash Payment System
   ============================================================ */

/* ── Firebase Config ── */
const FB_CONFIG = {
  apiKey: "AIzaSyDgqlhFa_zRj7w1h5YiMPV3ajQUbGGrnEI",
  authDomain: "ecomspark-cd4ea.firebaseapp.com",
  projectId: "ecomspark-cd4ea",
  storageBucket: "ecomspark-cd4ea.firebasestorage.app",
  messagingSenderId: "877618570666",
  appId: "1:877618570666:web:bff0a0012eb3538caab7d3"
};

/* ── App Config ── */
const CONFIG = {
  GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  FREE_DAILY_LIMIT: 3,
  ADMIN_KEY: 'Totul1122@',
  SK: 'nexora_data',
  BKASH_NUMBER: '01859-393487', /* Admin sets this */
};

/* ── Firebase App (loaded via CDN) ── */
let db = null;
let fbApp = null;

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        fbApp = firebase.initializeApp(FB_CONFIG);
      } else {
        fbApp = firebase.app();
      }
      db = firebase.firestore();
      console.log('Firebase connected ✅');
    }
  } catch(e) {
    console.warn('Firebase not loaded, using localStorage fallback');
  }
}

/* ── LOCAL STORE (Fallback + Admin data) ── */
const Store = {
  get(k){ try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) },
  rm(k){ localStorage.removeItem(k) },
  D(){ return this.get(CONFIG.SK)||{} },
  SD(d){ this.set(CONFIG.SK,d) },

  /* ─ API KEY (Admin sets, all users benefit) ─ */
  getApiKey(){ return this.D().systemApiKey||'' },
  setApiKey(k){ const d=this.D(); d.systemApiKey=k; this.SD(d) },

  /* ─ bKash Number ─ */
  getBkashNumber(){ return this.D().bkashNumber||CONFIG.BKASH_NUMBER },
  setBkashNumber(n){ const d=this.D(); d.bkashNumber=n; this.SD(d) },

  /* ─ Usage tracking ─ */
  getUsage(){
    const d=this.D(), today=new Date().toDateString();
    if(!d.usage||d.usage.date!==today){ d.usage={date:today,count:0,total:d.usage?.total||0}; this.SD(d); }
    return d.usage;
  },
  incUsage(){
    const d=this.D(), u=this.getUsage();
    u.count++; u.total=(u.total||0)+1; d.usage=u; this.SD(d); return u.count;
  },

  /* ─ Pro users (approved by admin) ─ */
  getProUsers(){ return this.D().proUsers||[] },
  addProUser(u){ const d=this.D(); if(!d.proUsers)d.proUsers=[]; d.proUsers.push(u); this.SD(d) },
  removeProUser(id){ const d=this.D(); d.proUsers=(d.proUsers||[]).filter(u=>u.id!==id); this.SD(d) },
  banProUser(id){
    const d=this.D(); const i=d.proUsers?.findIndex(u=>u.id===id);
    if(i!==-1&&i!==undefined){ d.proUsers[i].banned=true; this.SD(d); }
  },

  /* ─ Current session pro check ─ */
  getSessionEmail(){ return this.get('nexora_session_email')||'' },
  setSessionEmail(e){ this.set('nexora_session_email',e) },

  isPro(){
    const email=this.getSessionEmail();
    if(!email) return false;
    const users=this.getProUsers();
    const user=users.find(u=>u.email===email);
    if(!user) return false;
    if(user.banned) return false;
    // Check expiry
    if(user.expiryDate){
      const expiry=new Date(user.expiryDate);
      if(new Date()>expiry) return false;
    }
    return true;
  },

  getCurrentProUser(){
    const email=this.getSessionEmail();
    if(!email) return null;
    return this.getProUsers().find(u=>u.email===email)||null;
  },

  isAdmin(){ return this.get('nexora_admin_auth')===true },

  /* ─ Payment requests ─ */
  getPayments(){ return this.D().payments||[] },
  addPayment(p){
    const d=this.D(); if(!d.payments)d.payments=[];
    p.id=Date.now(); p.date=new Date().toISOString(); p.status='pending';
    d.payments.unshift(p); this.SD(d); return p;
  },
  updatePayment(id,upd){
    const d=this.D(); if(!d.payments)return;
    const i=d.payments.findIndex(p=>p.id===id);
    if(i!==-1)d.payments[i]={...d.payments[i],...upd}; this.SD(d);
  },

  /* ─ Help requests ─ */
  getHelp(){ return this.D().help||[] },
  addHelp(r){
    const d=this.D(); if(!d.help)d.help=[];
    r.id=Date.now(); r.date=new Date().toISOString(); r.status='pending';
    d.help.unshift(r); this.SD(d); return r;
  },
  updHelp(id,u){
    const d=this.D(); if(!d.help)return;
    const i=d.help.findIndex(r=>r.id===id);
    if(i!==-1)d.help[i]={...d.help[i],...u}; this.SD(d);
  },

  /* ─ Products ─ */
  getProducts(){ return this.D().products||[] },
  addProduct(p){
    const d=this.D(); if(!d.products)d.products=[];
    p.id=Date.now(); p.date=new Date().toISOString();
    d.products.unshift(p); this.SD(d); return p;
  },
  updateProduct(id,upd){
    const d=this.D(); if(!d.products)return;
    const i=d.products.findIndex(p=>p.id===id);
    if(i!==-1)d.products[i]={...d.products[i],...upd}; this.SD(d);
  },
  deleteProduct(id){
    const d=this.D(); d.products=(d.products||[]).filter(p=>p.id!==id); this.SD(d);
  },

  /* ─ Banners ─ */
  getBanners(){ return this.D().banners||getDefaultBanners() },
  setBanners(b){ const d=this.D(); d.banners=b; this.SD(d) },

  /* ─ Events ─ */
  logEvent(ev,data={}){
    const d=this.D(); if(!d.events)d.events=[];
    d.events.push({ev,data,t:Date.now()});
    if(d.events.length>600)d.events=d.events.slice(-600);
    this.SD(d);
  },

  stats(){
    const d=this.D();
    const payments=d.payments||[];
    return {
      help:(d.help||[]).length,
      helpPending:(d.help||[]).filter(r=>r.status==='pending').length,
      payments:payments.length,
      paymentsPending:payments.filter(p=>p.status==='pending').length,
      products:(d.products||[]).length,
      proUsers:(d.proUsers||[]).length,
      activePro:(d.proUsers||[]).filter(u=>!u.banned).length,
      totalGen:d.usage?.total||0,
    };
  },
};

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
      if(msg.includes('API_KEY_INVALID')||msg.includes('invalid'))
        throw new Error('সিস্টেম সেটআপ সমস্যা। Admin-এর সাথে যোগাযোগ করুন।');
      throw new Error('সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }

    const data=await res.json();
    const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    const clean=raw.replace(/```json|```/g,'').trim();
    try{ return JSON.parse(clean); }
    catch{ throw new Error('ফলাফল প্রক্রিয়া করতে সমস্যা। আবার চেষ্টা করুন।'); }
  },

  /* No daily limit check — just check if API key exists */
  checkLimit(){
    if(!Store.getApiKey()) return false;
    if(Store.isPro()) return true;
    /* Free users: 3/day */
    return Store.getUsage().count < CONFIG.FREE_DAILY_LIMIT;
  },
  remaining(){
    if(Store.isPro()) return 999;
    if(!Store.getApiKey()) return 0;
    return Math.max(0,CONFIG.FREE_DAILY_LIMIT-Store.getUsage().count);
  },
};

/* ════════ PROMPTS ════════ */
const Prompts = {
  product_research:(v)=>`Analyze this ecommerce product for winning potential.
Product: ${v.product||'posture corrector'}, Category: ${v.category||'health'}, Market: ${v.market||'US'}
JSON: {"product_name":"...","overall_score":82,"demand_score":80,"competition_score":65,"saturation_score":55,"trend_direction":"rising","verdict":"winner","summary":"...","demand_analysis":"...","competition_analysis":"...","profit_margin_estimate":"40-65%","suggested_price_range":"$25-$45","target_audience":["..."],"key_selling_points":["..."],"risk_factors":["..."],"recommendations":["..."]}`,

  tiktok_viral:(v)=>`Find TikTok viral product opportunities.
Niche: ${v.niche||'beauty'}, Budget: ${v.budget||'medium'}, Market: ${v.market||'US'}
JSON: {"products":[{"rank":1,"product":"...","viral_score":92,"trending_hashtags":["#..."],"estimated_monthly_searches":45000,"video_view_potential":"high","hooks":["..."],"content_angle":"...","why_viral":"...","profit_potential":"high"}],"trending_categories":["..."],"action_plan":["..."]}`,

  ad_creative:(v)=>`Generate ad creatives for this product.
Product: ${v.product}, Platform: ${v.platform||'TikTok & Facebook'}, Audience: ${v.audience||'18-35'}, USP: ${v.usp||''}
JSON: {"ad_angles":[{"angle":"...","emotion":"curiosity","headline":"...","body_copy":"...","cta":"...","why_works":"..."}],"tiktok_scripts":[{"hook":"...","script":"...","duration":"30s","visual_direction":"..."}],"facebook_ads":[{"headline":"...","primary_text":"...","cta_button":"Shop Now","image_direction":"..."}],"ad_hooks":["..."]}`,

  ad_script:(v)=>`Write a complete ad script.
Product: ${v.product}, Platform: ${v.platform||'TikTok'}, Duration: ${v.duration||'30s'}, Style: ${v.style||'UGC'}
JSON: {"script":{"hook":"...","problem":"...","solution":"...","proof":"...","offer":"...","cta":"...","full_script":"..."},"b_roll_shots":["..."],"voiceover_tips":"...","music_suggestions":["..."],"estimated_ctr":"3-5%"}`,

  product_description:(v)=>`Write high-converting product descriptions.
Product: ${v.product}, Features: ${v.features||''}, Buyer: ${v.buyer||'general'}, Tone: ${v.tone||'friendly'}
JSON: {"title":"...","tagline":"...","short_description":"...","long_description":"...","bullet_points":["..."],"seo_description":"...","emotional_copy":"...","faqs":[{"q":"...","a":"..."}],"keywords":["..."]}`,

  supplier_finder:(v)=>`Find supplier strategy for this product.
Product: ${v.product}, Budget: ${v.budget||'medium'}, Quality: ${v.quality||'medium'}
JSON: {"platforms":[{"name":"Alibaba","search_terms":["..."],"tips":"..."},{"name":"AliExpress","search_terms":["..."],"tips":"..."}],"verification_checklist":["..."],"red_flags":["..."],"outreach_email":{"subject":"...","body":"..."},"negotiation_tips":["..."],"estimated_cogs":"...","recommended_margin":"..."}`,

  competitor_analysis:(v)=>`Analyze competitors for this product.
Product: ${v.product}, Competitors: ${v.competitors||'unknown'}, Platform: ${v.platform||'Amazon'}
JSON: {"market_overview":"...","competitors":[{"name":"...","estimated_monthly_revenue":"...","price_range":"...","strengths":["..."],"weaknesses":["..."],"review_score":4.2}],"market_gaps":["..."],"differentiation_opportunities":["..."],"entry_difficulty":"medium","win_strategy":["..."]}`,

  market_report:(v)=>`Generate a complete market research report.
Product: ${v.product}, Market: ${v.market||'US'}, Budget: ${v.budget||'medium'}
JSON: {"report_title":"...","executive_summary":"...","market_size":"...","growth_rate":"...","opportunity_score":78,"demand_prediction":"increasing","target_demographics":[{"segment":"...","size":"...","pain_points":["..."]}],"market_trends":["..."],"financial_projections":{"month1":"...","month3":"...","month6":"..."},"risk_assessment":[{"risk":"...","probability":"medium","mitigation":"..."}],"action_plan":[{"week":1,"actions":["..."]}],"overall_recommendation":"..."}`,

  post_generator:(v)=>`Create Facebook/social media posts for this product in ${v.lang||'Bengali'}.
Product: ${v.product}, Features: ${v.features||''}, Language: ${v.lang||'Bengali'}
JSON: {"posts":[{"type":"standard","title":"...","body":"...","cta":"..."},{"type":"storytelling","title":"...","body":"...","cta":"..."},{"type":"question_hook","title":"...","body":"...","cta":"..."}],"hashtags":["..."],"best_posting_time":"...","tips":["..."]}`,

  viral_post:(v)=>`Create viral social media posts using current trends.
Topic: ${v.topic}, Platform: ${v.platform||'Facebook'}, Target: ${v.target||'general'}
JSON: {"viral_posts":[{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"curiosity","expected_reach":"high"},{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"greed","expected_reach":"high"},{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"humor","expected_reach":"medium"}],"trending_elements":["..."],"timing_tip":"..."}`,

  promo_post:(v)=>`Create promotional posts for this offer.
Product: ${v.product}, Offer: ${v.offer||'discount'}, Duration: ${v.duration||'48 hours'}, Platform: ${v.platform||'Facebook'}
JSON: {"promo_posts":[{"style":"urgency","headline":"...","body":"...","cta":"...","countdown_text":"..."},{"style":"value_focus","headline":"...","body":"...","cta":"..."},{"style":"social_proof","headline":"...","body":"...","cta":"..."}],"offer_headline":"...","discount_angle":"...","hashtags":["..."]}`,

  ad_copy:(v)=>`Generate high-converting ad copy.
Product: ${v.product}, Goal: ${v.goal||'sales'}, Audience: ${v.audience||'adults'}, Budget: ${v.budget||'medium'}
JSON: {"facebook_ads":[{"headline":"...","primary_text":"...","description":"...","cta":"Shop Now","pain_point":"..."},{"headline":"...","primary_text":"...","description":"...","cta":"Learn More","pain_point":"..."}],"google_ads":[{"headline1":"...","headline2":"...","headline3":"...","description1":"...","description2":"...","display_url":"..."}],"power_words":["..."],"conversion_tips":["..."]}`,

  video_script:(v)=>`Write a complete video script.
Topic: ${v.topic}, Duration: ${v.duration||'3-5 min'}, Style: ${v.style||'educational'}, Platform: ${v.platform||'YouTube'}
JSON: {"title":"...","intro":{"hook":"...","presenter_line":"...","what_to_expect":"..."},"body":[{"section":"...","content":"...","visual_cue":"...","duration_seconds":30}],"outro":{"summary":"...","cta":"...","subscribe_line":"..."},"b_roll_suggestions":["..."],"thumbnail_idea":"...","tags":["..."]}`,

  video_prompt:(v)=>`Generate AI video prompts for Veo/Sora/Kling.
Scene: ${v.scene}, Style: ${v.style||'cinematic'}, Duration: ${v.duration||'15 seconds'}
JSON: {"prompts":[{"title":"Prompt 1","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."},{"title":"Prompt 2","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."},{"title":"Prompt 3","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."}],"style_tips":["..."],"best_tool":"Veo/Sora/Kling"}`,

  storyboard:(v)=>`Create a detailed storyboard.
Topic: ${v.topic}, Video Type: ${v.type||'product showcase'}, Duration: ${v.duration||'30 seconds'}
JSON: {"title":"...","concept":"...","scenes":[{"scene_number":1,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":2,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":3,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":4,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":5,"duration_seconds":10,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."}],"music_mood":"...","color_palette":["..."],"director_notes":"..."}`,

  subtitle_translator:(v)=>`Translate subtitles accurately.
Text: ${v.text}, From: ${v.from||'English'}, To: ${v.to||'Bengali'}, Style: ${v.style||'natural'}
JSON: {"translated_lines":[{"original":"...","translated":"..."}],"translation_notes":"...","cultural_adaptations":["..."],"formality_level":"...","alternative_phrases":[{"original":"...","alternative":"..."}]}`,

  ad_funnel:(v)=>`Create a complete ad funnel strategy.
Product: ${v.product}, Budget: ${v.budget||'medium'}, Goal: ${v.goal||'sales'}, Timeline: ${v.timeline||'30 days'}
JSON: {"funnel_overview":"...","stages":[{"stage":"Awareness","objective":"...","ad_type":"...","audience":"...","budget_percentage":"30%","content":"...","kpi":"...","example_copy":"..."},{"stage":"Consideration","objective":"...","ad_type":"...","audience":"...","budget_percentage":"40%","content":"...","kpi":"...","example_copy":"..."},{"stage":"Conversion","objective":"...","ad_type":"...","audience":"...","budget_percentage":"30%","content":"...","kpi":"...","example_copy":"..."}],"retargeting_strategy":"...","expected_roas":"...","timeline":["..."]}`,

  concept_architect:(v)=>`Create a complete business/campaign blueprint.
Idea: ${v.idea}, Industry: ${v.industry||'ecommerce'}, Budget: ${v.budget||'startup'}, Goal: ${v.goal||'launch'}
JSON: {"concept_title":"...","executive_summary":"...","unique_value_proposition":"...","target_market":{"primary":"...","secondary":"...","psychographics":["..."]},"competitive_advantage":["..."],"revenue_model":{"streams":["..."],"pricing_strategy":"...","projected_monthly":"..."},"marketing_plan":{"phase1":"...","phase2":"...","phase3":"..."},"action_items":[{"week":1,"tasks":["..."]},{"week":2,"tasks":["..."]},{"week":3,"tasks":["..."]},{"week":4,"tasks":["..."]}],"success_metrics":["..."],"risk_mitigation":["..."]}`,
};

/* ════════ RENDER HELPERS ════════ */
const R = {
  skeleton(n=3){ return Array(n).fill(0).map(()=>`<div class="card mb-2" style="padding:18px"><div class="skeleton mb-2" style="height:13px;width:55%"></div><div class="skeleton mb-1" style="height:11px;width:88%"></div><div class="skeleton" style="height:11px;width:70%"></div></div>`).join(''); },
  error(msg){ return `<div class="alert alert-error"><span>⚠️</span><div><strong>সমস্যা হয়েছে:</strong> ${msg}</div></div>`; },
  limitReached(){ return `<div class="alert alert-warning" style="flex-direction:column;gap:12px"><div>⚠️ <strong>আজকের বিনামূল্যে ব্যবহার শেষ (${CONFIG.FREE_DAILY_LIMIT}/দিন)</strong></div><div style="font-size:.85rem;color:var(--text2)">আগামীকাল আবার ব্যবহার করুন বা Pro membership নিন।</div><button class="btn btn-primary btn-sm" onclick="showPaymentModal()">🚀 মাত্র ৳১৯৯/মাসে Pro নিন</button></div>`; },
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

function updateUsageDisplay(){
  const r=Engine.remaining(), isPro=Store.isPro();
  document.querySelectorAll('.usage-display').forEach(el=>{
    el.textContent=isPro?'∞ Pro':`${r}/${CONFIG.FREE_DAILY_LIMIT}`;
    el.style.color=isPro?'var(--a1)':r>0?'var(--a3)':'#f87171';
  });
  /* Show pro badge if user is pro */
  const badge=document.getElementById('proBadge');
  if(badge){ badge.style.display=isPro?'inline-flex':'none'; }
  const upgradeBtn=document.getElementById('upgradeBtn');
  if(upgradeBtn){ upgradeBtn.style.display=isPro?'none':'inline-flex'; }
}

/* ════════ PAYMENT MODAL ════════ */
function showPaymentModal(){ Modal.show('paymentModal'); renderPaymentStep1(); }
function showUpgradeModal(){ showPaymentModal(); }

function renderPaymentStep1(){
  const bkash=Store.getBkashNumber();
  const modal=document.getElementById('paymentContent');
  if(!modal)return;
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

    <div class="form-group">
      <label class="form-label">আপনার নাম *</label>
      <input class="form-control" id="pay-name" placeholder="পূর্ণ নাম লিখুন">
    </div>
    <div class="form-group">
      <label class="form-label">Email Address *</label>
      <input class="form-control" id="pay-email" type="email" placeholder="আপনার email (এটাই login হবে)">
    </div>
    <div class="form-group">
      <label class="form-label">Plan *</label>
      <select class="form-control" id="pay-plan">
        <option value="monthly">Pro Monthly — ৳১৯৯/মাস</option>
        <option value="yearly">Pro Annual — ৳১,৯৯৯/বছর</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">bKash Transaction ID *</label>
      <input class="form-control" id="pay-txn" placeholder="e.g., 8N6X1J2ABC" style="letter-spacing:1px">
      <div style="font-size:.77rem;color:var(--text2);margin-top:4px">bKash থেকে পাওয়া TrxID লিখুন</div>
    </div>
    <div class="form-group">
      <label class="form-label">Phone Number (bKash)</label>
      <input class="form-control" id="pay-phone" placeholder="01XXXXXXXXX">
    </div>
    <button class="btn btn-primary btn-full" onclick="submitPayment()" style="background:linear-gradient(135deg,#ec4899,#7c3aed)">📤 Payment Submit করুন</button>
    <p style="text-align:center;font-size:.78rem;color:var(--text2);margin-top:12px">Admin verify করলে ২-১২ ঘণ্টার মধ্যে activate হবে।</p>`;
}

async function submitPayment(){
  const name=document.getElementById('pay-name')?.value?.trim();
  const email=document.getElementById('pay-email')?.value?.trim();
  const plan=document.getElementById('pay-plan')?.value;
  const txn=document.getElementById('pay-txn')?.value?.trim();
  const phone=document.getElementById('pay-phone')?.value?.trim();

  if(!name||!email||!txn){ Toast.error('নাম, email ও Transaction ID আবশ্যক'); return; }
  if(!email.includes('@')){ Toast.error('সঠিক email দিন'); return; }

  const payment={
    name,email,plan,txnId:txn,phone,
    amount:plan==='yearly'?'৳১,৯৯৯':'৳১৯৯',
  };

  /* Save to localStorage */
  Store.addPayment(payment);

  /* Try Firebase save */
  try {
    if(db){
      await db.collection('payments').add({...payment, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
    }
  } catch(e){ console.warn('Firebase save failed, stored locally'); }

  Store.logEvent('payment_submit',{name,email,plan,txn});

  /* Show success */
  document.getElementById('paymentContent').innerHTML=`
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:3rem;margin-bottom:14px">✅</div>
      <div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:10px">Payment Submit হয়েছে!</div>
      <div style="font-size:.88rem;color:var(--text2);margin-bottom:20px">আপনার TrxID: <strong style="color:var(--a1)">${txn}</strong><br>Admin verify করলে <strong style="color:#fff">২-১২ ঘণ্টার মধ্যে</strong> activate হবে।</div>
      <div style="background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:12px;padding:14px;font-size:.85rem;margin-bottom:20px">
        আপনার email: <strong style="color:var(--a1)">${email}</strong><br>
        <span style="color:var(--text2)">Activate হলে email দিয়ে login করুন।</span>
      </div>
      <button class="btn btn-secondary" onclick="Modal.hideAll()">বন্ধ করুন</button>
    </div>`;

  Toast.success('Payment submit হয়েছে! Admin verify করবেন।');
}

/* ════════ PRO LOGIN ════════ */
function showProLogin(){
  Modal.hide('paymentModal');
  Modal.show('proLoginModal');
}

function proLogin(){
  const email=document.getElementById('pro-login-email')?.value?.trim().toLowerCase();
  if(!email){ Toast.error('Email দিন'); return; }
  const users=Store.getProUsers();
  const user=users.find(u=>u.email.toLowerCase()===email);
  if(!user){ Toast.error('এই email-এ কোনো Pro account নেই।'); return; }
  if(user.banned){ Toast.error('এই account ban করা হয়েছে।'); return; }
  if(user.expiryDate && new Date()>new Date(user.expiryDate)){ Toast.error('আপনার membership মেয়াদ শেষ। নতুন payment করুন।'); return; }
  Store.setSessionEmail(email);
  Modal.hideAll();
  updateUsageDisplay();
  Toast.success(`স্বাগতম ${user.name}! Pro access চালু হয়েছে। ✅`);
}

function proLogout(){
  Store.rm('nexora_session_email');
  updateUsageDisplay();
  Toast.info('Logout হয়েছে।');
}

/* ════════ SUPPORT CHAT ════════ */
function toggleSupport(){ document.getElementById('supportPanel')?.classList.toggle('open') }
function supportBodyHTML(){
  return `<div class="form-group"><label class="form-label">আপনার নাম</label><input class="form-control" id="supp-name" placeholder="নাম লিখুন"></div>
<div class="form-group"><label class="form-label">Email</label><input class="form-control" id="supp-email" type="email" placeholder="you@example.com"></div>
<div class="form-group"><label class="form-label">বার্তা</label><textarea class="form-control" id="supp-msg" rows="3" placeholder="কীভাবে সাহায্য করতে পারি?"></textarea></div>
<button class="btn btn-primary btn-full btn-sm" onclick="submitSupportMsg()">📤 বার্তা পাঠান</button>`;
}
function submitSupportMsg(){
  const name=document.getElementById('supp-name')?.value?.trim();
  const email=document.getElementById('supp-email')?.value?.trim();
  const msg=document.getElementById('supp-msg')?.value?.trim();
  if(!name||!email||!msg){ Toast.error('সব তথ্য পূরণ করুন'); return; }
  Store.addHelp({name,email,message:msg,category:'Support Chat'});
  Store.logEvent('support_chat',{name,email});
  const body=document.getElementById('supportBody');
  if(body) body.innerHTML=`<div class="alert alert-success"><span>✅</span><div><strong>পাঠানো হয়েছে!</strong><br>কয়েক ঘণ্টার মধ্যে reply পাবেন।</div></div>`;
  setTimeout(()=>{ if(body) body.innerHTML=supportBodyHTML(); },5000);
}

/* ════════ BANNER SLIDER ════════ */
let bannerIdx=0;
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
  if(!resultEl) return;

  if(!Store.getApiKey()){ resultEl.innerHTML=R.noKey(); return; }
  if(!Engine.checkLimit()){ resultEl.innerHTML=R.limitReached(); return; }

  resultEl.innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(promptFn(inputs));
    Store.incUsage(); updateUsageDisplay();
    return data;
  }catch(e){
    resultEl.innerHTML=R.error(e.message);
    return null;
  }
}

async function runProductResearch(){
  const product=document.getElementById('pr-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.product_research,{product,category:document.getElementById('pr-category')?.value,market:document.getElementById('pr-market')?.value},'pr-result');
  if(!data)return;
  Store.logEvent('product_research',{product});
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
  Store.logEvent('tiktok',{niche});
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
  Store.logEvent('ad_creative',{product});
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
  Store.logEvent('ad_script',{product});
  const s=data.script||{};
  document.getElementById('as-result').innerHTML=`<div class="result-card fade-up"><div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-mint">${document.getElementById('as-platform')?.value}</span><span class="tag tag-blue">${document.getElementById('as-duration')?.value}</span></div><div style="display:grid;gap:10px"><div><div class="tag tag-red mb-1">🎣 HOOK</div>${R.copyBox(s.hook,'Copy')}</div><div><div class="tag tag-amber mb-1">❓ PROBLEM</div><p style="font-size:.86rem">${s.problem}</p></div><div><div class="tag tag-green mb-1">✅ SOLUTION</div><p style="font-size:.86rem">${s.solution}</p></div><div><div class="tag tag-violet mb-1">🎁 OFFER</div><p style="font-size:.86rem">${s.offer}</p></div><div><div class="tag tag-mint mb-1">📣 CTA</div>${R.copyBox(s.cta,'Copy')}</div></div><div class="divider"></div><div><strong style="font-size:.84rem;color:var(--text2)">📝 FULL SCRIPT</strong><div style="margin-top:8px">${R.copyBox(s.full_script,'📋 Copy Full')}</div></div><div class="divider"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><strong style="font-size:.82rem;color:var(--text2)">🎬 B-Roll</strong>${R.list(data.b_roll_shots,'📷')}</div><div><strong style="font-size:.82rem;color:var(--text2)">🎵 Music</strong>${R.list(data.music_suggestions,'🎵')}</div></div></div>`;
}

async function runProductDesc(){
  const product=document.getElementById('pd-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  const data=await runTool(Prompts.product_description,{product,features:document.getElementById('pd-features')?.value,buyer:document.getElementById('pd-buyer')?.value,tone:document.getElementById('pd-tone')?.value},'pd-result');
  if(!data)return;
  Store.logEvent('product_desc',{product});
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
  Store.logEvent('supplier',{product});
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
  Store.logEvent('competitor',{product});
  document.getElementById('ca-result').innerHTML=`<div class="result-card fade-up mb-2"><p style="font-size:.86rem">${data.market_overview}</p></div>${(data.competitors||[]).map(c=>`<div class="result-card fade-up mb-2"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><strong style="color:#fff">🏢 ${c.name}</strong><strong style="color:var(--a1)">${c.estimated_monthly_revenue}/mo</strong></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px"><div><div style="font-size:.73rem;color:var(--text2)">Price</div><strong style="color:#fff">${c.price_range}</strong></div><div><div style="font-size:.73rem;color:var(--text2)">Rating</div><strong style="color:var(--a3)">⭐ ${c.review_score}</strong></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><div style="font-size:.77rem;color:var(--a1);margin-bottom:4px">✅ Strengths</div>${R.list(c.strengths,'✅')}</div><div><div style="font-size:.77rem;color:#f87171;margin-bottom:4px">❌ Weaknesses</div>${R.list(c.weaknesses,'❌')}</div></div></div>`).join('')}<div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🔓 Market Gaps</strong>${R.list(data.market_gaps,'💡')}</div><div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">🏆 Win Strategy</strong>${R.list(data.win_strategy,'→')}</div>`;
}

async function runMarketReport(){
  const product=document.getElementById('mr-product')?.value?.trim();
  if(!product){ Toast.error('Product/Niche দিন'); return; }
  const data=await runTool(Prompts.market_report,{product,market:document.getElementById('mr-market')?.value,budget:document.getElementById('mr-budget')?.value},'mr-result');
  if(!data)return;
  Store.logEvent('market_report',{product});
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
  Store.logEvent('post_generator',{product});
  document.getElementById('pg-result').innerHTML=`${(data.posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">Post ${i+1} — ${p.type}</div>${p.title?`<div class="mb-1"><strong style="font-size:.82rem;color:var(--text2)">Title:</strong> <span style="color:#fff">${p.title}</span></div>`:''} ${R.copyBox(p.body,'📋 Copy Post')}<div style="margin-top:8px;font-size:.84rem;color:var(--a1)">📣 CTA: ${p.cta}</div></div>`).join('')}<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🏷️ Hashtags</strong>${R.tags(data.hashtags,'tag-violet')}<div style="margin-top:10px"><strong style="font-size:.83rem;color:var(--text2)">💡 Tips</strong>${R.list(data.tips,'💡')}</div></div>`;
}

async function runViralPost(){
  const topic=document.getElementById('vp-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  const data=await runTool(Prompts.viral_post,{topic,platform:document.getElementById('vp-platform')?.value,target:document.getElementById('vp-target')?.value},'vp-result');
  if(!data)return;
  Store.logEvent('viral_post',{topic});
  const ec={curiosity:'tag-mint',fear:'tag-red',humor:'tag-green',greed:'tag-amber'};
  document.getElementById('vp-result').innerHTML=`${(data.viral_posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="tag tag-pink">Viral ${i+1}</span><span class="tag ${ec[p.emotion_trigger]||'tag-violet'}">${p.emotion_trigger}</span><span class="tag ${p.expected_reach==='high'?'tag-green':'tag-amber'}" style="margin-left:auto">${p.expected_reach} reach</span></div><div class="mb-2">${R.copyBox(p.hook,'Copy Hook')}</div>${R.copyBox(p.body,'📋 Copy Post')}<div style="margin-top:8px;font-size:.84rem"><strong style="color:var(--text2)">Viral Factor:</strong> <span style="color:var(--a1)">${p.viral_factor}</span></div></div>`).join('')}<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Elements</strong>${R.tags(data.trending_elements,'tag-red')}<div style="margin-top:10px;font-size:.84rem;color:var(--text2)">⏰ ${data.timing_tip}</div></div>`;
}

async function runPromoPost(){
  const product=document.getElementById('pp-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.promo_post,{product,offer:document.getElementById('pp-offer')?.value,duration:document.getElementById('pp-duration')?.value,platform:document.getElementById('pp-platform')?.value},'pp-result');
  if(!data)return;
  Store.logEvent('promo_post',{product});
  document.getElementById('pp-result').innerHTML=`<div class="result-card fade-up mb-2" style="text-align:center;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(236,72,153,.06))"><div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:var(--a3)">${data.offer_headline}</div><div style="font-size:.84rem;color:var(--text2);margin-top:4px">${data.discount_angle}</div></div>${(data.promo_posts||[]).map(p=>`<div class="result-card fade-up mb-2"><div class="tag tag-amber mb-2">${p.style}</div><div class="mb-1"><strong style="font-size:.82rem;color:var(--text2)">Headline:</strong> <span style="color:#fff;font-weight:700">${p.headline}</span></div>${R.copyBox(p.body,'📋 Copy')}${p.countdown_text?`<div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,.1);border-radius:8px;font-size:.84rem;color:var(--a3)">⏳ ${p.countdown_text}</div>`:''}<div style="margin-top:8px;font-size:.84rem;color:var(--a1)">📣 ${p.cta}</div></div>`).join('')}<div class="result-card fade-up">${R.tags(data.hashtags,'tag-amber')}</div>`;
}

async function runAdCopy(){
  const product=document.getElementById('adc-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.ad_copy,{product,goal:document.getElementById('adc-goal')?.value,audience:document.getElementById('adc-audience')?.value,budget:document.getElementById('adc-budget')?.value},'adc-result');
  if(!data)return;
  Store.logEvent('ad_copy',{product});
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
  Store.logEvent('video_script',{topic});
  document.getElementById('vs-result').innerHTML=`<div class="result-card fade-up mb-2"><div class="tag tag-red mb-2">📹 Video Title</div>${R.copyBox(data.title,'Copy')}</div><div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">🎬 Intro</div><div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">Hook:</strong> ${R.copyBox(data.intro?.hook,'Copy')}</div><div style="font-size:.84rem;color:var(--text2)">Presenter: ${data.intro?.presenter_line}</div></div>${(data.body||[]).map((sec,i)=>`<div class="result-card fade-up mb-2"><div class="tag tag-violet mb-2">Section ${i+1}: ${sec.section} (${sec.duration_seconds}s)</div>${R.copyBox(sec.content,'Copy')}<div style="font-size:.82rem;color:var(--text2);margin-top:6px">🎬 ${sec.visual_cue}</div></div>`).join('')}<div class="result-card fade-up mb-2"><div class="tag tag-amber mb-2">🎯 Outro</div>${R.copyBox((data.outro?.summary||'')+'\n\n'+(data.outro?.cta||''),'Copy')}</div><div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🖼️ Thumbnail</strong><div style="padding:10px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.85rem;margin-top:8px">${data.thumbnail_idea}</div>${R.tags(data.tags,'tag-blue')}</div>`;
}

async function runVideoPrompt(){
  const scene=document.getElementById('vpr-scene')?.value?.trim();
  if(!scene){ Toast.error('Scene/Product দিন'); return; }
  const data=await runTool(Prompts.video_prompt,{scene,style:document.getElementById('vpr-style')?.value,duration:document.getElementById('vpr-duration')?.value},'vpr-result');
  if(!data)return;
  Store.logEvent('video_prompt',{scene});
  document.getElementById('vpr-result').innerHTML=`<div class="result-card fade-up mb-2" style="display:flex;align-items:center;gap:10px"><span style="font-size:1.5rem">🎬</span><div><strong style="color:var(--a1)">Best Tool:</strong> <span style="color:#fff">${data.best_tool}</span></div></div>${(data.prompts||[]).map(p=>`<div class="result-card fade-up mb-2"><div class="tag tag-violet mb-2">${p.title}</div>${R.copyBox(p.prompt,'📋 Copy')}<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:.8rem"><div><span style="color:var(--text2)">Camera:</span> <span>${p.camera_movement}</span></div><div><span style="color:var(--text2)">Light:</span> <span>${p.lighting}</span></div><div><span style="color:var(--text2)">Mood:</span> <span>${p.mood}</span></div></div></div>`).join('')}<div class="result-card fade-up">${R.list(data.style_tips,'💡')}</div>`;
}

async function runStoryboard(){
  const topic=document.getElementById('sb-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  const data=await runTool(Prompts.storyboard,{topic,type:document.getElementById('sb-type')?.value,duration:document.getElementById('sb-duration')?.value},'sb-result');
  if(!data)return;
  Store.logEvent('storyboard',{topic});
  document.getElementById('sb-result').innerHTML=`<div class="result-card fade-up mb-2"><h3 style="color:#fff;margin-bottom:6px">${data.title}</h3><p style="font-size:.86rem">${data.concept}</p><div style="display:flex;gap:10px;margin-top:10px"><span class="tag tag-violet">Music: ${data.music_mood}</span>${(data.color_palette||[]).map(c=>`<span class="tag tag-mint">${c}</span>`).join('')}</div></div>${(data.scenes||[]).map(sc=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--a1),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;color:#0a0a14;flex-shrink:0">${sc.scene_number}</div><div style="flex:1"><strong style="color:#fff">Scene ${sc.scene_number}</strong> <span class="tag tag-mint" style="margin-left:6px">${sc.duration_seconds}s</span></div><span style="font-size:.8rem;color:var(--text2)">${sc.camera_angle}</span></div><div style="display:grid;gap:8px;font-size:.85rem"><div><span style="color:var(--text2)">🎬 Visual:</span> ${sc.visual}</div><div><span style="color:var(--text2)">🔊 Audio:</span> ${sc.audio}</div>${sc.text_overlay?`<div><span style="color:var(--text2)">📝 Text:</span> <span style="color:var(--a1)">${sc.text_overlay}</span></div>`:''}<div><span style="color:var(--text2)">↩ Transition:</span> ${sc.transition}</div></div></div>`).join('')}<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🎬 Director's Notes</strong><p style="font-size:.86rem;margin-top:8px">${data.director_notes}</p></div>`;
}

async function runSubtitleTranslator(){
  const text=document.getElementById('st-text')?.value?.trim();
  if(!text){ Toast.error('Text দিন'); return; }
  const data=await runTool(Prompts.subtitle_translator,{text,from:document.getElementById('st-from')?.value,to:document.getElementById('st-to')?.value,style:document.getElementById('st-style')?.value},'st-result');
  if(!data)return;
  Store.logEvent('subtitle_translator',{});
  document.getElementById('st-result').innerHTML=`<div class="result-card fade-up mb-2"><div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-blue">${document.getElementById('st-from')?.value}</span><span style="color:var(--text2)">→</span><span class="tag tag-mint">${document.getElementById('st-to')?.value}</span><span class="tag tag-violet">${data.formality_level}</span></div>${(data.translated_lines||[]).map(l=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-size:.85rem;color:var(--text2)">${l.original}</div><div style="font-size:.85rem;color:var(--a1)">${l.translated}</div></div>`).join('')}</div>${data.cultural_adaptations?.length?`<div class="result-card fade-up">${R.list(data.cultural_adaptations,'🌐')}</div>`:''}`;
}

async function runAdFunnel(){
  const product=document.getElementById('af-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  const data=await runTool(Prompts.ad_funnel,{product,budget:document.getElementById('af-budget')?.value,goal:document.getElementById('af-goal')?.value,timeline:document.getElementById('af-timeline')?.value},'af-result');
  if(!data)return;
  Store.logEvent('ad_funnel',{product});
  const stageColors=['tag-blue','tag-violet','tag-green'];
  document.getElementById('af-result').innerHTML=`<div class="result-card fade-up mb-2"><p style="font-size:.86rem">${data.funnel_overview}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px"><div><div style="font-size:.77rem;color:var(--text2)">📊 Expected ROAS</div><strong style="color:var(--a1)">${data.expected_roas}</strong></div></div></div>${(data.stages||[]).map((s,i)=>`<div class="result-card fade-up mb-2"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span class="tag ${stageColors[i]||'tag-mint'}">${s.stage}</span><span style="font-size:.82rem;color:var(--text2)">Budget: ${s.budget_percentage}</span></div><div style="display:grid;gap:7px;font-size:.85rem"><div><span style="color:var(--text2)">🎯 Objective:</span> ${s.objective}</div><div><span style="color:var(--text2)">📢 Ad Type:</span> ${s.ad_type}</div><div><span style="color:var(--text2)">👥 Audience:</span> ${s.audience}</div></div><div style="margin-top:10px">${R.copyBox(s.example_copy,'Copy Example')}</div></div>`).join('')}<div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🔄 Retargeting</strong><p style="font-size:.85rem;margin-top:8px">${data.retargeting_strategy}</p></div><div class="result-card fade-up">${R.list(data.timeline,'→')}</div>`;
}

async function runConceptArchitect(){
  const idea=document.getElementById('con-idea')?.value?.trim();
  if(!idea){ Toast.error('Idea দিন'); return; }
  const data=await runTool(Prompts.concept_architect,{idea,industry:document.getElementById('con-industry')?.value,budget:document.getElementById('con-budget')?.value,goal:document.getElementById('con-goal')?.value},'con-result');
  if(!data)return;
  Store.logEvent('concept_architect',{idea});
  document.getElementById('con-result').innerHTML=`<div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.04))"><h3 style="color:#fff;margin-bottom:6px">${data.concept_title}</h3><p style="font-size:.86rem;margin-bottom:12px">${data.executive_summary}</p><div style="padding:12px;background:rgba(0,245,212,.08);border-radius:10px;font-size:.88rem"><strong style="color:var(--a1)">💎 Value Proposition:</strong> ${data.unique_value_proposition}</div></div><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🎯 Target Market</strong><div style="margin-top:10px;display:grid;gap:6px;font-size:.85rem"><div><span style="color:var(--text2)">Primary:</span> <strong style="color:#fff">${data.target_market?.primary}</strong></div><div><span style="color:var(--text2)">Secondary:</span> ${data.target_market?.secondary}</div></div>${R.tags(data.target_market?.psychographics||[],'tag-violet')}</div><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">💰 Revenue Model</strong>${R.list(data.revenue_model?.streams||[],'💰')}<div style="font-size:.85rem;margin-top:6px"><span style="color:var(--text2)">Projected Monthly:</span> <strong style="color:var(--a1)">${data.revenue_model?.projected_monthly}</strong></div></div><div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📅 4-Week Action Plan</strong>${(data.action_items||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="tag tag-mint mb-1">Week ${w.week}</div>${R.list(w.tasks,'→')}</div>`).join('')}</div><div class="result-card fade-up">${R.list(data.competitive_advantage,'✅')}</div>`;
}

/* ════════ INIT ════════ */
document.addEventListener('DOMContentLoaded',()=>{
  Toast.init();
  initFirebase();
  updateUsageDisplay();
  document.querySelector('.hamburger')?.addEventListener('click',()=>document.getElementById('mainNav')?.classList.toggle('open'));
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o)o.classList.add('hidden'); }));
});
