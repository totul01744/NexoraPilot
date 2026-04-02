/* =============================================
   EcomSpark — Core Engine v3.0
   Gemini API | Admin Key Control
   ============================================= */

const CONFIG = {
  GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  FREE_DAILY_LIMIT: 3,
  ADMIN_KEY: 'ecomspark_admin_2025',
  SK: 'es_data',
};

/* ========== STORE ========== */
const Store = {
  get(k){ try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) },
  rm(k){ localStorage.removeItem(k) },

  D(){ return this.get(CONFIG.SK)||{} },
  SD(d){ this.set(CONFIG.SK,d) },

  /* Admin sets the API key — all users use it */
  getApiKey(){ return this.D().adminApiKey||'' },
  setApiKey(k){ const d=this.D(); d.adminApiKey=k; this.SD(d); },

  getUsage(){
    const d=this.D(), today=new Date().toDateString();
    if(!d.usage||d.usage.date!==today){ d.usage={date:today,count:0,total:d.usage?.total||0}; this.SD(d); }
    return d.usage;
  },
  incUsage(){
    const d=this.D(), u=this.getUsage();
    u.count++; u.total=(u.total||0)+1; d.usage=u; this.SD(d); return u.count;
  },

  isPro(){ return this.D().isPro===true },
  isAdmin(){ return this.get('es_admin_auth')===true },

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

  getAgency(){ return this.D().agency||[] },
  addAgency(r){
    const d=this.D(); if(!d.agency)d.agency=[];
    r.id=Date.now(); r.date=new Date().toISOString(); r.status='new';
    d.agency.unshift(r); this.SD(d); return r;
  },

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

  getBanners(){ return this.D().banners||getDefaultBanners() },
  setBanners(b){ const d=this.D(); d.banners=b; this.SD(d) },

  getProUsers(){ return this.D().proUsers||[] },

  logEvent(ev,data={}){
    const d=this.D(); if(!d.events)d.events=[];
    d.events.push({ev,data,t:Date.now()});
    if(d.events.length>600)d.events=d.events.slice(-600);
    this.SD(d);
  },

  stats(){
    const d=this.D();
    return {
      help:(d.help||[]).length,
      helpPending:(d.help||[]).filter(r=>r.status==='pending').length,
      agency:(d.agency||[]).length,
      agencyNew:(d.agency||[]).filter(r=>r.status==='new').length,
      products:(d.products||[]).length,
      proUsers:(d.proUsers||[]).length,
      totalGen:d.usage?.total||0,
    };
  },
};

function getDefaultBanners(){
  return [
    {id:1,title:'🚀 Winning Products দ্রুত খুঁজুন',subtitle:'স্বয়ংক্রিয় গবেষণায় ecommerce-এর সেরা পণ্য আবিষ্কার করুন',bg:'linear-gradient(135deg,#0369a1,#7c3aed)',cta:'গবেষণা শুরু করুন',link:'#tools',active:true},
    {id:2,title:'🎵 TikTok Viral Product Finder',subtitle:'TikTok Shop-এ trending products আগেই ধরুন',bg:'linear-gradient(135deg,#be185d,#7c3aed)',cta:'Products খুঁজুন',link:'#winning',active:true},
    {id:3,title:'📊 পূর্ণাঙ্গ Market Reports',subtitle:'মুহূর্তেই বিনিয়োগ-মানের বাজার বিশ্লেষণ তৈরি করুন',bg:'linear-gradient(135deg,#0f766e,#0369a1)',cta:'Report তৈরি করুন',link:'#tools',active:true},
  ];
}

/* ========== TOAST ========== */
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
    t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    this.c.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='.3s'; setTimeout(()=>t.remove(),300); },dur);
  },
  success(m){this.show(m,'success')},
  error(m){this.show(m,'error')},
  info(m){this.show(m,'info')},
  warning(m){this.show(m,'warning')},
};

