/* =============================================
   EcomSpark — Core Engine v2.0
   ============================================= */

const CONFIG = {
  API_URL: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 4000,
  FREE_DAILY_LIMIT: 3,
  ADMIN_KEY: 'ecomspark_admin_2025',
  SK: 'es_data',
  AK: 'es_apikey',
};

/* ========== STORE ========== */
const Store = {
  get(k){ try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) },
  rm(k){ localStorage.removeItem(k) },

  D(){ return this.get(CONFIG.SK)||{} },
  SD(d){ this.set(CONFIG.SK,d) },

  getApiKey(){ return this.get(CONFIG.AK)||'' },
  setApiKey(k){ this.set(CONFIG.AK,k) },

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

  /* Help requests */
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

  /* Agency */
  getAgency(){ return this.D().agency||[] },
  addAgency(r){
    const d=this.D(); if(!d.agency)d.agency=[];
    r.id=Date.now(); r.date=new Date().toISOString(); r.status='new';
    d.agency.unshift(r); this.SD(d); return r;
  },

  /* Winning Products */
  getProducts(){ return this.D().products||[] },
  setProducts(products){ const d=this.D(); d.products=products; this.SD(d) },
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

  /* Banners */
  getBanners(){ return this.D().banners||getDefaultBanners() },
  setBanners(b){ const d=this.D(); d.banners=b; this.SD(d) },

  /* Pro Users */
  getProUsers(){ return this.D().proUsers||[] },

  /* Events */
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
    {id:1,title:'🚀 Find Winning Products Fast',subtitle:'AI-powered research to discover ecommerce gold before anyone else',bg:'linear-gradient(135deg,#0369a1,#7c3aed)',cta:'Start Research',link:'#tools',active:true},
    {id:2,title:'🎵 TikTok Viral Product Finder',subtitle:'Detect trending products on TikTok Shop before they blow up',bg:'linear-gradient(135deg,#be185d,#7c3aed)',cta:'Find Products',link:'#winning',active:true},
    {id:3,title:'📊 AI Market Reports',subtitle:'Generate investor-grade market research in seconds',bg:'linear-gradient(135deg,#0f766e,#0369a1)',cta:'Generate Report',link:'#tools',active:true},
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

