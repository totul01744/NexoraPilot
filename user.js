/* ════════════════════════════════════════
   NEXORAPILOT — USER PANEL JS
   GitHub → Netlify ready
   localStorage key prefix: tv_
════════════════════════════════════════ */

/* ── STORAGE ── */
const LS = {
  get: k  => { try { return JSON.parse(localStorage.getItem('tv_'+k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem('tv_'+k, JSON.stringify(v))
};

/* ── STATE ── */
let curCat   = 'all';
let curProd  = null;
let banIdx   = 0;
let banTimer = null;

const CATS = [
  {k:'all',       l:'🌐 সব'},
  {k:'electronics',l:'📱 Electronics'},
  {k:'beauty',    l:'💄 Beauty'},
  {k:'health',    l:'💪 Health'},
  {k:'pet',       l:'🐾 Pet'},
  {k:'home',      l:'🏠 Home'},
  {k:'fashion',   l:'👗 Fashion'},
  {k:'mens',      l:'👔 ছেলেদের পোশাক'},
  {k:'womens',    l:'👘 মেয়েদের পোশাক'},
  {k:'baby',      l:'👶 Baby'},
  {k:'outdoor',   l:'🏕️ Outdoor'}
];

const PTITLES = {
  home:'🏠 NexoraPilot', winning:'🏆 Winning Products',
  tiktok:'🎵 TikTok Finder', competitor:'🎯 Competitor Analysis',
  reviews:'🔎 Fake Review Detector', adgen:'⚡ Ad Script Generator',
  descgen:'✍️ Product Description', supplier:'🏭 Supplier Finder',
  market:'📋 Market Reports', profile:'👤 My Profile', support:'💬 Support Chat'
};

const BM = {HOT:'b-hot',VIRAL:'b-viral',NEW:'b-new',RISING:'b-rising',TikTok:'b-tiktok'};
const sc  = v => v>=85?'var(--green)':v>=65?'var(--gold)':'var(--pink)';
const bh  = b => `<span class="bdg ${BM[b]||'b-new'}">${b}</span>`;

function isPro() {
  const prof = LS.get('userProfile')||{};
  const subs = LS.get('subs')||[];
  const ph   = prof.phone||'';
  return ph ? !!subs.find(s=>s.phone===ph && s.status==='active') : false;
}
function noteHtml(p) {
  const n = (LS.get('notes')||{})[p.key] || p.note || '';
  if (!n) return '';
  return `<div class="cnote"><span style="font-size:10px;flex-shrink:0;margin-top:1px">📌</span>
    <div><div class="cn-l">Admin Note</div><div class="cn-t">${n}</div></div></div>`;
}
function imgH(p, h=148) {
  if (p.img) return `<img src="${p.img}" alt="${p.name}" style="width:100%;height:${h}px;object-fit:cover" loading="lazy"
    onerror="this.parentElement.innerHTML='<div class=pim-ph style=height:${h}px>🖼️</div>'">`;
  return `<div class="pim-ph" style="height:${h}px">🖼️</div>`;
}

/* ════════════════════
   PARTICLES
════════════════════ */
function initPts() {
  const c = document.getElementById('pts'); if(!c) return;
  for (let i=0;i<20;i++) {
    const p=document.createElement('div'); p.className='pt';
    const s=Math.random()*3+1;
    p.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;
      animation-duration:${Math.random()*15+10}s;animation-delay:-${Math.random()*15}s;
      opacity:${Math.random()*.24+.05}`;
    c.appendChild(p);
  }
}

/* ════════════════════
   LOAD SETTINGS
════════════════════ */
function loadSettings() {
  const p  = LS.get('pricing')||{price1m:199};
  const g  = LS.get('general')||{wa:'01712-345678'};
  const pr = p.price1m||199;
  document.querySelectorAll('.pv').forEach(e=>e.textContent=pr);
  const wa = document.getElementById('paywa');    if(wa)  wa.textContent  = g.wa||'—';
  const pi = document.getElementById('payinst');  if(pi)  pi.innerHTML    = p.inst||`বিকাশ নম্বরে ৳${pr} Send Money করুন। TrxID পাঠান।`;
  const ub = document.getElementById('upbtnw');   if(ub)  ub.textContent  = p.btnText||'⚡ Upgrade করুন';
}

/* ════════════════════
   NAVIGATION
════════════════════ */
function nav(el, page) {
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('act'));
  if (el) el.classList.add('act');
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));

  // support page has special flex layout
  const sp = document.getElementById('pg-support');
  if (sp) { sp.style.display='none'; sp.classList.remove('on'); }

  if (page==='support') {
    if (sp) { sp.style.display='flex'; sp.classList.add('on'); }
    loadChat();
  } else {
    const pg = document.getElementById('pg-'+page);
    if (pg) pg.classList.add('on');
  }

  document.getElementById('ptitle').textContent = PTITLES[page]||page;

  if (page==='home')    renderHome();
  if (page==='winning') { buildCats(); renderProds('all'); }
  if (page==='profile') loadProf();
  closeSB();
}

function goprof()   { nav(document.querySelector('[onclick*="\'profile\'"]'),'profile'); }
function goSupport(){ nav(document.querySelector('[onclick*="\'support\'"]'),'support'); }
function sbtog()    { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sov').classList.toggle('show'); }
function closeSB()  { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sov').classList.remove('show'); }

/* ════════════════════
   HOME PAGE
════════════════════ */
function renderHome() {
  renderBanners();
  renderStats();
  // hide upgrade CTA for pro users
  const cta = document.getElementById('home-upgrade-cta');
  if (cta) cta.style.display = isPro() ? 'none' : 'block';
}

/* ── BANNERS ── */
function renderBanners() {
  const bans = LS.get('banners')||[];
  const wrap = document.getElementById('ban-slides');
  const dots = document.getElementById('ban-dots');
  if (!wrap) return;
  clearTimeout(banTimer);

  if (!bans.length) {
    // default banner
    wrap.innerHTML = `<div class="ban-slide on">
      <div class="ban-ph" style="background:linear-gradient(135deg,rgba(0,50,140,.88),rgba(80,0,140,.82))">🚀</div>
      <div class="ban-overlay">
        <div class="ban-title">NexoraPilot-এ স্বাগতম!</div>
        <div class="ban-sub">বাংলাদেশের সেরা Ecommerce Intelligence Tool</div>
        <button class="ban-btn" onclick="nav(document.querySelector('[onclick*=winning]'),'winning')">Winning Products দেখুন →</button>
      </div>
    </div>`;
    if (dots) dots.innerHTML='';
    return;
  }

  wrap.innerHTML = bans.map((b,i)=>`
    <div class="ban-slide${i===0?' on':''}" ${b.link?`onclick="window.open('${b.link}','_blank')"`:''} style="cursor:${b.link?'pointer':'default'}">
      ${b.img
        ? `<img src="${b.img}" alt="${b.title||''}" onerror="this.style.display='none'">`
        : `<div class="ban-ph" style="background:${b.bg||'linear-gradient(135deg,rgba(0,50,140,.88),rgba(80,0,140,.82))'}">${b.emoji||'🚀'}</div>`}
      <div class="ban-overlay">
        ${b.title   ? `<div class="ban-title">${b.title}</div>`:''}
        ${b.subtitle? `<div class="ban-sub">${b.subtitle}</div>`:''}
        ${b.btnText ? `<button class="ban-btn">${b.btnText}</button>`:''}
      </div>
    </div>`).join('');

  if (dots) dots.innerHTML = bans.map((_,i)=>`<div class="bd${i===0?' on':''}" onclick="gotoBan(${i})"></div>`).join('');
  banIdx = 0;
  if (bans.length>1) autoBan();
}
function gotoBan(idx) {
  const slides=document.querySelectorAll('.ban-slide');
  const dotEls=document.querySelectorAll('.bd');
  slides.forEach((s,i)=>s.classList.toggle('on', i===idx));
  dotEls.forEach((d,i)=>d.classList.toggle('on', i===idx));
  banIdx=idx; clearTimeout(banTimer); autoBan();
}
function autoBan() {
  const bans=LS.get('banners')||[];
  if (bans.length<=1) return;
  banTimer=setTimeout(()=>{ banIdx=(banIdx+1)%bans.length; gotoBan(banIdx); },4200);
}

/* ── HOME STATS ── */
function renderStats() {
  const prods = LS.get('products')||[];
  const subs  = LS.get('subs')||[];
  const pr    = (LS.get('pricing')||{}).price1m||199;
  const el = document.getElementById('home-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="st"><div class="st-v" style="color:var(--pink)">${prods.length}+</div><div class="st-l">Products</div></div>
    <div class="st"><div class="st-v" style="color:var(--green)">${subs.length}</div><div class="st-l">Pro Members</div></div>
    <div class="st"><div class="st-v" style="color:var(--cyan2)">Daily</div><div class="st-l">Updated</div></div>
    <div class="st"><div class="st-v" style="color:var(--gold)">৳${pr}</div><div class="st-l">Per Month</div></div>`;
}

/* ════════════════════
   WINNING PRODUCTS
════════════════════ */
function buildCats() {
  const prods = LS.get('products')||[];
  const el = document.getElementById('catrow'); if(!el) return;
  el.innerHTML = CATS.map(c=>{
    const cnt = c.k==='all' ? prods.length : prods.filter(p=>p.cat===c.k).length;
    return `<div class="ct${c.k==='all'?' on':''}" onclick="selCat(this,'${c.k}')">${c.l}<span class="ctn">${cnt}</span></div>`;
  }).join('');
  const sp = document.getElementById('stprods'); if(sp) sp.textContent=prods.length;
}
function selCat(el,cat) {
  document.querySelectorAll('.ct').forEach(t=>t.classList.remove('on'));
  el.classList.add('on'); renderProds(cat);
}
function getFR() { const g=LS.get('general')||{}; return{from:g.freeFrom||11,to:g.freeTo||20}; }
function renderProds(cat) {
  curCat=cat;
  const{from,to}=getFR();
  const all  = cat==='all'?(LS.get('products')||[]):(LS.get('products')||[]).filter(p=>p.cat===cat);
  const free = all.filter(p=>p.rank>=from && p.rank<=to);
  const pro  = all.filter(p=>p.rank<from);
  const fc=document.getElementById('fcnt'); if(fc) fc.textContent=free.length+' টি';
  const fg=document.getElementById('fg');
  const pg=document.getElementById('prg');
  if(fg)  fg.innerHTML  = free.length ? free.map(freeCard).join('') : `<div style="padding:20px;text-align:center;color:var(--t3);grid-column:1/-1">কোনো free product নেই</div>`;
  if(pg)  pg.innerHTML  = pro.length  ? pro.map(proCard).join('')   : `<div style="padding:20px;text-align:center;color:var(--t3);grid-column:1/-1">কোনো pro product নেই</div>`;
  const wb=document.getElementById('winban'); if(wb) wb.style.display=isPro()?'none':'flex';
}

function freeCard(p) {
  const bs = p.badges.map(bh).join('')+`<span class="bdg b-free">FREE</span>`;
  return `<div class="pc" onclick='openDet(${JSON.stringify(p).replace(/'/g,"&#39;")})'>
    <div class="pim">${imgH(p,148)}<div class="pim-bs">${bs}</div><div class="rnk">#${p.rank}</div></div>
    <div class="pb">
      <div class="pn">${p.name}</div>
      <div class="pni">${p.niche||''}</div>
      <div class="scs">
        <div class="sc"><div class="scn" style="color:${sc(p.demand)}">${p.demand}</div><div class="scl">Demand</div></div>
        <div class="sc"><div class="scn" style="color:${sc(100-p.comp)}">${p.comp}</div><div class="scl">Comp.</div></div>
        <div class="sc"><div class="scn" style="color:var(--gold)">${p.profit}%</div><div class="scl">Profit</div></div>
      </div>
    </div>
    ${noteHtml(p)}
    <div class="pft">
      <div class="pfb m" onclick="event.stopPropagation();openDet(${JSON.stringify(p).replace(/'/g,"&#39;")})">📋 বিস্তারিত</div>
      <div class="pfb"   onclick="event.stopPropagation();goSupport()">💬 সাপোর্ট</div>
    </div>
  </div>`;
}
function proCard(p) {
  const pr=(LS.get('pricing')||{}).price1m||199;
  return `<div class="pcp" onclick="openPay()">
    <div class="prolbl">⭐ PRO — #${p.rank}</div>
    <div class="blr">
      <div class="pim">${imgH(p,128)}</div>
      <div class="pb">
        <div class="pn">${p.name}</div><div class="pni">${p.niche||''}</div>
        <div class="scs">
          <div class="sc"><div class="scn" style="color:${sc(p.demand)}">${p.demand}</div><div class="scl">D</div></div>
          <div class="sc"><div class="scn" style="color:${sc(100-p.comp)}">${p.comp}</div><div class="scl">C</div></div>
          <div class="sc"><div class="scn" style="color:var(--gold)">${p.profit}%</div><div class="scl">P</div></div>
        </div>
      </div>
    </div>
    <div class="lkov">
      <div class="lkr">🔒</div>
      <div class="lkt">PRO ONLY</div>
      <div class="lks">৳${pr}/মাস</div>
      <button class="lkb">⭐ Upgrade করুন</button>
    </div>
  </div>`;
}

/* ════════════════════
   PRODUCT DETAIL
════════════════════ */
function openDet(p) {
  curProd=p;
  const bn=document.getElementById('detbn');
  bn.innerHTML = p.img
    ? `<img src="${p.img}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=det-bph>🖼️</div>'">`
    : `<div class="det-bph">🖼️</div>`;
  document.getElementById('detnm').textContent  = p.name;
  document.getElementById('detni').textContent  = p.niche||'';
  document.getElementById('detbds').innerHTML   = p.badges.map(bh).join('');

  // ── TAB 1: Overview ──
  const note = (LS.get('notes')||{})[p.key]||p.note||'';
  const base = (p.niche||p.cat).split('·').pop().trim().toLowerCase().replace(/\s/g,'');
  const hashtags = [`#${base}`,`#${p.name.replace(/\s/g,'').toLowerCase().slice(0,14)}`,`#tiktokmademebuyit`,`#musthave2025`];

  document.getElementById('det-ov').innerHTML = `
    <div class="sc4">
      <div class="dsb"><div class="dsbv" style="color:${sc(p.demand)}">${p.demand}</div><div class="dsbl">Demand</div></div>
      <div class="dsb"><div class="dsbv" style="color:${sc(100-p.comp)}">${p.comp}</div><div class="dsbl">Comp.</div></div>
      <div class="dsb"><div class="dsbv" style="color:var(--gold)">${p.profit}%</div><div class="dsbl">Profit</div></div>
      <div class="dsb"><div class="dsbv" style="color:var(--cyan2)">${p.tiktok||'—'}</div><div class="dsbl">TikTok</div></div>
    </div>
    <div class="dig2">
      <div class="di"><div class="dil">📦 Monthly Sales</div><div class="div" style="color:var(--green)">${p.sales||'—'}</div></div>
      <div class="di"><div class="dil">🏆 Rank</div><div class="div">#${p.rank}</div></div>
      ${p.price ? `<div class="di"><div class="dil">💰 Estimated Price</div><div class="div" style="color:var(--gold)">${p.price}</div></div>`:''}
      ${p.where ? `<div class="di"><div class="dil">🛒 কোথায় পাওয়া যাবে</div><div class="div">${p.where}</div></div>`:''}
    </div>
    ${note?`<div class="dnb"><div class="dnbl">📌 Admin Insight</div><div class="dnbt">${note}</div></div>`:''}
    <div style="margin-bottom:12px">
      <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px">TikTok Hashtags</div>
      <div class="tags">${hashtags.map(t=>`<div class="tag">${t}</div>`).join('')}</div>
    </div>
    <div style="margin-bottom:4px">
      <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px">Supplier</div>
      <div class="sup-l" onclick="window.open('https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(p.name)}','_blank')">🏭 Alibaba-তে Supplier খুঁজুন →</div>
    </div>`;

  // ── TAB 2: Ad Guide ──
  const hasAd = p.fbAd||p.ttAd||p.caption||p.budget||p.adAngles;
  document.getElementById('det-ad').innerHTML = hasAd ? `
    ${p.fbAd     ? `<div class="ad-sec"><div class="ad-sec-t">📘 Facebook Ad Guide</div><div class="ad-sec-b">${p.fbAd}</div></div>`:''}
    ${p.ttAd     ? `<div class="ad-sec"><div class="ad-sec-t">🎵 TikTok Ad Guide</div><div class="ad-sec-b">${p.ttAd}</div></div>`:''}
    ${p.caption  ? `<div class="ad-sec"><div class="ad-sec-t">✍️ Caption Ideas</div><div class="ad-sec-b">${p.caption}</div></div>`:''}
    ${p.budget   ? `<div class="ad-sec"><div class="ad-sec-t">💰 Ad Budget</div><div class="ad-sec-b">${p.budget}</div></div>`:''}
    ${p.adAngles ? `<div class="ad-sec"><div class="ad-sec-t">🎯 Ad Angles</div><div class="ad-sec-b">${p.adAngles}</div></div>`:''}
    <div style="text-align:center;margin-top:12px">
      <button class="da da1" onclick="goSupport();closeM('det-modal')" style="flex:none;display:inline-block;padding:10px 20px">💬 আরো সাহায্য লাগলে Support নিন</button>
    </div>` :
    `<div style="padding:24px;text-align:center;color:var(--t3)">
      <div style="font-size:36px;margin-bottom:10px">📢</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:5px">Ad Guide এখনো যোগ হয়নি</div>
      <div style="font-size:11px">Admin শীঘ্রই এই product-এর Ad Guide যোগ করবেন।</div>
      <div style="margin-top:12px"><button class="da da1" onclick="goSupport();closeM('det-modal')" style="flex:none;display:inline-block;padding:9px 18px">💬 Admin-কে জিজ্ঞেস করুন</button></div>
    </div>`;

  // reset tabs
  document.querySelectorAll('.dtab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.dtpane').forEach(tp=>tp.classList.remove('on'));
  document.getElementById('tab-ov').classList.add('on');
  document.getElementById('det-ov').classList.add('on');
  openM('det-modal');
}
function dtab(el,id) {
  document.querySelectorAll('.dtab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.dtpane').forEach(tp=>tp.classList.remove('on'));
  el.classList.add('on');
  document.getElementById(id).classList.add('on');
}

/* ════════════════════
   PAYMENT MODAL
════════════════════ */
function openPay() {
  const bk=(LS.get('bkash')||[]).filter(b=>b.active);
  const E={'বিকাশ':'💸','নগদ':'💚','রকেট':'🚀'};
  const el=document.getElementById('pmopts');
  if(el) el.innerHTML = bk.length
    ? bk.map((b,i)=>`<div class="pm-opt${i===0?' sel':''}" onclick="selPM(this)">
        <div class="pm-logo">${E[b.method]||'💳'}</div>
        <div class="pm-nm">${b.method}</div>
        <div class="pm-num">${b.num}</div>
      </div>`).join('')
    : `<div style="color:var(--t3);font-size:11px">Admin পেমেন্ট নম্বর সেট করেননি।</div>`;
  openM('pay-modal');
}
function selPM(el) { document.querySelectorAll('.pm-opt').forEach(o=>o.classList.remove('sel')); el.classList.add('sel'); }
function subPay() {
  const ph=(document.getElementById('payphone').value||'').trim();
  const tx=(document.getElementById('paytrx').value||'').trim();
  if(!ph||!tx) { toast('ফোন ও TrxID দিন','err'); return; }
  const sel=document.querySelector('.pm-opt.sel');
  const m=sel?sel.querySelector('.pm-nm').textContent:'বিকাশ';
  const pr=(LS.get('pricing')||{}).price1m||199;
  const pend=LS.get('pending')||[];
  pend.unshift({id:'p'+Date.now(),phone:ph,trx:tx,amount:pr,method:m,time:new Date().toLocaleString('bn-BD')});
  LS.set('pending',pend);
  const prof=LS.get('userProfile')||{};
  prof.phone=prof.phone||ph; LS.set('userProfile',prof);
  closeM('pay-modal');
  document.getElementById('payphone').value='';
  document.getElementById('paytrx').value='';
  toast('পেমেন্ট সাবমিট! ২৪ ঘণ্টায় Activate হবে ✅','ok');
}

/* ════════════════════
   PROFILE
════════════════════ */
function loadProf() {
  const prof=LS.get('userProfile')||{};
  const subs=LS.get('subs')||[];
  const ph  =prof.phone||'';
  const sub =ph?subs.find(s=>s.phone===ph&&s.status==='active'):null;
  const nm  =prof.name||'User';
  const ini =nm[0]?.toUpperCase()||'U';

  document.querySelectorAll('#sbav,#tbav,#pav').forEach(e=>e.textContent=ini);
  document.getElementById('sbun').textContent=nm;
  document.getElementById('sbur').textContent=sub?'⭐ Pro Plan':'Free Plan';
  document.getElementById('sbdt').className='sb-dt'+(sub?' pro':'');

  // hide upgrade elements for pro
  ['sbfoot','tbup','profcta','winban'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) {
      if(id==='winban') el.style.display=sub?'none':'flex';
      else el.style.display=sub?'none':(id==='tbup'?'':'block');
    }
  });

  const pill=document.getElementById('pofpill');
  if(pill){pill.textContent=sub?'✅ Pro Plan Active':'⭐ Free Plan';pill.style.color=sub?'var(--green)':'var(--gold)';pill.style.borderColor=sub?'rgba(48,255,160,.20)':'rgba(255,200,60,.18)';}

  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  s('pofnm',nm); s('pofem',ph||'—');
  s('pinm',nm);  s('piph',ph||'—');
  s('pipl',sub?'Pro ⭐':'Free');
  s('pisn',sub?sub.start:'—');
  const pistEl=document.getElementById('pist');
  if(pistEl){pistEl.textContent=sub?'Active ✅':'Inactive';pistEl.style.color=sub?'var(--green)':'var(--t3)';}
  s('piss',sub?sub.start:'—'); s('pise',sub?sub.expiry:'—'); s('pitx',sub?sub.trx:'—');

  let dl=0;
  if(sub?.expiry){const pts=sub.expiry.split('/');if(pts.length===3){const e=new Date(pts[2],pts[1]-1,pts[0]);dl=Math.max(0,Math.ceil((e-new Date())/864e5));}}
  s('pdays',sub?dl:0); s('psaves',prof.saves||0); s('pscripts',prof.scripts||0);

  const en=document.getElementById('edname');  if(en) en.value=nm!=='User'?nm:'';
  const ep=document.getElementById('edphone'); if(ep) ep.value=ph;

  const sr=document.getElementById('subrow');
  if(sub&&sr){
    sr.style.background='rgba(0,38,22,.90)'; sr.style.borderColor='rgba(48,255,160,.24)';
    s('subt','✅ Pro Plan Active');
    const stEl=document.getElementById('subt'); if(stEl) stEl.style.color='var(--green)';
    s('subsub',`Expires: ${sub.expiry} · ${dl} দিন বাকি`);
    const sb=document.getElementById('subbtn');
    if(sb){sb.textContent='🔄 Renew';sb.style.background='rgba(48,255,160,.28)';}
  }
}
function saveProf() {
  const nm=(document.getElementById('edname').value||'').trim()||'User';
  const ph=(document.getElementById('edphone').value||'').trim();
  const prof=LS.get('userProfile')||{};
  prof.name=nm; prof.phone=ph; LS.set('userProfile',prof);
  loadProf(); toast('Profile সেভ হয়েছে ✅','ok');
}

/* ════════════════════
   SUPPORT CHAT
════════════════════ */
function loadChat() {
  const allMsgs = LS.get('chatMessages')||[];
  const prof    = LS.get('userProfile')||{};
  const ph      = prof.phone||'guest';
  const nm      = prof.name||'User';
  const ini     = nm[0]?.toUpperCase()||'U';
  const el      = document.getElementById('chat-msgs');
  if (!el) return;

  // filter: show welcome + messages for this user + admin replies to this user
  const myMsgs = allMsgs.filter(m=>
    m.userId===ph || m.replyTo===ph
  );

  if (!myMsgs.length) {
    el.innerHTML = `<div class="msg">
      <div class="msg-av adm">A</div>
      <div>
        <div class="msg-bub adm">👋 আস্সালামু আলাইকুম!<br>NexoraPilot Support-এ স্বাগতম।<br>আপনার যেকোনো প্রশ্ন বা সমস্যা এখানে জানান।<br>আমরা সাহায্য করব ইনশাআল্লাহ 🙂</div>
        <div class="msg-time">NexoraPilot Support</div>
      </div>
    </div>`;
    return;
  }

  el.innerHTML = myMsgs.map(m=>`<div class="msg${m.replyTo?'':' usr'}">
    <div class="msg-av ${m.replyTo?'adm':'usr'}">${m.replyTo?'A':ini}</div>
    <div>
      <div class="msg-bub ${m.replyTo?'adm':'usr'}">${m.text}</div>
      <div class="msg-time">${m.time}</div>
    </div>
  </div>`).join('');
  el.scrollTop = el.scrollHeight;
}
function sendChat() {
  const inp  = document.getElementById('chat-inp');
  const text = inp?inp.value.trim():'';
  if (!text) return;
  const prof = LS.get('userProfile')||{};
  const ph   = prof.phone||'guest';
  const nm   = prof.name||'User';
  const msgs = LS.get('chatMessages')||[];
  msgs.push({
    id:       'msg'+Date.now(),
    userId:   ph,
    userName: nm,
    text,
    time:     new Date().toLocaleString('bn-BD'),
    replyTo:  null   // null = user message, set to userId for admin reply
  });
  LS.set('chatMessages',msgs);
  if (inp) inp.value='';
  loadChat();
}
function chatKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();} }

/* ════════════════════
   MODAL HELPERS
════════════════════ */
function openM(id)  { document.getElementById(id).classList.add('show');    document.body.style.overflow='hidden'; }
function closeM(id) { document.getElementById(id).classList.remove('show'); document.body.style.overflow=''; }

/* ════════════════════
   TOAST
════════════════════ */
let toastT;
function toast(msg, tp='ok') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`toast ${tp} show`;
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),3200);
}

/* ════════════════════
   RESPONSIVE
════════════════════ */
function initResp() {
  const h=document.getElementById('hbg');
  const chk=()=>{ if(h) h.style.display=window.innerWidth<=768?'flex':'none'; };
  chk(); window.addEventListener('resize',chk);
}

/* ════════════════════
   INIT
════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  initPts();
  loadSettings();
  loadProf();
  renderHome();
  initResp();
  // close modals on bg click
  document.querySelectorAll('.mbg').forEach(bg=>bg.addEventListener('click',e=>{
    if(e.target===bg){ bg.classList.remove('show'); document.body.style.overflow=''; }
  }));
});