/* ========== ENGINE (Gemini) ========== */
const Engine = {
  async call(prompt){
    const apiKey = Store.getApiKey();
    if(!apiKey) throw new Error('সিস্টেম এখনো চালু হয়নি। Admin-এর সাথে যোগাযোগ করুন।');

    const url = `${CONFIG.GEMINI_URL}?key=${apiKey}`;
    let res;
    try {
      res = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          contents:[{parts:[{text: prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks, no extra text.'}]}],
          generationConfig:{temperature:0.7, maxOutputTokens:4000},
        }),
      });
    } catch(networkErr) {
      throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।');
    }

    if(!res.ok){
      const err=await res.json().catch(()=>({}));
      const msg = err.error?.message || '';
      const status = res.status;
      // Friendly error messages
      if(msg.includes('suspended') || msg.includes('Consumer') || status === 403)
        throw new Error('সিস্টেম key মেয়াদ শেষ। Admin-এর সাথে যোগাযোগ করুন।');
      if(msg.includes('quota') || status === 429)
        throw new Error('আজকের limit শেষ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      if(msg.includes('API_KEY_INVALID') || msg.includes('invalid'))
        throw new Error('সিস্টেম সেটআপে সমস্যা। Admin-এর সাথে যোগাযোগ করুন।');
      if(status === 500 || status === 503)
        throw new Error('সার্ভার সাময়িক সমস্যায়। একটু পরে আবার চেষ্টা করুন।');
      throw new Error('সিস্টেম সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    const clean = raw.replace(/```json|```/g,'').trim();
    try {
      return JSON.parse(clean);
    } catch {
      throw new Error('ফলাফল প্রক্রিয়া করতে সমস্যা। আবার চেষ্টা করুন।');
    }
  },

  checkLimit(){ return Store.isPro()||Store.getUsage().count<CONFIG.FREE_DAILY_LIMIT },
  remaining(){ return Store.isPro()?999:Math.max(0,CONFIG.FREE_DAILY_LIMIT-Store.getUsage().count) },
};

/* ========== PROMPTS ========== */
const Prompts = {
  product_research:(v)=>`Analyze this ecommerce product for winning potential.
Product: ${v.product||'posture corrector'}, Category: ${v.category||'health'}, Market: ${v.market||'US'}
JSON: {"product_name":"...","overall_score":82,"demand_score":80,"competition_score":65,"saturation_score":55,"trend_direction":"rising","verdict":"winner","summary":"...","demand_analysis":"...","competition_analysis":"...","profit_margin_estimate":"40-65%","suggested_price_range":"$25-$45","target_audience":["..."],"key_selling_points":["..."],"risk_factors":["..."],"recommendations":["..."]}`,

  tiktok_viral:(v)=>`Find TikTok viral product opportunities.
Niche: ${v.niche||'beauty'}, Budget: ${v.budget||'$500-2000'}, Market: ${v.market||'US'}
JSON: {"products":[{"rank":1,"product":"...","viral_score":92,"trending_hashtags":["#..."],"estimated_monthly_searches":45000,"video_view_potential":"high","hooks":["..."],"content_angle":"...","why_viral":"...","profit_potential":"high"}],"trending_categories":["..."],"action_plan":["..."]}`,

  ad_creative:(v)=>`Generate ad creatives for this product.
Product: ${v.product}, Platform: ${v.platform||'TikTok & Facebook'}, Audience: ${v.audience||'18-35'}, USP: ${v.usp||''}
JSON: {"ad_angles":[{"angle":"...","emotion":"fear","headline":"...","body_copy":"...","cta":"...","why_works":"..."}],"tiktok_scripts":[{"hook":"...","script":"...","duration":"30s","visual_direction":"..."}],"facebook_ads":[{"headline":"...","primary_text":"...","cta_button":"Shop Now","image_direction":"..."}],"ad_hooks":["..."]}`,

  ad_script:(v)=>`Write a complete ad script.
Product: ${v.product}, Platform: ${v.platform||'TikTok'}, Duration: ${v.duration||'30s'}, Style: ${v.style||'UGC'}
JSON: {"script":{"hook":"...","problem":"...","solution":"...","proof":"...","offer":"...","cta":"...","full_script":"..."},"b_roll_shots":["..."],"voiceover_tips":"...","music_suggestions":["..."],"estimated_ctr":"3-5%"}`,

  product_description:(v)=>`Write high-converting product descriptions.
Product: ${v.product}, Features: ${v.features||''}, Buyer: ${v.buyer||'general'}, Tone: ${v.tone||'friendly'}
JSON: {"title":"...","tagline":"...","short_description":"...","long_description":"...","bullet_points":["..."],"seo_description":"...","emotional_copy":"...","faqs":[{"q":"...","a":"..."}],"keywords":["..."]}`,

  supplier_finder:(v)=>`Find supplier strategy for this product.
Product: ${v.product}, Budget: ${v.budget||'$500'}, Quality: ${v.quality||'medium'}
JSON: {"platforms":[{"name":"Alibaba","search_terms":["..."],"tips":"..."},{"name":"AliExpress","search_terms":["..."],"tips":"..."}],"verification_checklist":["..."],"red_flags":["..."],"outreach_email":{"subject":"...","body":"..."},"negotiation_tips":["..."],"estimated_cogs":"...","recommended_margin":"..."}`,

  competitor_analysis:(v)=>`Analyze competitors for this product.
Product: ${v.product}, Competitors: ${v.competitors||'unknown'}, Platform: ${v.platform||'Amazon'}
JSON: {"market_overview":"...","competitors":[{"name":"...","estimated_monthly_revenue":"...","price_range":"...","strengths":["..."],"weaknesses":["..."],"review_score":4.2,"market_share_estimate":"..."}],"market_gaps":["..."],"differentiation_opportunities":["..."],"entry_difficulty":"medium","win_strategy":["..."]}`,

  market_report:(v)=>`Generate a complete market research report.
Product: ${v.product}, Market: ${v.market||'US'}, Budget: ${v.budget||'$1000-5000'}
JSON: {"report_title":"...","executive_summary":"...","market_size":"...","growth_rate":"...","opportunity_score":78,"demand_prediction":"increasing","target_demographics":[{"segment":"...","size":"...","pain_points":["..."]}],"market_trends":["..."],"financial_projections":{"month1":"$500-1500","month3":"$2000-5000","month6":"$5000-15000"},"risk_assessment":[{"risk":"...","probability":"medium","mitigation":"..."}],"action_plan":[{"week":1,"actions":["..."]}],"overall_recommendation":"..."}`,

  /* ── NEW TOOLS ── */
  post_generator:(v)=>`Create a Facebook/social media post for this product.
Product: ${v.product}, Language: ${v.lang||'Bengali'}, Features: ${v.features||''}
JSON: {"posts":[{"type":"standard","title":"...","body":"...","cta":"...","emoji_style":"friendly"},{"type":"storytelling","title":"...","body":"...","cta":"..."},{"type":"question_hook","title":"...","body":"...","cta":"..."}],"hashtags":["..."],"best_posting_time":"...","tips":["..."]}`,

  viral_post:(v)=>`Create a viral social media post using current trends and hooks.
Product/Topic: ${v.topic}, Platform: ${v.platform||'Facebook'}, Target: ${v.target||'general audience'}
JSON: {"viral_posts":[{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"curiosity/fear/humor/greed","expected_reach":"high/medium"},{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"...","expected_reach":"..."},{"hook":"...","body":"...","cta":"...","viral_factor":"...","emotion_trigger":"...","expected_reach":"..."}],"trending_elements":["..."],"timing_tip":"..."}`,

  promo_post:(v)=>`Create promotional posts for this offer or sale event.
Product: ${v.product}, Offer: ${v.offer||'20% discount'}, Duration: ${v.duration||'48 hours'}, Platform: ${v.platform||'Facebook'}
JSON: {"promo_posts":[{"style":"urgency","headline":"...","body":"...","cta":"...","countdown_text":"..."},{"style":"value_focus","headline":"...","body":"...","cta":"..."},{"style":"social_proof","headline":"...","body":"...","cta":"..."}],"offer_headline":"...","discount_angle":"...","hashtags":["..."]}`,

  ad_copy:(v)=>`Generate high-converting ad copy for Facebook or Google Ads.
Product: ${v.product}, Goal: ${v.goal||'sales'}, Audience: ${v.audience||'adults 25-45'}, Budget: ${v.budget||'medium'}
JSON: {"facebook_ads":[{"headline":"...","primary_text":"...","description":"...","cta":"Shop Now","pain_point":"..."},{"headline":"...","primary_text":"...","description":"...","cta":"Learn More","pain_point":"..."}],"google_ads":[{"headline1":"...","headline2":"...","headline3":"...","description1":"...","description2":"...","display_url":"..."},{"headline1":"...","headline2":"...","headline3":"...","description1":"...","description2":"...","display_url":"..."}],"power_words":["..."],"conversion_tips":["..."]}`,

  video_script:(v)=>`Write a complete video script for YouTube or Facebook.
Topic: ${v.topic}, Duration: ${v.duration||'3-5 minutes'}, Style: ${v.style||'educational'}, Platform: ${v.platform||'YouTube'}
JSON: {"title":"...","intro":{"hook":"...","presenter_line":"...","what_to_expect":"..."},"body":[{"section":"...","content":"...","visual_cue":"...","duration_seconds":30}],"outro":{"summary":"...","cta":"...","subscribe_line":"..."},"b_roll_suggestions":["..."],"thumbnail_idea":"...","tags":["..."]}`,

  video_prompt:(v)=>`Generate AI video prompts for Veo, Sora or similar AI video tools.
Product/Scene: ${v.scene}, Style: ${v.style||'cinematic'}, Duration: ${v.duration||'15 seconds'}
JSON: {"prompts":[{"title":"Prompt 1 — ${v.style}","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."},{"title":"Prompt 2 — Alternative","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."},{"title":"Prompt 3 — Close-up Product","prompt":"...","negative_prompt":"...","camera_movement":"...","lighting":"...","mood":"..."}],"style_tips":["..."],"best_tool":"Veo/Sora/Kling"}`,

  storyboard:(v)=>`Create a detailed storyboard for this video concept.
Product/Topic: ${v.topic}, Video Type: ${v.type||'product showcase'}, Duration: ${v.duration||'30 seconds'}
JSON: {"title":"...","concept":"...","scenes":[{"scene_number":1,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":2,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":3,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":4,"duration_seconds":5,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."},{"scene_number":5,"duration_seconds":10,"visual":"...","audio":"...","text_overlay":"...","camera_angle":"...","transition":"..."}],"music_mood":"...","color_palette":["..."],"director_notes":"..."}`,

  subtitle_translator:(v)=>`Translate these subtitles/captions accurately.
Text: ${v.text}, From: ${v.from||'English'}, To: ${v.to||'Bengali'}, Style: ${v.style||'natural conversational'}
JSON: {"translated_lines":[{"original":"...","translated":"...","timing_note":"..."}],"translation_notes":"...","cultural_adaptations":["..."],"formality_level":"...","alternative_phrases":[{"original":"...","alternative":"..."}]}`,

  ad_funnel:(v)=>`Create a complete ad funnel strategy for this product.
Product: ${v.product}, Budget: ${v.budget||'medium'}, Goal: ${v.goal||'sales'}, Timeline: ${v.timeline||'30 days'}
JSON: {"funnel_overview":"...","stages":[{"stage":"Awareness","objective":"...","ad_type":"...","audience":"...","budget_percentage":"30%","content":"...","kpi":"...","example_copy":"..."},{"stage":"Consideration","objective":"...","ad_type":"...","audience":"...","budget_percentage":"40%","content":"...","kpi":"...","example_copy":"..."},{"stage":"Conversion","objective":"...","ad_type":"...","audience":"...","budget_percentage":"30%","content":"...","kpi":"...","example_copy":"..."}],"retargeting_strategy":"...","expected_roas":"...","timeline":["..."]}`,

  concept_architect:(v)=>`Create a complete business or marketing campaign blueprint.
Idea/Product: ${v.idea}, Industry: ${v.industry||'ecommerce'}, Budget: ${v.budget||'startup'}, Goal: ${v.goal||'launch'}
JSON: {"concept_title":"...","executive_summary":"...","unique_value_proposition":"...","target_market":{"primary":"...","secondary":"...","psychographics":["..."]},"competitive_advantage":["..."],"revenue_model":{"streams":["..."],"pricing_strategy":"...","projected_monthly":"..."},"marketing_plan":{"phase1":"...","phase2":"...","phase3":"..."},"action_items":[{"week":1,"tasks":["..."]},{"week":2,"tasks":["..."]},{"week":3,"tasks":["..."]},{"week":4,"tasks":["..."]}],"success_metrics":["..."],"risk_mitigation":["..."]}`,
};

/* ========== RENDER HELPERS ========== */
const R = {
  skeleton(n=3){
    return Array(n).fill(0).map(()=>`<div class="card mb-2" style="padding:18px">
      <div class="skeleton mb-2" style="height:13px;width:55%"></div>
      <div class="skeleton mb-1" style="height:11px;width:88%"></div>
      <div class="skeleton" style="height:11px;width:70%"></div>
    </div>`).join('');
  },
  error(msg){ return `<div class="alert alert-error"><span>⚠️</span><div><strong>সমস্যা হয়েছে:</strong> ${msg}<br><small>আবার চেষ্টা করুন।</small></div></div>`; },
  limitReached(){ return `<div class="alert alert-warning" style="flex-direction:column;gap:12px"><div>⚠️ <strong>আজকের ফ্রি ব্যবহার শেষ (${CONFIG.FREE_DAILY_LIMIT}/দিন)</strong></div><div style="font-size:.85rem;color:var(--text2)">আগামীকাল আবার ব্যবহার করুন বা Pro-তে upgrade করুন।</div><button class="btn btn-primary btn-sm" onclick="showUpgradeModal()">🚀 Pro-তে Upgrade করুন</button></div>`; },
  scoreBar(score,color='var(--a1)'){
    const p=Math.min(100,Math.max(0,score));
    const c=p>=75?'var(--a1)':p>=50?'var(--a3)':'#f87171';
    return `<div class="meter-row"><div class="progress-bar"><div class="progress-fill" style="width:${p}%;background:${color||c}"></div></div><span class="meter-val" style="color:${color||c}">${p}</span></div>`;
  },
  scoreCircle(s){ const c=s>=75?'var(--a1)':s>=50?'var(--a3)':'#f87171'; return `<div class="score-ring" style="background:rgba(0,0,0,.28);border:3px solid ${c};color:${c}">${s}</div>`; },
  tags(items,cls='tag-mint'){ return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${(items||[]).map(t=>`<span class="tag ${cls}">${t}</span>`).join('')}</div>`; },
  list(items,icon='→'){ return `<ul style="list-style:none;padding:0">${(items||[]).map(i=>`<li style="padding:5px 0;font-size:.86rem;color:var(--text2);display:flex;gap:8px"><span style="color:var(--a1);flex-shrink:0">${icon}</span>${i}</li>`).join('')}</ul>`; },
  copyBox(text,label='Copy'){
    const id='cb_'+Math.random().toString(36).slice(2);
    return `<div class="copy-box"><div id="${id}" class="copy-box-inner">${text}</div><button class="copy-btn" onclick="copyText(document.getElementById('${id}').textContent,this)">${label}</button></div>`;
  },
};

/* ========== MODALS ========== */
const Modal = {
  show(id){ document.getElementById(id)?.classList.remove('hidden') },
  hide(id){ document.getElementById(id)?.classList.add('hidden') },
  hideAll(){ document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.add('hidden')) },
};

/* ========== UTILITY ========== */
function copyText(text,btn){
  navigator.clipboard.writeText(text).then(()=>{
    const o=btn.textContent; btn.textContent='✅ Copied!';
    setTimeout(()=>{ btn.textContent=o; },2000);
  });
}
function downloadText(text,fn){
  const b=new Blob([text],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fn||'output.txt'; a.click();
}
function showUpgradeModal(){ Modal.show('upgradeModal') }

function updateUsageDisplay(){
  const r=Engine.remaining(), isPro=Store.isPro();
  document.querySelectorAll('.usage-display').forEach(el=>{
    el.textContent=isPro?'∞ Pro':`${r}/${CONFIG.FREE_DAILY_LIMIT}`;
    el.style.color=isPro?'var(--a1)':r>0?'var(--a3)':'#f87171';
  });
}

function switchTab(prefix,tab,btn){
  document.querySelectorAll(`[id^="${prefix}-tab-"]`).forEach(el=>el.classList.add('hidden'));
  document.getElementById(`${prefix}-tab-${tab}`)?.classList.remove('hidden');
  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

/* ========== SUPPORT CHAT ========== */
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
  if(body) body.innerHTML=`<div class="alert alert-success"><span>✅</span><div><strong>বার্তা পাঠানো হয়েছে!</strong><br>কয়েক ঘণ্টার মধ্যে reply পাবেন।</div></div>`;
  setTimeout(()=>{ if(body) body.innerHTML=supportBodyHTML(); },5000);
}

/* ========== BANNER SLIDER ========== */
let bannerIdx=0;
function initBanners(){
  const banners=Store.getBanners().filter(b=>b.active);
  const container=document.getElementById('bannerSlider');
  if(!container||!banners.length)return;
  container.innerHTML=banners.map((b,i)=>`
    <div class="banner-slide ${i===0?'active':''}" id="bs-${i}" style="background:${b.bg}">
      <div class="banner-content">
        <h2>${b.title}</h2>
        <p>${b.subtitle}</p>
        <a href="${b.link||'#'}" class="btn btn-primary">${b.cta||'শুরু করুন'}</a>
      </div>
    </div>`).join('')+
    `<button class="banner-arr banner-prev" onclick="slideBanner(-1)">‹</button>
     <button class="banner-arr banner-next" onclick="slideBanner(1)">›</button>
     <div class="banner-nav">${banners.map((_,i)=>`<div class="banner-dot ${i===0?'active':''}" onclick="goBanner(${i})"></div>`).join('')}</div>`;
  setInterval(()=>slideBanner(1),5500);
}
function slideBanner(dir){
  const slides=document.querySelectorAll('.banner-slide'), dots=document.querySelectorAll('.banner-dot');
  if(!slides.length)return;
  slides[bannerIdx].classList.remove('active'); dots[bannerIdx]?.classList.remove('active');
  bannerIdx=(bannerIdx+dir+slides.length)%slides.length;
  slides[bannerIdx].classList.add('active'); dots[bannerIdx]?.classList.add('active');
}
function goBanner(i){
  const slides=document.querySelectorAll('.banner-slide'), dots=document.querySelectorAll('.banner-dot');
  slides[bannerIdx]?.classList.remove('active'); dots[bannerIdx]?.classList.remove('active');
  bannerIdx=i; slides[i]?.classList.add('active'); dots[i]?.classList.add('active');
}

/* ========== TOOL RUNNERS ========== */

async function runProductResearch(){
  if(!Engine.checkLimit()){ document.getElementById('pr-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('pr-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  document.getElementById('pr-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.product_research({product,category:document.getElementById('pr-category')?.value,market:document.getElementById('pr-market')?.value}));
    Store.incUsage(); Store.logEvent('product_research',{product}); updateUsageDisplay();
    const vTag=data.verdict==='winner'?'tag-green':data.verdict==='potential'?'tag-amber':'tag-red';
    document.getElementById('pr-result').innerHTML=`
      <div class="result-card fade-up">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          ${R.scoreCircle(data.overall_score)}
          <div><h3 style="color:#fff">${data.product_name}</h3><span class="tag ${vTag}" style="margin-top:4px">● ${(data.verdict||'').toUpperCase()}</span></div>
          <div style="margin-left:auto;text-align:right;font-size:.82rem;color:var(--text2)">Trend: <strong style="color:${data.trend_direction==='rising'?'var(--a1)':'var(--a3)'}">${data.trend_direction}</strong></div>
        </div>
        <p style="font-size:.87rem;margin-bottom:14px">${data.summary}</p>
        <div class="divider"></div>
        <div style="margin:12px 0">
          <div class="meter-row"><span class="meter-label">📈 Demand</span>${R.scoreBar(data.demand_score,'var(--a1)')}</div>
          <div class="meter-row"><span class="meter-label">⚔️ Competition</span>${R.scoreBar(data.competition_score,'var(--a3)')}</div>
          <div class="meter-row"><span class="meter-label">🌊 Saturation</span>${R.scoreBar(data.saturation_score,'#f87171')}</div>
        </div>
        <div class="divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0">
          <div><div style="font-size:.77rem;color:var(--text2);margin-bottom:4px">💰 আনুমানিক Margin</div><strong style="color:var(--a1)">${data.profit_margin_estimate}</strong></div>
          <div><div style="font-size:.77rem;color:var(--text2);margin-bottom:4px">🏷️ মূল্য পরিসর</div><strong style="color:#fff">${data.suggested_price_range}</strong></div>
        </div>
        <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">🎯 Target Audience</strong>${R.tags(data.target_audience,'tag-mint')}</div>
        <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⭐ মূল বৈশিষ্ট্য</strong>${R.list(data.key_selling_points,'⭐')}</div>
        <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⚠️ ঝুঁকি</strong>${R.list(data.risk_factors,'⚠️')}</div>
        <div><strong style="font-size:.83rem;color:var(--text2)">✅ পরামর্শ</strong>${R.list(data.recommendations,'→')}</div>
      </div>`;
  }catch(e){ document.getElementById('pr-result').innerHTML=R.error(e.message); }
}

async function runTikTokFinder(){
  if(!Engine.checkLimit()){ document.getElementById('tt-result').innerHTML=R.limitReached(); return; }
  const niche=document.getElementById('tt-niche')?.value?.trim();
  if(!niche){ Toast.error('Niche দিন'); return; }
  document.getElementById('tt-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.tiktok_viral({niche,budget:document.getElementById('tt-budget')?.value,market:document.getElementById('tt-market')?.value}));
    Store.incUsage(); Store.logEvent('tiktok',{niche}); updateUsageDisplay();
    document.getElementById('tt-result').innerHTML=`
      <div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Categories</strong>${R.tags(data.trending_categories,'tag-red')}</div>
      ${(data.products||[]).map((p,i)=>`
      <div class="result-card fade-up">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--a4),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:.88rem;flex-shrink:0">${i+1}</div>
          <div style="flex:1"><strong style="color:#fff">${p.product}</strong></div>
          <div style="text-align:right"><div style="font-family:var(--font-h);font-size:1.3rem;font-weight:800;color:${p.viral_score>=80?'var(--a1)':'var(--a3)'}">${p.viral_score}</div><div style="font-size:.7rem;color:var(--text2)">Viral</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="text-align:center"><div style="font-size:.72rem;color:var(--text2)">মাসিক খোঁজ</div><strong style="color:#fff">${(p.estimated_monthly_searches||0).toLocaleString()}</strong></div>
          <div style="text-align:center"><div style="font-size:.72rem;color:var(--text2)">লাভের সম্ভাবনা</div><strong style="color:var(--a1)">${p.profit_potential}</strong></div>
        </div>
        <p style="font-size:.84rem;color:var(--text2);margin-bottom:10px">💡 ${p.why_viral}</p>
        <div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">🎣 Hooks</strong>${R.list(p.hooks,'🎣')}</div>
        ${R.tags(p.trending_hashtags,'tag-red')}
      </div>`).join('')}
      <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">📋 Action Plan</strong>${R.list(data.action_plan,'→')}</div>`;
  }catch(e){ document.getElementById('tt-result').innerHTML=R.error(e.message); }
}

async function runAdCreative(){
  if(!Engine.checkLimit()){ document.getElementById('ac-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('ac-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  document.getElementById('ac-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.ad_creative({product,platform:document.getElementById('ac-platform')?.value,audience:document.getElementById('ac-audience')?.value,usp:document.getElementById('ac-usp')?.value}));
    Store.incUsage(); Store.logEvent('ad_creative',{product}); updateUsageDisplay();
    const eTag=e=>e==='fear'?'tag-red':e==='greed'?'tag-amber':e==='curiosity'?'tag-mint':'tag-green';
    document.getElementById('ac-result').innerHTML=`
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('ac','angles',this)">📐 Angles</button>
        <button class="tab-btn" onclick="switchTab('ac','tiktok',this)">🎵 TikTok</button>
        <button class="tab-btn" onclick="switchTab('ac','fb',this)">📘 Facebook</button>
        <button class="tab-btn" onclick="switchTab('ac','hooks',this)">🎣 Hooks</button>
      </div>
      <div id="ac-tab-angles">
        ${(data.ad_angles||[]).map(a=>`<div class="result-card fade-up mb-2">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="tag ${eTag(a.emotion)}">${a.emotion}</span><strong style="color:#fff">${a.angle}</strong></div>
          <div class="mb-2">${R.copyBox(a.headline,'Copy')}</div>
          <p style="font-size:.85rem;color:var(--text2);margin-bottom:8px">${a.body_copy}</p>
          <div style="display:flex;gap:8px"><span class="tag tag-green">CTA: ${a.cta}</span><span style="font-size:.77rem;color:var(--text2)">💡 ${a.why_works}</span></div>
        </div>`).join('')}
      </div>
      <div id="ac-tab-tiktok" class="hidden">
        ${(data.tiktok_scripts||[]).map((s,i)=>`<div class="result-card fade-up mb-2">
          <div class="tag tag-red mb-2">TikTok Script ${i+1} — ${s.duration}</div>
          <div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">🎣 HOOK</strong>${R.copyBox(s.hook,'Copy')}</div>
          <div><strong style="font-size:.8rem;color:var(--text2)">📝 FULL SCRIPT</strong>${R.copyBox(s.script,'Copy')}</div>
          <p style="font-size:.82rem;color:var(--text2);margin-top:8px">🎬 ${s.visual_direction}</p>
        </div>`).join('')}
      </div>
      <div id="ac-tab-fb" class="hidden">
        ${(data.facebook_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2">
          <div class="tag tag-blue mb-2">Facebook Ad ${i+1}</div>
          <div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">HEADLINE</strong>${R.copyBox(ad.headline,'Copy')}</div>
          <div class="mb-2"><strong style="font-size:.8rem;color:var(--text2)">PRIMARY TEXT</strong>${R.copyBox(ad.primary_text,'Copy')}</div>
          <div style="display:flex;gap:8px"><span class="tag tag-green">Button: ${ad.cta_button}</span><span style="font-size:.8rem;color:var(--text2)">📸 ${ad.image_direction}</span></div>
        </div>`).join('')}
      </div>
      <div id="ac-tab-hooks" class="hidden">
        <div class="result-card fade-up"><strong style="font-size:.85rem;color:var(--text2)">🎣 Power Hooks</strong>
          <div style="margin-top:10px">${(data.ad_hooks||[]).map((h,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="width:22px;height:22px;border-radius:50%;background:rgba(0,245,212,.1);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:var(--a1);flex-shrink:0">${i+1}</span>
            <span style="flex:1;font-size:.86rem">${h}</span>
            <button class="copy-btn" style="position:static" onclick="copyText('${h.replace(/'/g,"\\'")}',this)">Copy</button>
          </div>`).join('')}</div>
        </div>
      </div>`;
  }catch(e){ document.getElementById('ac-result').innerHTML=R.error(e.message); }
}

async function runAdScript(){
  if(!Engine.checkLimit()){ document.getElementById('as-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('as-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  document.getElementById('as-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.ad_script({product,platform:document.getElementById('as-platform')?.value,duration:document.getElementById('as-duration')?.value,style:document.getElementById('as-style')?.value}));
    Store.incUsage(); Store.logEvent('ad_script',{product}); updateUsageDisplay();
    const s=data.script||{};
    document.getElementById('as-result').innerHTML=`
      <div class="result-card fade-up">
        <div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-mint">${document.getElementById('as-platform')?.value}</span><span class="tag tag-blue">${document.getElementById('as-duration')?.value}</span><span class="tag tag-violet">CTR: ${data.estimated_ctr}</span></div>
        <div style="display:grid;gap:10px">
          <div><div class="tag tag-red mb-1">🎣 HOOK</div>${R.copyBox(s.hook,'Copy')}</div>
          <div><div class="tag tag-amber mb-1">❓ PROBLEM</div><p style="font-size:.86rem">${s.problem}</p></div>
          <div><div class="tag tag-green mb-1">✅ SOLUTION</div><p style="font-size:.86rem">${s.solution}</p></div>
          <div><div class="tag tag-blue mb-1">⭐ PROOF</div><p style="font-size:.86rem">${s.proof}</p></div>
          <div><div class="tag tag-violet mb-1">🎁 OFFER</div><p style="font-size:.86rem">${s.offer}</p></div>
          <div><div class="tag tag-mint mb-1">📣 CTA</div>${R.copyBox(s.cta,'Copy')}</div>
        </div>
        <div class="divider"></div>
        <div><strong style="font-size:.84rem;color:var(--text2)">📝 FULL SCRIPT</strong><div style="margin-top:8px">${R.copyBox(s.full_script,'📋 Copy Full')}</div></div>
        <div class="divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><strong style="font-size:.82rem;color:var(--text2)">🎬 B-Roll Shots</strong>${R.list(data.b_roll_shots,'📷')}</div>
          <div><strong style="font-size:.82rem;color:var(--text2)">🎵 Music</strong>${R.list(data.music_suggestions,'🎵')}</div>
        </div>
      </div>`;
  }catch(e){ document.getElementById('as-result').innerHTML=R.error(e.message); }
}

async function runProductDesc(){
  if(!Engine.checkLimit()){ document.getElementById('pd-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('pd-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  document.getElementById('pd-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.product_description({product,features:document.getElementById('pd-features')?.value,buyer:document.getElementById('pd-buyer')?.value,tone:document.getElementById('pd-tone')?.value}));
    Store.incUsage(); Store.logEvent('product_desc',{product}); updateUsageDisplay();
    document.getElementById('pd-result').innerHTML=`
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('pdt','main',this)">📝 Main</button>
        <button class="tab-btn" onclick="switchTab('pdt','seo',this)">🔍 SEO</button>
        <button class="tab-btn" onclick="switchTab('pdt','emo',this)">❤️ Emotional</button>
      </div>
      <div id="pdt-tab-main">
        <div class="result-card fade-up mb-2"><div class="tag tag-mint mb-2">Title</div>${R.copyBox(data.title,'Copy')}</div>
        <div class="result-card fade-up mb-2"><div class="tag tag-violet mb-2">Tagline</div>${R.copyBox(data.tagline,'Copy')}</div>
        <div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">Short Description</div>${R.copyBox(data.short_description,'Copy')}</div>
        <div class="result-card fade-up mb-2">
          <div class="tag tag-mint mb-2">✅ Bullet Points</div>
          ${(data.bullet_points||[]).map(b=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.86rem;display:flex;gap:8px"><span style="color:var(--a1)">●</span>${b}</div>`).join('')}
          <button class="copy-btn" style="position:static;margin-top:8px" onclick="copyText('${(data.bullet_points||[]).join('\\n').replace(/'/g,"\\'")}',this)">📋 সব Copy করুন</button>
        </div>
        <div class="result-card fade-up"><div class="tag tag-blue mb-2">Full Description</div>${R.copyBox(data.long_description,'📋 Copy')}</div>
      </div>
      <div id="pdt-tab-seo" class="hidden">
        <div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">SEO Description</div>${R.copyBox(data.seo_description,'Copy')}</div>
        <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🎯 Keywords</strong>${R.tags(data.keywords,'tag-mint')}</div>
      </div>
      <div id="pdt-tab-emo" class="hidden">
        <div class="result-card fade-up mb-2"><div class="tag tag-red mb-2">❤️ Emotional Copy</div>${R.copyBox(data.emotional_copy,'Copy')}</div>
        <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">❓ FAQs</strong>${(data.faqs||[]).map(f=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-weight:800;color:#fff;font-size:.86rem;margin-bottom:4px">Q: ${f.q}</div><div style="font-size:.84rem;color:var(--text2)">A: ${f.a}</div></div>`).join('')}</div>
      </div>`;
  }catch(e){ document.getElementById('pd-result').innerHTML=R.error(e.message); }
}

async function runSupplier(){
  if(!Engine.checkLimit()){ document.getElementById('sf-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('sf-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  document.getElementById('sf-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.supplier_finder({product,budget:document.getElementById('sf-budget')?.value,quality:document.getElementById('sf-quality')?.value}));
    Store.incUsage(); Store.logEvent('supplier',{product}); updateUsageDisplay();
    document.getElementById('sf-result').innerHTML=`
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('sf','plat',this)">🏭 Platforms</button>
        <button class="tab-btn" onclick="switchTab('sf','check',this)">✅ Checklist</button>
        <button class="tab-btn" onclick="switchTab('sf','email',this)">📧 Outreach</button>
      </div>
      <div id="sf-tab-plat">
        ${(data.platforms||[]).map(p=>`<div class="result-card fade-up mb-2">
          <div class="tag tag-mint mb-2">🏭 ${p.name}</div>
          <strong style="font-size:.82rem;color:var(--text2)">Search Terms:</strong>${R.tags(p.search_terms,'tag-mint')}
          <p style="font-size:.84rem;margin-top:8px">💡 ${p.tips}</p>
        </div>`).join('')}
        <div class="result-card fade-up" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><div style="font-size:.77rem;color:var(--text2)">📦 Est. COGS</div><strong style="color:var(--a1)">${data.estimated_cogs}</strong></div>
          <div><div style="font-size:.77rem;color:var(--text2)">💹 Margin</div><strong style="color:var(--a3)">${data.recommended_margin}</strong></div>
        </div>
      </div>
      <div id="sf-tab-check" class="hidden">
        <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">✅ Verification Checklist</strong>${R.list(data.verification_checklist,'✅')}</div>
        <div class="result-card fade-up"><strong style="font-size:.84rem;color:#f87171">🚩 Red Flags</strong>${R.list(data.red_flags,'🚩')}</div>
      </div>
      <div id="sf-tab-email" class="hidden">
        <div class="result-card fade-up mb-2">
          <div style="font-size:.82rem;color:var(--text2);margin-bottom:6px">Subject: <strong style="color:#fff">${data.outreach_email?.subject}</strong></div>
          ${R.copyBox(data.outreach_email?.body,'📋 Copy Email')}
        </div>
        <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">💼 Negotiation Tips</strong>${R.list(data.negotiation_tips,'💼')}</div>
      </div>`;
  }catch(e){ document.getElementById('sf-result').innerHTML=R.error(e.message); }
}

async function runCompetitor(){
  if(!Engine.checkLimit()){ document.getElementById('ca-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('ca-product')?.value?.trim();
  if(!product){ Toast.error('Product/Niche দিন'); return; }
  document.getElementById('ca-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.competitor_analysis({product,competitors:document.getElementById('ca-competitors')?.value,platform:document.getElementById('ca-platform')?.value}));
    Store.incUsage(); Store.logEvent('competitor',{product}); updateUsageDisplay();
    document.getElementById('ca-result').innerHTML=`
      <div class="result-card fade-up mb-2"><p style="font-size:.86rem">${data.market_overview}</p></div>
      ${(data.competitors||[]).map(c=>`<div class="result-card fade-up mb-2">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <strong style="color:#fff">🏢 ${c.name}</strong>
          <div style="text-align:right"><div style="font-size:.73rem;color:var(--text2)">Revenue</div><strong style="color:var(--a1)">${c.estimated_monthly_revenue}/mo</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
          <div><div style="font-size:.73rem;color:var(--text2)">Price</div><strong style="color:#fff">${c.price_range}</strong></div>
          <div><div style="font-size:.73rem;color:var(--text2)">Rating</div><strong style="color:var(--a3)">⭐ ${c.review_score}</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><div style="font-size:.77rem;color:var(--a1);margin-bottom:4px">✅ Strengths</div>${R.list(c.strengths,'✅')}</div>
          <div><div style="font-size:.77rem;color:#f87171;margin-bottom:4px">❌ Weaknesses</div>${R.list(c.weaknesses,'❌')}</div>
        </div>
      </div>`).join('')}
      <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🔓 Market Gaps</strong>${R.list(data.market_gaps,'💡')}</div>
      <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">🏆 Win Strategy</strong>${R.list(data.win_strategy,'→')}</div>`;
  }catch(e){ document.getElementById('ca-result').innerHTML=R.error(e.message); }
}

async function runMarketReport(){
  if(!Engine.checkLimit()){ document.getElementById('mr-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('mr-product')?.value?.trim();
  if(!product){ Toast.error('Product/Niche দিন'); return; }
  document.getElementById('mr-result').innerHTML=R.skeleton(4);
  try{
    const data=await Engine.call(Prompts.market_report({product,market:document.getElementById('mr-market')?.value,budget:document.getElementById('mr-budget')?.value}));
    Store.incUsage(); Store.logEvent('market_report',{product}); updateUsageDisplay();
    document.getElementById('mr-result').innerHTML=`
      <div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.04))">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          ${R.scoreCircle(data.opportunity_score)}
          <div><h3 style="color:#fff;font-size:.97rem">${data.report_title}</h3><div style="display:flex;gap:6px;margin-top:5px"><span class="tag tag-mint">${data.market_size}</span><span class="tag ${data.demand_prediction==='increasing'?'tag-green':'tag-amber'}">${data.demand_prediction}</span></div></div>
        </div>
        <p style="font-size:.86rem">${data.executive_summary}</p>
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">📈 Revenue Projections</strong>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px">
          ${[['Month 1',data.financial_projections?.month1,'var(--a5)'],['Month 3',data.financial_projections?.month3,'var(--a1)'],['Month 6',data.financial_projections?.month6,'#4ade80']].map(([l,v,c])=>`<div style="text-align:center;padding:12px;background:rgba(0,0,0,.2);border-radius:10px"><div style="font-size:.71rem;color:var(--text2)">${l}</div><strong style="color:${c};font-size:.88rem">${v}</strong></div>`).join('')}
        </div>
      </div>
      <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📊 Market Trends</strong>${R.list(data.market_trends,'📊')}</div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">⚠️ Risk Assessment</strong>
        ${(data.risk_assessment||[]).map(r=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><strong style="color:#fff">${r.risk}</strong><span class="tag ${r.probability==='low'?'tag-green':r.probability==='medium'?'tag-amber':'tag-red'}">${r.probability}</span></div><p style="font-size:.82rem">🛡️ ${r.mitigation}</p></div>`).join('')}
      </div>
      <div class="result-card fade-up">
        <strong style="font-size:.84rem;color:var(--text2)">📅 Action Plan</strong>
        ${(data.action_plan||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="tag tag-mint mb-1">Week ${w.week}</div>${R.list(w.actions,'→')}</div>`).join('')}
        <div style="margin-top:14px;padding:14px;background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.2);border-radius:10px;font-size:.86rem"><strong style="color:var(--a1)">চূড়ান্ত পরামর্শ:</strong> ${data.overall_recommendation}</div>
      </div>`;
  }catch(e){ document.getElementById('mr-result').innerHTML=R.error(e.message); }
}

/* ── NEW TOOL RUNNERS ── */

async function runPostGenerator(){
  if(!Engine.checkLimit()){ document.getElementById('pg-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('pg-product')?.value?.trim();
  if(!product){ Toast.error('Product name দিন'); return; }
  document.getElementById('pg-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.post_generator({product,lang:document.getElementById('pg-lang')?.value,features:document.getElementById('pg-features')?.value}));
    Store.incUsage(); Store.logEvent('post_generator',{product}); updateUsageDisplay();
    document.getElementById('pg-result').innerHTML=`
      ${(data.posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2">
        <div class="tag tag-mint mb-2">Post ${i+1} — ${p.type}</div>
        ${p.title?`<div class="mb-1"><strong style="font-size:.82rem;color:var(--text2)">Title:</strong> <span style="color:#fff">${p.title}</span></div>`:''}
        ${R.copyBox(p.body,'📋 Copy Post')}
        <div style="margin-top:8px;font-size:.84rem;color:var(--a1)">📣 CTA: ${p.cta}</div>
      </div>`).join('')}
      <div class="result-card fade-up">
        <strong style="font-size:.83rem;color:var(--text2)">🏷️ Hashtags</strong>${R.tags(data.hashtags,'tag-violet')}
        <div style="margin-top:10px"><strong style="font-size:.83rem;color:var(--text2)">💡 Tips</strong>${R.list(data.tips,'💡')}</div>
      </div>`;
  }catch(e){ document.getElementById('pg-result').innerHTML=R.error(e.message); }
}

async function runViralPost(){
  if(!Engine.checkLimit()){ document.getElementById('vp-result').innerHTML=R.limitReached(); return; }
  const topic=document.getElementById('vp-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  document.getElementById('vp-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.viral_post({topic,platform:document.getElementById('vp-platform')?.value,target:document.getElementById('vp-target')?.value}));
    Store.incUsage(); Store.logEvent('viral_post',{topic}); updateUsageDisplay();
    const eColor={curiosity:'tag-mint',fear:'tag-red',humor:'tag-green',greed:'tag-amber'};
    document.getElementById('vp-result').innerHTML=`
      ${(data.viral_posts||[]).map((p,i)=>`<div class="result-card fade-up mb-2">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span class="tag tag-pink">Viral Post ${i+1}</span>
          <span class="tag ${eColor[p.emotion_trigger]||'tag-violet'}">${p.emotion_trigger}</span>
          <span class="tag ${p.expected_reach==='high'?'tag-green':'tag-amber'} " style="margin-left:auto">${p.expected_reach} reach</span>
        </div>
        <div class="mb-2"><strong style="font-size:.82rem;color:var(--text2)">🎣 Hook:</strong> ${R.copyBox(p.hook,'Copy')}</div>
        ${R.copyBox(p.body,'📋 Copy Full Post')}
        <div style="margin-top:8px;font-size:.84rem"><strong style="color:var(--text2)">Viral Factor:</strong> <span style="color:var(--a1)">${p.viral_factor}</span></div>
        <div style="font-size:.84rem;color:var(--a1);margin-top:4px">📣 ${p.cta}</div>
      </div>`).join('')}
      <div class="result-card fade-up">
        <strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Elements</strong>${R.tags(data.trending_elements,'tag-red')}
        <div style="margin-top:10px;font-size:.84rem;color:var(--text2)">⏰ ${data.timing_tip}</div>
      </div>`;
  }catch(e){ document.getElementById('vp-result').innerHTML=R.error(e.message); }
}

async function runPromoPost(){
  if(!Engine.checkLimit()){ document.getElementById('pp-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('pp-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  document.getElementById('pp-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.promo_post({product,offer:document.getElementById('pp-offer')?.value,duration:document.getElementById('pp-duration')?.value,platform:document.getElementById('pp-platform')?.value}));
    Store.incUsage(); Store.logEvent('promo_post',{product}); updateUsageDisplay();
    document.getElementById('pp-result').innerHTML=`
      <div class="result-card fade-up mb-2" style="text-align:center;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(236,72,153,.06))">
        <div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:var(--a3)">${data.offer_headline}</div>
        <div style="font-size:.84rem;color:var(--text2);margin-top:4px">${data.discount_angle}</div>
      </div>
      ${(data.promo_posts||[]).map(p=>`<div class="result-card fade-up mb-2">
        <div class="tag tag-amber mb-2">${p.style}</div>
        <div class="mb-1"><strong style="font-size:.82rem;color:var(--text2)">Headline:</strong> <span style="color:#fff;font-weight:700">${p.headline}</span></div>
        ${R.copyBox(p.body,'📋 Copy')}
        ${p.countdown_text?`<div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,.1);border-radius:8px;font-size:.84rem;color:var(--a3)">⏳ ${p.countdown_text}</div>`:''}
        <div style="margin-top:8px;font-size:.84rem;color:var(--a1)">📣 ${p.cta}</div>
      </div>`).join('')}
      <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🏷️ Hashtags</strong>${R.tags(data.hashtags,'tag-amber')}</div>`;
  }catch(e){ document.getElementById('pp-result').innerHTML=R.error(e.message); }
}

async function runAdCopy(){
  if(!Engine.checkLimit()){ document.getElementById('adc-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('adc-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  document.getElementById('adc-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.ad_copy({product,goal:document.getElementById('adc-goal')?.value,audience:document.getElementById('adc-audience')?.value,budget:document.getElementById('adc-budget')?.value}));
    Store.incUsage(); Store.logEvent('ad_copy',{product}); updateUsageDisplay();
    document.getElementById('adc-result').innerHTML=`
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('adc','fb',this)">📘 Facebook Ads</button>
        <button class="tab-btn" onclick="switchTab('adc','gg',this)">🔍 Google Ads</button>
        <button class="tab-btn" onclick="switchTab('adc','tips',this)">💡 Tips</button>
      </div>
      <div id="adc-tab-fb">
        ${(data.facebook_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2">
          <div class="tag tag-blue mb-2">Facebook Ad ${i+1}</div>
          <div class="mb-2">${R.copyBox(ad.headline,'Headline Copy')}</div>
          ${R.copyBox(ad.primary_text,'Primary Text Copy')}
          <div style="margin-top:8px;font-size:.83rem;color:var(--text2)">Pain Point: ${ad.pain_point}</div>
        </div>`).join('')}
      </div>
      <div id="adc-tab-gg" class="hidden">
        ${(data.google_ads||[]).map((ad,i)=>`<div class="result-card fade-up mb-2">
          <div class="tag tag-green mb-2">Google Ad ${i+1}</div>
          <div style="display:grid;gap:8px">
            <div>${R.copyBox(ad.headline1+' | '+ad.headline2+' | '+ad.headline3,'Headlines Copy')}</div>
            <div>${R.copyBox(ad.description1+'\n'+ad.description2,'Descriptions Copy')}</div>
          </div>
          <div style="margin-top:8px;font-size:.83rem;color:var(--text2)">Display URL: ${ad.display_url}</div>
        </div>`).join('')}
      </div>
      <div id="adc-tab-tips" class="hidden">
        <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">⚡ Power Words</strong>${R.tags(data.power_words,'tag-red')}</div>
        <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">💡 Conversion Tips</strong>${R.list(data.conversion_tips,'💡')}</div>
      </div>`;
  }catch(e){ document.getElementById('adc-result').innerHTML=R.error(e.message); }
}

async function runVideoScript(){
  if(!Engine.checkLimit()){ document.getElementById('vs-result').innerHTML=R.limitReached(); return; }
  const topic=document.getElementById('vs-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  document.getElementById('vs-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.video_script({topic,duration:document.getElementById('vs-duration')?.value,style:document.getElementById('vs-style')?.value,platform:document.getElementById('vs-platform')?.value}));
    Store.incUsage(); Store.logEvent('video_script',{topic}); updateUsageDisplay();
    document.getElementById('vs-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <div class="tag tag-red mb-2">📹 Video Title</div>
        ${R.copyBox(data.title,'Copy')}
      </div>
      <div class="result-card fade-up mb-2">
        <div class="tag tag-mint mb-2">🎬 Intro</div>
        <div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">Hook:</strong> ${R.copyBox(data.intro?.hook,'Copy')}</div>
        <div style="font-size:.84rem;color:var(--text2)">Presenter: ${data.intro?.presenter_line}</div>
      </div>
      ${(data.body||[]).map((sec,i)=>`<div class="result-card fade-up mb-2">
        <div class="tag tag-violet mb-2">Section ${i+1}: ${sec.section} (${sec.duration_seconds}s)</div>
        ${R.copyBox(sec.content,'Copy')}
        <div style="font-size:.82rem;color:var(--text2);margin-top:6px">🎬 ${sec.visual_cue}</div>
      </div>`).join('')}
      <div class="result-card fade-up mb-2">
        <div class="tag tag-amber mb-2">🎯 Outro</div>
        ${R.copyBox(data.outro?.summary+'\n\n'+data.outro?.cta,'Copy')}
      </div>
      <div class="result-card fade-up">
        <strong style="font-size:.83rem;color:var(--text2)">🖼️ Thumbnail Idea</strong>
        <div style="padding:10px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.85rem;margin-top:8px">${data.thumbnail_idea}</div>
        <div style="margin-top:12px"><strong style="font-size:.83rem;color:var(--text2)">🏷️ Tags</strong>${R.tags(data.tags,'tag-blue')}</div>
      </div>`;
  }catch(e){ document.getElementById('vs-result').innerHTML=R.error(e.message); }
}

async function runVideoPrompt(){
  if(!Engine.checkLimit()){ document.getElementById('vpr-result').innerHTML=R.limitReached(); return; }
  const scene=document.getElementById('vpr-scene')?.value?.trim();
  if(!scene){ Toast.error('Scene/Product দিন'); return; }
  document.getElementById('vpr-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.video_prompt({scene,style:document.getElementById('vpr-style')?.value,duration:document.getElementById('vpr-duration')?.value}));
    Store.incUsage(); Store.logEvent('video_prompt',{scene}); updateUsageDisplay();
    document.getElementById('vpr-result').innerHTML=`
      <div class="result-card fade-up mb-2" style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.5rem">🎬</span>
        <div><strong style="color:var(--a1)">Recommended Tool:</strong> <span style="color:#fff">${data.best_tool}</span></div>
      </div>
      ${(data.prompts||[]).map(p=>`<div class="result-card fade-up mb-2">
        <div class="tag tag-violet mb-2">${p.title}</div>
        ${R.copyBox(p.prompt,'📋 Copy Prompt')}
        <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:.8rem">
          <div><span style="color:var(--text2)">Camera:</span> <span style="color:#fff">${p.camera_movement}</span></div>
          <div><span style="color:var(--text2)">Lighting:</span> <span style="color:#fff">${p.lighting}</span></div>
          <div><span style="color:var(--text2)">Mood:</span> <span style="color:#fff">${p.mood}</span></div>
        </div>
        ${p.negative_prompt?`<div style="margin-top:8px;font-size:.8rem;color:var(--text2)">❌ Negative: ${p.negative_prompt}</div>`:''}
      </div>`).join('')}
      <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">💡 Style Tips</strong>${R.list(data.style_tips,'💡')}</div>`;
  }catch(e){ document.getElementById('vpr-result').innerHTML=R.error(e.message); }
}

async function runStoryboard(){
  if(!Engine.checkLimit()){ document.getElementById('sb-result').innerHTML=R.limitReached(); return; }
  const topic=document.getElementById('sb-topic')?.value?.trim();
  if(!topic){ Toast.error('Topic দিন'); return; }
  document.getElementById('sb-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.storyboard({topic,type:document.getElementById('sb-type')?.value,duration:document.getElementById('sb-duration')?.value}));
    Store.incUsage(); Store.logEvent('storyboard',{topic}); updateUsageDisplay();
    document.getElementById('sb-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <h3 style="color:#fff;margin-bottom:6px">${data.title}</h3>
        <p style="font-size:.86rem">${data.concept}</p>
        <div style="display:flex;gap:10px;margin-top:10px">
          <span class="tag tag-violet">Music: ${data.music_mood}</span>
          ${(data.color_palette||[]).map(c=>`<span class="tag tag-mint">${c}</span>`).join('')}
        </div>
      </div>
      ${(data.scenes||[]).map(sc=>`<div class="result-card fade-up mb-2">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--a1),var(--a2));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;color:#0a0a14;flex-shrink:0">${sc.scene_number}</div>
          <div style="flex:1"><strong style="color:#fff">Scene ${sc.scene_number}</strong> <span class="tag tag-mint" style="margin-left:6px">${sc.duration_seconds}s</span></div>
          <span style="font-size:.8rem;color:var(--text2)">${sc.camera_angle}</span>
        </div>
        <div style="display:grid;gap:8px;font-size:.85rem">
          <div><span style="color:var(--text2)">🎬 Visual:</span> <span>${sc.visual}</span></div>
          <div><span style="color:var(--text2)">🔊 Audio:</span> <span>${sc.audio}</span></div>
          ${sc.text_overlay?`<div><span style="color:var(--text2)">📝 Text:</span> <span style="color:var(--a1)">${sc.text_overlay}</span></div>`:''}
          <div><span style="color:var(--text2)">↩ Transition:</span> <span>${sc.transition}</span></div>
        </div>
      </div>`).join('')}
      <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🎬 Director's Notes</strong><p style="font-size:.86rem;margin-top:8px">${data.director_notes}</p></div>`;
  }catch(e){ document.getElementById('sb-result').innerHTML=R.error(e.message); }
}

async function runSubtitleTranslator(){
  if(!Engine.checkLimit()){ document.getElementById('st-result').innerHTML=R.limitReached(); return; }
  const text=document.getElementById('st-text')?.value?.trim();
  if(!text){ Toast.error('Text/Subtitle দিন'); return; }
  document.getElementById('st-result').innerHTML=R.skeleton(2);
  try{
    const data=await Engine.call(Prompts.subtitle_translator({text,from:document.getElementById('st-from')?.value,to:document.getElementById('st-to')?.value,style:document.getElementById('st-style')?.value}));
    Store.incUsage(); Store.logEvent('subtitle_translator',{from:document.getElementById('st-from')?.value,to:document.getElementById('st-to')?.value}); updateUsageDisplay();
    document.getElementById('st-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-blue">${document.getElementById('st-from')?.value}</span><span style="color:var(--text2)">→</span><span class="tag tag-mint">${document.getElementById('st-to')?.value}</span><span class="tag tag-violet">${data.formality_level}</span></div>
        ${(data.translated_lines||[]).map(l=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:.85rem;color:var(--text2)">${l.original}</div>
          <div style="font-size:.85rem;color:var(--a1)">${l.translated}</div>
        </div>`).join('')}
      </div>
      ${data.cultural_adaptations?.length?`<div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🌐 Cultural Adaptations</strong>${R.list(data.cultural_adaptations,'🌐')}</div>`:''}
      ${data.alternative_phrases?.length?`<div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🔄 Alternative Phrases</strong>
        ${data.alternative_phrases.map(p=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:.84rem"><span style="color:var(--text2)">${p.original}</span><span style="color:var(--a3)">${p.alternative}</span></div>`).join('')}
      </div>`:''}`;
  }catch(e){ document.getElementById('st-result').innerHTML=R.error(e.message); }
}

async function runAdFunnel(){
  if(!Engine.checkLimit()){ document.getElementById('af-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('af-product')?.value?.trim();
  if(!product){ Toast.error('Product দিন'); return; }
  document.getElementById('af-result').innerHTML=R.skeleton(3);
  try{
    const data=await Engine.call(Prompts.ad_funnel({product,budget:document.getElementById('af-budget')?.value,goal:document.getElementById('af-goal')?.value,timeline:document.getElementById('af-timeline')?.value}));
    Store.incUsage(); Store.logEvent('ad_funnel',{product}); updateUsageDisplay();
    const stageColors=['tag-blue','tag-violet','tag-green'];
    document.getElementById('af-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <p style="font-size:.86rem">${data.funnel_overview}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div><div style="font-size:.77rem;color:var(--text2)">📊 Expected ROAS</div><strong style="color:var(--a1)">${data.expected_roas}</strong></div>
        </div>
      </div>
      ${(data.stages||[]).map((s,i)=>`<div class="result-card fade-up mb-2">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span class="tag ${stageColors[i]||'tag-mint'}">${s.stage}</span>
          <span style="font-size:.82rem;color:var(--text2)">Budget: ${s.budget_percentage}</span>
          <span style="font-size:.82rem;color:var(--text2);margin-left:auto">KPI: ${s.kpi}</span>
        </div>
        <div style="display:grid;gap:7px;font-size:.85rem">
          <div><span style="color:var(--text2)">🎯 Objective:</span> ${s.objective}</div>
          <div><span style="color:var(--text2)">📢 Ad Type:</span> ${s.ad_type}</div>
          <div><span style="color:var(--text2)">👥 Audience:</span> ${s.audience}</div>
          <div><span style="color:var(--text2)">📝 Content:</span> ${s.content}</div>
        </div>
        <div style="margin-top:10px">${R.copyBox(s.example_copy,'Copy Example')}</div>
      </div>`).join('')}
      <div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🔄 Retargeting Strategy</strong><p style="font-size:.85rem;margin-top:8px">${data.retargeting_strategy}</p></div>
      <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">📅 Timeline</strong>${R.list(data.timeline,'→')}</div>`;
  }catch(e){ document.getElementById('af-result').innerHTML=R.error(e.message); }
}

async function runConceptArchitect(){
  if(!Engine.checkLimit()){ document.getElementById('con-result').innerHTML=R.limitReached(); return; }
  const idea=document.getElementById('con-idea')?.value?.trim();
  if(!idea){ Toast.error('Idea/Product দিন'); return; }
  document.getElementById('con-result').innerHTML=R.skeleton(4);
  try{
    const data=await Engine.call(Prompts.concept_architect({idea,industry:document.getElementById('con-industry')?.value,budget:document.getElementById('con-budget')?.value,goal:document.getElementById('con-goal')?.value}));
    Store.incUsage(); Store.logEvent('concept_architect',{idea}); updateUsageDisplay();
    document.getElementById('con-result').innerHTML=`
      <div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(0,245,212,.06),rgba(124,58,237,.04))">
        <h3 style="color:#fff;margin-bottom:6px">${data.concept_title}</h3>
        <p style="font-size:.86rem;margin-bottom:12px">${data.executive_summary}</p>
        <div style="padding:12px;background:rgba(0,245,212,.08);border-radius:10px;font-size:.88rem"><strong style="color:var(--a1)">💎 Value Proposition:</strong> ${data.unique_value_proposition}</div>
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">🎯 Target Market</strong>
        <div style="margin-top:10px;display:grid;gap:6px;font-size:.85rem">
          <div><span style="color:var(--text2)">Primary:</span> <strong style="color:#fff">${data.target_market?.primary}</strong></div>
          <div><span style="color:var(--text2)">Secondary:</span> ${data.target_market?.secondary}</div>
        </div>
        ${R.tags(data.target_market?.psychographics||[],'tag-violet')}
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">💰 Revenue Model</strong>
        <div style="margin-top:8px;display:grid;gap:6px;font-size:.85rem">
          <div>${R.list(data.revenue_model?.streams||[],'💰')}</div>
          <div><span style="color:var(--text2)">Pricing:</span> ${data.revenue_model?.pricing_strategy}</div>
          <div><span style="color:var(--text2)">Projected Monthly:</span> <strong style="color:var(--a1)">${data.revenue_model?.projected_monthly}</strong></div>
        </div>
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">📅 4-Week Action Plan</strong>
        ${(data.action_items||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="tag tag-mint mb-1">Week ${w.week}</div>${R.list(w.tasks,'→')}</div>`).join('')}
      </div>
      <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🏆 Competitive Advantage</strong>${R.list(data.competitive_advantage,'✅')}</div>
      <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">📊 Success Metrics</strong>${R.list(data.success_metrics,'📊')}</div>`;
  }catch(e){ document.getElementById('con-result').innerHTML=R.error(e.message); }
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded',()=>{
  Toast.init();
  updateUsageDisplay();
  document.querySelector('.hamburger')?.addEventListener('click',()=>document.getElementById('mainNav')?.classList.toggle('open'));
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o)o.classList.add('hidden'); }));
  if(!Store.getApiKey()){
    setTimeout(()=>Toast.info('সিস্টেম সেটআপের জন্য admin-এর সাথে যোগাযোগ করুন'),2000);
  }
});