/* ========== AI ENGINE ========== */
const AI = {
  async call(prompt, system=''){
    const k=Store.getApiKey();
    if(!k) throw new Error('API Key not set. Click ⚙️ in the header to add your Anthropic API Key.');
    const res=await fetch(CONFIG.API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:CONFIG.MODEL, max_tokens:CONFIG.MAX_TOKENS,
        system: system||'You are an expert ecommerce strategist. Always respond ONLY with valid JSON. No markdown, no backticks. Raw JSON only.',
        messages:[{role:'user',content:prompt}],
      }),
    });
    if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error?.message||`API Error ${res.status}`); }
    const data=await res.json();
    const raw=data.content.map(c=>c.text||'').join('');
    const clean=raw.replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
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

  seo_toolkit:(v)=>`Generate SEO strategy for this product.
Product: ${v.product}, Platform: ${v.platform||'Amazon'}, Competitors: ${v.competitors||''}
JSON: {"primary_keywords":["..."],"long_tail_keywords":["..."],"seo_score":75,"title_optimized":"...","meta_description":"...","url_slug":"...","keyword_difficulty":[{"keyword":"...","difficulty":"low","volume":"5000","opportunity_score":85}],"content_gaps":["..."]}`,

  competitor_analysis:(v)=>`Analyze competitors for this product.
Product: ${v.product}, Competitors: ${v.competitors||'unknown'}, Platform: ${v.platform||'Amazon'}
JSON: {"market_overview":"...","competitors":[{"name":"...","estimated_monthly_revenue":"...","price_range":"...","strengths":["..."],"weaknesses":["..."],"review_score":4.2,"market_share_estimate":"..."}],"market_gaps":["..."],"differentiation_opportunities":["..."],"entry_difficulty":"medium","win_strategy":["..."]}`,

  fake_review:(v)=>`Analyze these reviews for authenticity.
Product: ${v.product}, Reviews: ${v.reviews||''}, Platform: ${v.platform||'Amazon'}
JSON: {"authenticity_score":72,"verdict":"suspicious","red_flags":["..."],"green_flags":["..."],"patterns_detected":["..."],"genuine_percentage":"60%","recommendation":"caution","what_to_look_for":["..."]}`,

  market_report:(v)=>`Generate a complete market research report.
Product: ${v.product}, Market: ${v.market||'US'}, Budget: ${v.budget||'$1000-5000'}
JSON: {"report_title":"...","executive_summary":"...","market_size":"...","growth_rate":"...","opportunity_score":78,"demand_prediction":"increasing","target_demographics":[{"segment":"...","size":"...","pain_points":["..."]}],"market_trends":["..."],"financial_projections":{"month1":"$500-1500","month3":"$2000-5000","month6":"$5000-15000"},"risk_assessment":[{"risk":"...","probability":"medium","mitigation":"..."}],"action_plan":[{"week":1,"actions":["..."]}],"overall_recommendation":"..."}`,
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
  error(msg){ return `<div class="alert alert-error"><span>⚠️</span><div><strong>Error:</strong> ${msg}<br><small>Please try again.</small></div></div>`; },
  limitReached(){ return `<div class="alert alert-warning" style="flex-direction:column;gap:12px"><div>⚠️ <strong>Free limit reached (${CONFIG.FREE_DAILY_LIMIT}/day)</strong></div><div style="font-size:.85rem;color:var(--text2)">Upgrade to Pro for unlimited access.</div><button class="btn btn-primary btn-sm" onclick="showUpgradeModal()">🚀 Upgrade to Pro</button></div>`; },
  scoreBar(score,color='var(--blue)'){
    const p=Math.min(100,Math.max(0,score));
    const c=p>=75?'var(--green)':p>=50?'var(--gold)':'var(--red)';
    return `<div class="meter-row"><div class="progress-bar"><div class="progress-fill" style="width:${p}%;background:${color||c}"></div></div><span class="meter-val" style="color:${color||c}">${p}</span></div>`;
  },
  scoreCircle(s){ const c=s>=75?'var(--green)':s>=50?'var(--gold)':'var(--red)'; return `<div class="score-ring" style="background:rgba(0,0,0,.28);border:3px solid ${c};color:${c}">${s}</div>`; },
  tags(items,cls='tag-blue'){ return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${(items||[]).map(t=>`<span class="tag ${cls}">${t}</span>`).join('')}</div>`; },
  list(items,icon='→'){ return `<ul style="list-style:none;padding:0">${(items||[]).map(i=>`<li style="padding:5px 0;font-size:.86rem;color:var(--text2);display:flex;gap:8px"><span style="color:var(--green);flex-shrink:0">${icon}</span>${i}</li>`).join('')}</ul>`; },
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
function showApiModal(){
  document.getElementById('apiKeyInput').value=Store.getApiKey()||'';
  Modal.show('apiModal');
}
function saveApiKey(){
  const k=document.getElementById('apiKeyInput')?.value?.trim();
  if(!k||!k.startsWith('sk-ant-')){ Toast.error('Enter valid API Key (starts with sk-ant-)'); return; }
  Store.setApiKey(k); Modal.hideAll(); Toast.success('API Key saved! ✅'); updateUsageDisplay();
}
function updateUsageDisplay(){
  const r=AI.remaining(), isPro=Store.isPro();
  document.querySelectorAll('.usage-display').forEach(el=>{
    el.textContent=isPro?'∞ Pro':`${r}/${CONFIG.FREE_DAILY_LIMIT}`;
    el.style.color=isPro?'#4ade80':r>0?'#fbbf24':'#fb7185';
  });
}
function switchTab(prefix,tab,btn){
  document.querySelectorAll(`[id^="${prefix}-tab-"]`).forEach(el=>el.classList.add('hidden'));
  document.getElementById(`${prefix}-tab-${tab}`)?.classList.remove('hidden');
  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

/* ========== SUPPORT CHAT ========== */
function toggleSupport(){
  const p=document.getElementById('supportPanel');
  if(p) p.classList.toggle('open');
}
function submitSupportMsg(){
  const name=document.getElementById('supp-name')?.value?.trim();
  const email=document.getElementById('supp-email')?.value?.trim();
  const msg=document.getElementById('supp-msg')?.value?.trim();
  if(!name||!email||!msg){ Toast.error('Please fill all fields'); return; }
  Store.addHelp({name,email,message:msg,category:'Support Chat'});
  Store.logEvent('support_chat',{name,email});
  document.getElementById('supp-name').value='';
  document.getElementById('supp-email').value='';
  document.getElementById('supp-msg').value='';
  const body=document.getElementById('supportBody');
  if(body) body.innerHTML=`<div class="alert alert-success"><span>✅</span><div><strong>Message sent!</strong><br>We'll respond within a few hours.</div></div>`;
  setTimeout(()=>{ if(body) body.innerHTML=supportBodyHTML(); },4000);
}
function supportBodyHTML(){
  return `<div class="form-group"><label class="form-label">Your Name</label><input class="form-control" id="supp-name" placeholder="John Doe"></div>
<div class="form-group"><label class="form-label">Email</label><input class="form-control" id="supp-email" type="email" placeholder="you@example.com"></div>
<div class="form-group"><label class="form-label">Message</label><textarea class="form-control" id="supp-msg" rows="3" placeholder="How can we help?"></textarea></div>
<button class="btn btn-primary btn-full btn-sm" onclick="submitSupportMsg()">📤 Send Message</button>`;
}

/* ========== BANNER SLIDER ========== */
let bannerIdx=0, bannerInterval=null;
function initBanners(){
  const banners=Store.getBanners().filter(b=>b.active);
  const container=document.getElementById('bannerSlider');
  if(!container||!banners.length)return;
  container.innerHTML=banners.map((b,i)=>`
    <div class="banner-slide ${i===0?'active':''}" id="bs-${i}" style="background:${b.bg}">
      <div class="banner-slide-content">
        <h2>${b.title}</h2>
        <p>${b.subtitle}</p>
        <a href="${b.link||'#'}" class="btn btn-primary">${b.cta||'Learn More'}</a>
      </div>
    </div>`).join('')+
    `<button class="banner-prev" onclick="slideBanner(-1)">‹</button>
     <button class="banner-next" onclick="slideBanner(1)">›</button>
     <div class="banner-nav">${banners.map((_,i)=>`<div class="banner-dot ${i===0?'active':''}" onclick="goBanner(${i})"></div>`).join('')}</div>`;
  bannerInterval=setInterval(()=>slideBanner(1),5500);
}
function slideBanner(dir){
  const banners=Store.getBanners().filter(b=>b.active);
  const slides=document.querySelectorAll('.banner-slide');
  const dots=document.querySelectorAll('.banner-dot');
  if(!slides.length)return;
  slides[bannerIdx].classList.remove('active');
  dots[bannerIdx]?.classList.remove('active');
  bannerIdx=(bannerIdx+dir+slides.length)%slides.length;
  slides[bannerIdx].classList.add('active');
  dots[bannerIdx]?.classList.add('active');
}
function goBanner(i){
  const slides=document.querySelectorAll('.banner-slide');
  const dots=document.querySelectorAll('.banner-dot');
  slides[bannerIdx]?.classList.remove('active'); dots[bannerIdx]?.classList.remove('active');
  bannerIdx=i;
  slides[bannerIdx]?.classList.add('active'); dots[bannerIdx]?.classList.add('active');
}

/* ========== WINNING PRODUCTS (Main Page) ========== */
function renderWinningProducts(){
  const container=document.getElementById('winningProductsGrid');
  if(!container)return;
  const products=Store.getProducts();
  if(!products.length){
    container.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text2)"><div style="font-size:3rem;margin-bottom:14px">📦</div><p>No products yet. Admin will add winning products soon!</p></div>`;
    return;
  }
  const isPro=Store.isPro();
  container.innerHTML=products.map((p,i)=>{
    const locked=!isPro&&i<10&&p.premium;
    const scoreColor=p.score>=80?'var(--green)':p.score>=60?'var(--gold)':'var(--red)';
    return `<div class="card product-card ${locked?'product-locked':''}" onclick="${locked?'showUpgradeModal()':'openProductDetail('+p.id+')'}" style="cursor:pointer">
      ${p.image?`<img class="product-card-img" src="${p.image}" alt="${p.name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`:''}
      <div class="product-card-img-placeholder" style="${p.image?'display:none':'display:flex'}">🏆</div>
      <div class="product-card-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
          <div class="product-card-title">${p.name}</div>
          ${p.score?`<div style="width:38px;height:38px;border-radius:50%;border:2px solid ${scoreColor};color:${scoreColor};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.88rem;flex-shrink:0">${p.score}</div>`:''}
        </div>
        <p class="product-card-desc">${p.shortDesc||''}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${p.category?`<span class="tag tag-blue">${p.category}</span>`:''}
          ${p.premium?`<span class="tag tag-gold">⭐ Premium</span>`:''}
          ${p.score>=80?'<span class="tag tag-green">🏆 Winner</span>':''}
        </div>
        <div class="product-card-footer">
          <span style="font-size:.8rem;color:var(--text2)">${p.price||''}</span>
          <button class="btn btn-sm btn-primary">${locked?'🔒 Premium':'View Details →'}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openProductDetail(id){
  const p=Store.getProducts().find(x=>x.id===id);
  if(!p)return;
  const modal=document.getElementById('productDetailModal');
  const content=document.getElementById('productDetailContent');
  if(!modal||!content)return;
  document.getElementById('productDetailTitle').textContent=p.name;

  let adsHTML='<p style="color:var(--text2);font-size:.88rem">No ad details provided.</p>';
  if(p.facebookAd||p.tiktokAd||p.adBudget){
    adsHTML=`<div class="tabs" style="margin-top:0">
      ${p.facebookAd?`<button class="tab-btn active" onclick="switchTab('pd','fb',this)">📘 Facebook</button>`:''}
      ${p.tiktokAd?`<button class="tab-btn ${!p.facebookAd?'active':''}" onclick="switchTab('pd','tt',this)">🎵 TikTok</button>`:''}
      ${p.adBudget?`<button class="tab-btn" onclick="switchTab('pd','budget',this)">💰 Budget</button>`:''}
    </div>
    ${p.facebookAd?`<div id="pd-tab-fb">${R.copyBox(p.facebookAd,'📋 Copy')}</div>`:''}
    ${p.tiktokAd?`<div id="pd-tab-tt" class="${p.facebookAd?'hidden':''}">${R.copyBox(p.tiktokAd,'📋 Copy')}</div>`:''}
    ${p.adBudget?`<div id="pd-tab-budget" class="hidden"><div class="alert alert-info">💰 ${p.adBudget}</div></div>`:''}`;
  }

  content.innerHTML=`
    <div style="display:grid;gap:18px">
      ${p.image?`<img src="${p.image}" style="width:100%;max-height:260px;object-fit:cover;border-radius:var(--radius-sm)" onerror="this.style.display='none'">`:''}
      <div>
        ${p.score?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">${R.scoreCircle(p.score)}<div><strong style="color:#fff">Product Score</strong><div class="tag tag-${p.score>=80?'green':p.score>=60?'gold':'red'}" style="margin-top:4px">${p.score>=80?'🏆 Winning Product':p.score>=60?'⚡ Potential':'📊 Research More'}</div></div></div>`:''}
        ${p.category?`<span class="tag tag-blue" style="margin-right:6px">${p.category}</span>`:''}
        ${p.price?`<span class="tag tag-gold">${p.price}</span>`:''}
      </div>
      ${p.description?`<div><strong style="font-size:.85rem;color:var(--text2)">📝 Description</strong><p style="font-size:.88rem;margin-top:8px;line-height:1.65">${p.description}</p></div>`:''}
      ${p.whereToFind?`<div><strong style="font-size:.85rem;color:var(--text2)">🏪 Where to Find</strong><div class="alert alert-info" style="margin-top:8px;font-weight:600">${p.whereToFind}</div></div>`:''}
      ${(p.sellingPoints&&p.sellingPoints.length)?`<div><strong style="font-size:.85rem;color:var(--text2)">⭐ Key Selling Points</strong>${R.list(p.sellingPoints,'⭐')}</div>`:''}
      <div>
        <strong style="font-size:.85rem;color:var(--text2)">📣 Ad Strategy</strong>
        <div style="margin-top:12px">${adsHTML}</div>
      </div>
      ${p.caption?`<div><strong style="font-size:.85rem;color:var(--text2)">💬 Caption</strong>${R.copyBox(p.caption,'Copy')}</div>`:''}
      ${p.hashtags?`<div><strong style="font-size:.85rem;color:var(--text2)">🏷️ Hashtags</strong>${R.copyBox(p.hashtags,'Copy')}</div>`:''}
      ${p.notes?`<div><strong style="font-size:.85rem;color:var(--text2)">📌 Additional Notes</strong><p style="font-size:.88rem;margin-top:8px;color:var(--text2)">${p.notes}</p></div>`:''}
    </div>`;
  Modal.show('productDetailModal');
}

/* ========== TOOL RUNNERS ========== */
async function runProductResearch(){
  if(!AI.checkLimit()){ document.getElementById('pr-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('pr-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product name'); return; }
  document.getElementById('pr-result').innerHTML=R.skeleton(2);
  try{
    const data=await AI.call(Prompts.product_research({product,category:document.getElementById('pr-category')?.value,market:document.getElementById('pr-market')?.value}));
    Store.incUsage(); Store.logEvent('product_research',{product}); updateUsageDisplay();
    const vTag=data.verdict==='winner'?'tag-green':data.verdict==='potential'?'tag-gold':'tag-red';
    document.getElementById('pr-result').innerHTML=`
      <div class="result-card fade-up">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          ${R.scoreCircle(data.overall_score)}
          <div><h3 style="color:#fff">${data.product_name}</h3><span class="tag ${vTag}" style="margin-top:4px">● ${(data.verdict||'').toUpperCase()}</span></div>
          <div style="margin-left:auto;text-align:right;font-size:.82rem;color:var(--text2)">Trend: <strong style="color:${data.trend_direction==='rising'?'var(--green)':'var(--gold)'}">${data.trend_direction}</strong></div>
        </div>
        <p style="font-size:.87rem;margin-bottom:14px">${data.summary}</p>
        <div class="water-line"></div>
        <div style="margin:12px 0">
          <div class="meter-row"><span class="meter-label">📈 Demand</span>${R.scoreBar(data.demand_score,'var(--blue)')}</div>
          <div class="meter-row"><span class="meter-label">⚔️ Competition</span>${R.scoreBar(data.competition_score,'var(--gold)')}</div>
          <div class="meter-row"><span class="meter-label">🌊 Saturation</span>${R.scoreBar(data.saturation_score,'var(--red)')}</div>
        </div>
        <div class="water-line"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0">
          <div><div style="font-size:.77rem;color:var(--text2);margin-bottom:4px">💰 Est. Margin</div><strong style="color:var(--green)">${data.profit_margin_estimate}</strong></div>
          <div><div style="font-size:.77rem;color:var(--text2);margin-bottom:4px">🏷️ Price Range</div><strong style="color:#fff">${data.suggested_price_range}</strong></div>
        </div>
        <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">🎯 Target Audience</strong>${R.tags(data.target_audience,'tag-blue')}</div>
        <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⭐ Selling Points</strong>${R.list(data.key_selling_points,'⭐')}</div>
        <div class="mb-2"><strong style="font-size:.83rem;color:var(--text2)">⚠️ Risks</strong>${R.list(data.risk_factors,'⚠️')}</div>
        <div><strong style="font-size:.83rem;color:var(--text2)">✅ Recommendations</strong>${R.list(data.recommendations,'→')}</div>
      </div>`;
  }catch(e){ document.getElementById('pr-result').innerHTML=R.error(e.message); }
}

async function runTikTokFinder(){
  if(!AI.checkLimit()){ document.getElementById('tt-result').innerHTML=R.limitReached(); return; }
  const niche=document.getElementById('tt-niche')?.value?.trim();
  if(!niche){ Toast.error('Enter a niche'); return; }
  document.getElementById('tt-result').innerHTML=R.skeleton(3);
  try{
    const data=await AI.call(Prompts.tiktok_viral({niche,budget:document.getElementById('tt-budget')?.value,market:document.getElementById('tt-market')?.value}));
    Store.incUsage(); Store.logEvent('tiktok',{niche}); updateUsageDisplay();
    document.getElementById('tt-result').innerHTML=`
      <div class="result-card fade-up mb-2"><strong style="font-size:.83rem;color:var(--text2)">🔥 Trending Categories</strong>${R.tags(data.trending_categories,'tag-red')}</div>
      ${(data.products||[]).map((p,i)=>`
      <div class="result-card fade-up">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:.88rem;flex-shrink:0">${i+1}</div>
          <div style="flex:1"><strong style="color:#fff">${p.product}</strong></div>
          <div style="text-align:right"><div style="font-family:var(--font-h);font-size:1.3rem;font-weight:800;color:${p.viral_score>=80?'var(--green)':'var(--gold)'}">${p.viral_score}</div><div style="font-size:.7rem;color:var(--text2)">Viral</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="text-align:center"><div style="font-size:.72rem;color:var(--text2)">Searches/mo</div><strong style="color:#fff">${(p.estimated_monthly_searches||0).toLocaleString()}</strong></div>
          <div style="text-align:center"><div style="font-size:.72rem;color:var(--text2)">Profit Potential</div><strong style="color:var(--green)">${p.profit_potential}</strong></div>
        </div>
        <p style="font-size:.84rem;color:var(--text2);margin-bottom:10px">💡 ${p.why_viral}</p>
        <div class="mb-1"><strong style="font-size:.81rem;color:var(--text2)">🎣 Hooks</strong>${R.list(p.hooks,'🎣')}</div>
        ${R.tags(p.trending_hashtags,'tag-red')}
      </div>`).join('')}
      <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">📋 Action Plan</strong>${R.list(data.action_plan,'→')}</div>`;
  }catch(e){ document.getElementById('tt-result').innerHTML=R.error(e.message); }
}

async function runAdCreative(){
  if(!AI.checkLimit()){ document.getElementById('ac-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('ac-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product name'); return; }
  document.getElementById('ac-result').innerHTML=R.skeleton(3);
  try{
    const data=await AI.call(Prompts.ad_creative({product,platform:document.getElementById('ac-platform')?.value,audience:document.getElementById('ac-audience')?.value,usp:document.getElementById('ac-usp')?.value}));
    Store.incUsage(); Store.logEvent('ad_creative',{product}); updateUsageDisplay();
    const eTag=e=>e==='fear'?'tag-red':e==='greed'?'tag-gold':e==='curiosity'?'tag-blue':'tag-green';
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
        <div class="result-card fade-up">
          <strong style="font-size:.85rem;color:var(--text2)">🎣 Power Hooks</strong>
          <div style="margin-top:10px">${(data.ad_hooks||[]).map((h,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="width:22px;height:22px;border-radius:50%;background:rgba(56,189,248,.1);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:var(--blue);flex-shrink:0">${i+1}</span>
            <span style="flex:1;font-size:.86rem">${h}</span>
            <button class="copy-btn" style="position:static" onclick="copyText('${h.replace(/'/g,"\\'")}',this)">Copy</button>
          </div>`).join('')}</div>
        </div>
      </div>`;
  }catch(e){ document.getElementById('ac-result').innerHTML=R.error(e.message); }
}

async function runAdScript(){
  if(!AI.checkLimit()){ document.getElementById('as-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('as-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product name'); return; }
  document.getElementById('as-result').innerHTML=R.skeleton(2);
  try{
    const data=await AI.call(Prompts.ad_script({product,platform:document.getElementById('as-platform')?.value,duration:document.getElementById('as-duration')?.value,style:document.getElementById('as-style')?.value}));
    Store.incUsage(); Store.logEvent('ad_script',{product}); updateUsageDisplay();
    const s=data.script||{};
    document.getElementById('as-result').innerHTML=`
      <div class="result-card fade-up">
        <div style="display:flex;gap:10px;margin-bottom:14px"><span class="tag tag-cyan">${document.getElementById('as-platform')?.value}</span><span class="tag tag-blue">${document.getElementById('as-duration')?.value}</span><span class="tag tag-purple">Est. CTR: ${data.estimated_ctr}</span></div>
        <div style="display:grid;gap:10px">
          <div><div class="tag tag-red mb-1">🎣 HOOK</div>${R.copyBox(s.hook,'Copy')}</div>
          <div><div class="tag tag-gold mb-1">❓ PROBLEM</div><p style="font-size:.86rem">${s.problem}</p></div>
          <div><div class="tag tag-green mb-1">✅ SOLUTION</div><p style="font-size:.86rem">${s.solution}</p></div>
          <div><div class="tag tag-blue mb-1">⭐ PROOF</div><p style="font-size:.86rem">${s.proof}</p></div>
          <div><div class="tag tag-purple mb-1">🎁 OFFER</div><p style="font-size:.86rem">${s.offer}</p></div>
          <div><div class="tag tag-cyan mb-1">📣 CTA</div>${R.copyBox(s.cta,'Copy')}</div>
        </div>
        <div class="water-line"></div>
        <div><strong style="font-size:.84rem;color:var(--text2)">📝 FULL SCRIPT</strong><div style="margin-top:8px">${R.copyBox(s.full_script,'📋 Copy Full')}</div></div>
        <div class="water-line"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><strong style="font-size:.82rem;color:var(--text2)">🎬 B-Roll Shots</strong>${R.list(data.b_roll_shots,'📷')}</div>
          <div><strong style="font-size:.82rem;color:var(--text2)">🎵 Music</strong>${R.list(data.music_suggestions,'🎵')}</div>
        </div>
        <p style="font-size:.84rem;color:var(--text2);margin-top:10px">💡 ${data.voiceover_tips}</p>
      </div>`;
  }catch(e){ document.getElementById('as-result').innerHTML=R.error(e.message); }
}

async function runProductDesc(){
  if(!AI.checkLimit()){ document.getElementById('pd-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('pd-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product name'); return; }
  document.getElementById('pd-result').innerHTML=R.skeleton(2);
  try{
    const data=await AI.call(Prompts.product_description({product,features:document.getElementById('pd-features')?.value,buyer:document.getElementById('pd-buyer')?.value,tone:document.getElementById('pd-tone')?.value}));
    Store.incUsage(); Store.logEvent('product_desc',{product}); updateUsageDisplay();
    document.getElementById('pd-result').innerHTML=`
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('pdt','main',this)">📝 Main</button>
        <button class="tab-btn" onclick="switchTab('pdt','seo',this)">🔍 SEO</button>
        <button class="tab-btn" onclick="switchTab('pdt','emo',this)">❤️ Emotional</button>
      </div>
      <div id="pdt-tab-main">
        <div class="result-card fade-up mb-2"><div class="tag tag-blue mb-2">Title</div>${R.copyBox(data.title,'Copy')}</div>
        <div class="result-card fade-up mb-2"><div class="tag tag-purple mb-2">Tagline</div>${R.copyBox(data.tagline,'Copy')}</div>
        <div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">Short Description</div>${R.copyBox(data.short_description,'Copy')}</div>
        <div class="result-card fade-up mb-2">
          <div class="tag tag-cyan mb-2">✅ Bullet Points</div>
          ${(data.bullet_points||[]).map(b=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.86rem;display:flex;gap:8px"><span style="color:var(--green)">●</span>${b}</div>`).join('')}
          <button class="copy-btn" style="position:static;margin-top:8px" onclick="copyText('${(data.bullet_points||[]).join('\\n').replace(/'/g,"\\'")}',this)">📋 Copy All</button>
        </div>
        <div class="result-card fade-up"><div class="tag tag-blue mb-2">Full Description</div>${R.copyBox(data.long_description,'📋 Copy')}</div>
      </div>
      <div id="pdt-tab-seo" class="hidden">
        <div class="result-card fade-up mb-2"><div class="tag tag-green mb-2">SEO Description</div>${R.copyBox(data.seo_description,'Copy')}</div>
        <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">🎯 Keywords</strong>${R.tags(data.keywords,'tag-blue')}</div>
      </div>
      <div id="pdt-tab-emo" class="hidden">
        <div class="result-card fade-up mb-2"><div class="tag tag-red mb-2">❤️ Emotional Copy</div>${R.copyBox(data.emotional_copy,'Copy')}</div>
        <div class="result-card fade-up"><strong style="font-size:.83rem;color:var(--text2)">❓ FAQs</strong>${(data.faqs||[]).map(f=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-weight:800;color:#fff;font-size:.86rem;margin-bottom:4px">Q: ${f.q}</div><div style="font-size:.84rem;color:var(--text2)">A: ${f.a}</div></div>`).join('')}</div>
      </div>`;
  }catch(e){ document.getElementById('pd-result').innerHTML=R.error(e.message); }
}

async function runSupplier(){
  if(!AI.checkLimit()){ document.getElementById('sf-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('sf-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product'); return; }
  document.getElementById('sf-result').innerHTML=R.skeleton(2);
  try{
    const data=await AI.call(Prompts.supplier_finder({product,budget:document.getElementById('sf-budget')?.value,quality:document.getElementById('sf-quality')?.value}));
    Store.incUsage(); Store.logEvent('supplier',{product}); updateUsageDisplay();
    document.getElementById('sf-result').innerHTML=`
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('sf','plat',this)">🏭 Platforms</button>
        <button class="tab-btn" onclick="switchTab('sf','check',this)">✅ Checklist</button>
        <button class="tab-btn" onclick="switchTab('sf','email',this)">📧 Outreach</button>
      </div>
      <div id="sf-tab-plat">
        ${(data.platforms||[]).map(p=>`<div class="result-card fade-up mb-2">
          <div class="tag tag-blue mb-2">🏭 ${p.name}</div>
          <strong style="font-size:.82rem;color:var(--text2)">Search Terms:</strong>${R.tags(p.search_terms,'tag-cyan')}
          <p style="font-size:.84rem;margin-top:8px">💡 ${p.tips}</p>
        </div>`).join('')}
        <div class="result-card fade-up" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><div style="font-size:.77rem;color:var(--text2)">📦 Est. COGS</div><strong style="color:var(--green)">${data.estimated_cogs}</strong></div>
          <div><div style="font-size:.77rem;color:var(--text2)">💹 Margin</div><strong style="color:var(--blue)">${data.recommended_margin}</strong></div>
        </div>
      </div>
      <div id="sf-tab-check" class="hidden">
        <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">✅ Verification Checklist</strong>${R.list(data.verification_checklist,'✅')}</div>
        <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--red)">🚩 Red Flags</strong>${R.list(data.red_flags,'🚩')}</div>
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

async function runSEO(){
  if(!AI.checkLimit()){ document.getElementById('seo-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('seo-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product/keyword'); return; }
  document.getElementById('seo-result').innerHTML=R.skeleton(2);
  try{
    const data=await AI.call(Prompts.seo_toolkit({product,platform:document.getElementById('seo-platform')?.value,competitors:document.getElementById('seo-competitors')?.value}));
    Store.incUsage(); Store.logEvent('seo',{product}); updateUsageDisplay();
    document.getElementById('seo-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${R.scoreCircle(data.seo_score)}<div><strong style="color:#fff">SEO Score</strong></div></div>
        <div class="mb-2"><div class="tag tag-green mb-1">📌 Optimized Title</div>${R.copyBox(data.title_optimized,'Copy')}</div>
        <div class="mb-2"><div class="tag tag-blue mb-1">📝 Meta Description</div>${R.copyBox(data.meta_description,'Copy')}</div>
        <div><div class="tag tag-cyan mb-1">🔗 URL Slug</div>${R.copyBox(data.url_slug,'Copy')}</div>
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">🎯 Primary Keywords</strong>${R.tags(data.primary_keywords,'tag-blue')}
        <div style="margin-top:12px"><strong style="font-size:.84rem;color:var(--text2)">🔎 Long-Tail Keywords</strong>${R.tags(data.long_tail_keywords,'tag-cyan')}</div>
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">📊 Keyword Analysis</strong>
        ${(data.keyword_difficulty||[]).map(k=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:.85rem">${k.keyword}</span>
          <span class="tag ${k.difficulty==='low'?'tag-green':k.difficulty==='medium'?'tag-gold':'tag-red'}">${k.difficulty}</span>
          <span style="font-size:.79rem;color:var(--text2)">Vol: ${k.volume}</span>
          <span style="font-size:.79rem;font-weight:800;color:var(--blue)">${k.opportunity_score}</span>
        </div>`).join('')}
      </div>
      <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">🚀 Content Gaps</strong>${R.list(data.content_gaps,'📍')}</div>`;
  }catch(e){ document.getElementById('seo-result').innerHTML=R.error(e.message); }
}

async function runCompetitor(){
  if(!AI.checkLimit()){ document.getElementById('ca-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('ca-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product/niche'); return; }
  document.getElementById('ca-result').innerHTML=R.skeleton(3);
  try{
    const data=await AI.call(Prompts.competitor_analysis({product,competitors:document.getElementById('ca-competitors')?.value,platform:document.getElementById('ca-platform')?.value}));
    Store.incUsage(); Store.logEvent('competitor',{product}); updateUsageDisplay();
    document.getElementById('ca-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
          <div style="text-align:center"><div style="font-size:.73rem;color:var(--text2)">Market Size</div><strong style="color:#fff;font-size:.92rem">${data.estimated_market_size||'N/A'}</strong></div>
          <div style="text-align:center"><div style="font-size:.73rem;color:var(--text2)">Entry</div><strong class="tag ${data.entry_difficulty==='low'?'tag-green':data.entry_difficulty==='medium'?'tag-gold':'tag-red'}">${data.entry_difficulty}</strong></div>
          <div style="text-align:center"><div style="font-size:.73rem;color:var(--text2)">Platform</div><strong style="color:var(--blue);font-size:.84rem">${document.getElementById('ca-platform')?.value}</strong></div>
        </div>
        <p style="font-size:.86rem">${data.market_overview}</p>
      </div>
      ${(data.competitors||[]).map(c=>`<div class="result-card fade-up mb-2">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <strong style="color:#fff">🏢 ${c.name}</strong>
          <div style="text-align:right"><div style="font-size:.73rem;color:var(--text2)">Est. Revenue</div><strong style="color:var(--green)">${c.estimated_monthly_revenue}/mo</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div><div style="font-size:.73rem;color:var(--text2)">Price Range</div><strong style="color:#fff">${c.price_range}</strong></div>
          <div><div style="font-size:.73rem;color:var(--text2)">Rating</div><strong style="color:var(--gold)">⭐ ${c.review_score} (${c.review_count||'N/A'})</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><div style="font-size:.77rem;color:var(--green);margin-bottom:4px">✅ Strengths</div>${R.list(c.strengths,'✅')}</div>
          <div><div style="font-size:.77rem;color:var(--red);margin-bottom:4px">❌ Weaknesses</div>${R.list(c.weaknesses,'❌')}</div>
        </div>
      </div>`).join('')}
      <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🔓 Market Gaps</strong>${R.list(data.market_gaps,'💡')}</div>
      <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">🏆 Win Strategy</strong>${R.list(data.win_strategy,'→')}</div>`;
  }catch(e){ document.getElementById('ca-result').innerHTML=R.error(e.message); }
}

async function runFakeReview(){
  if(!AI.checkLimit()){ document.getElementById('fr-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('fr-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product name'); return; }
  document.getElementById('fr-result').innerHTML=R.skeleton(2);
  try{
    const data=await AI.call(Prompts.fake_review({product,reviews:document.getElementById('fr-reviews')?.value,platform:document.getElementById('fr-platform')?.value}));
    Store.incUsage(); Store.logEvent('fake_review',{product}); updateUsageDisplay();
    const sc=data.authenticity_score;
    const vTag=data.verdict==='mostly_genuine'||sc>=70?'tag-green':sc>=40?'tag-gold':'tag-red';
    document.getElementById('fr-result').innerHTML=`
      <div class="result-card fade-up mb-2">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          ${R.scoreCircle(sc)}
          <div><strong style="color:#fff;font-size:1rem">Authenticity Score</strong><span class="tag ${vTag}" style="display:block;margin-top:4px">${(data.verdict||'').replace(/_/g,' ').toUpperCase()}</span></div>
          <div style="margin-left:auto;text-align:right"><div style="font-size:.77rem;color:var(--text2)">Genuine</div><strong style="color:${sc>=70?'var(--green)':'var(--red)'}">${data.genuine_percentage}</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><strong style="font-size:.81rem;color:var(--red)">🚩 Red Flags</strong>${R.list(data.red_flags,'🚩')}</div>
          <div><strong style="font-size:.81rem;color:var(--green)">✅ Green Flags</strong>${R.list(data.green_flags,'✅')}</div>
        </div>
      </div>
      <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">🔍 Patterns</strong>${R.list(data.patterns_detected,'🔍')}</div>
      <div class="result-card fade-up"><strong style="font-size:.84rem;color:var(--text2)">💡 What to Look For</strong>${R.list(data.what_to_look_for,'📌')}</div>`;
  }catch(e){ document.getElementById('fr-result').innerHTML=R.error(e.message); }
}

async function runMarketReport(){
  if(!AI.checkLimit()){ document.getElementById('mr-result').innerHTML=R.limitReached(); return; }
  const product=document.getElementById('mr-product')?.value?.trim();
  if(!product){ Toast.error('Enter a product/niche'); return; }
  document.getElementById('mr-result').innerHTML=R.skeleton(4);
  try{
    const data=await AI.call(Prompts.market_report({product,market:document.getElementById('mr-market')?.value,budget:document.getElementById('mr-budget')?.value}));
    Store.incUsage(); Store.logEvent('market_report',{product}); updateUsageDisplay();
    document.getElementById('mr-result').innerHTML=`
      <div class="result-card fade-up mb-2" style="background:linear-gradient(135deg,rgba(56,189,248,.08),rgba(167,139,250,.05))">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          ${R.scoreCircle(data.opportunity_score)}
          <div><h3 style="color:#fff;font-size:.97rem">${data.report_title}</h3><div style="display:flex;gap:6px;margin-top:5px"><span class="tag tag-blue">${data.market_size}</span><span class="tag ${data.demand_prediction==='increasing'?'tag-green':'tag-gold'}">${data.demand_prediction}</span></div></div>
        </div>
        <p style="font-size:.86rem">${data.executive_summary}</p>
      </div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">📈 Revenue Projections</strong>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px">
          ${[['Month 1',data.financial_projections?.month1,'var(--blue)'],['Month 3',data.financial_projections?.month3,'var(--cyan)'],['Month 6',data.financial_projections?.month6,'var(--green)']].map(([l,v,c])=>`<div style="text-align:center;padding:12px;background:rgba(0,0,0,.2);border-radius:10px"><div style="font-size:.71rem;color:var(--text2)">${l}</div><strong style="color:${c};font-size:.88rem">${v}</strong></div>`).join('')}
        </div>
      </div>
      <div class="result-card fade-up mb-2"><strong style="font-size:.84rem;color:var(--text2)">📊 Market Trends</strong>${R.list(data.market_trends,'📊')}</div>
      <div class="result-card fade-up mb-2">
        <strong style="font-size:.84rem;color:var(--text2)">⚠️ Risk Assessment</strong>
        ${(data.risk_assessment||[]).map(r=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><strong style="color:#fff">${r.risk}</strong><span class="tag ${r.probability==='low'?'tag-green':r.probability==='medium'?'tag-gold':'tag-red'}">${r.probability}</span></div><p style="font-size:.82rem">🛡️ ${r.mitigation}</p></div>`).join('')}
      </div>
      <div class="result-card fade-up">
        <strong style="font-size:.84rem;color:var(--text2)">📅 Action Plan</strong>
        ${(data.action_plan||[]).map(w=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="tag tag-blue mb-1">Week ${w.week}</div>${R.list(w.actions,'→')}</div>`).join('')}
        <div style="margin-top:14px;padding:14px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:10px;font-size:.86rem"><strong style="color:var(--green)">Final Recommendation:</strong> ${data.overall_recommendation}</div>
      </div>`;
  }catch(e){ document.getElementById('mr-result').innerHTML=R.error(e.message); }
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded',()=>{
  Toast.init();
  updateUsageDisplay();
  document.querySelector('.hamburger')?.addEventListener('click',()=>document.getElementById('mainNav')?.classList.toggle('open'));
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o)o.classList.add('hidden'); }));
  if(!Store.getApiKey()){
    setTimeout(()=>Toast.warning('Add Anthropic API Key (⚙️ in header) to use AI features'),2000);
  }
});
