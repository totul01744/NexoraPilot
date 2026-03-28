/* nexora-shared.js — localStorage helpers, particle init, orb backgrounds */

// ── localStorage ──
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem('tv_'+k)); } catch(e){ return null; } },
  set: (k,v) => localStorage.setItem('tv_'+k, JSON.stringify(v)),
  del: k => localStorage.removeItem('tv_'+k)
};

// ── Animated background ──
function initBackground(containerId) {
  const c = document.getElementById(containerId || 'particles');
  if (!c) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random() * 3 + 1;
    p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;animation-duration:${Math.random()*15+10}s;animation-delay:-${Math.random()*15}s;opacity:${Math.random()*.25+.06}`;
    c.appendChild(p);
  }
}

// ── Toast ──
let _toastTimer;
function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast-notification ${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Score color ──
function scoreColor(v) {
  return v >= 85 ? 'var(--green)' : v >= 65 ? 'var(--gold)' : 'var(--pink)';
}

// ── Badge HTML ──
const BADGE_MAP = { HOT:'badge-hot', VIRAL:'badge-viral', NEW:'badge-new', RISING:'badge-rising', TikTok:'badge-tiktok' };
function badgeHtml(b) {
  return `<span class="badge ${BADGE_MAP[b] || 'badge-new'}">${b}</span>`;
}

// ── Image HTML ──
function imgHtml(p, h = 150) {
  if (p.img) return `<img src="${p.img}" alt="${p.name}" style="width:100%;height:${h}px;object-fit:cover" loading="lazy" onerror="this.parentElement.innerHTML='<div class=prod-img-ph>🖼️</div>'">`;
  return `<div class="prod-img-ph" style="height:${h}px">🖼️</div>`;
}

// ── Note strip HTML ──
function noteStripHtml(p) {
  const n = (LS.get('notes') || {})[p.key];
  if (!n) return '';
  return `<div class="prod-note-strip"><span style="font-size:10px;flex-shrink:0;margin-top:1px">📌</span><div><div class="pn-lbl">Admin Note</div><div class="pn-tx">${n}</div></div></div>`;
}

// ── Typewriter ──
function typeWriter(el, text, speed = 8) {
  return new Promise(resolve => {
    let i = 0;
    el.innerHTML = '';
    const t = setInterval(() => {
      if (i < text.length) {
        el.innerHTML = text.slice(0, i + 1).replace(/\n/g, '<br>') + '<span style="border-right:2px solid rgba(0,200,255,.8);margin-left:1px"> </span>';
        i++;
      } else {
        el.innerHTML = text.replace(/\n/g, '<br>');
        clearInterval(t);
        resolve();
      }
    }, speed);
  });
}

// ── Gemini AI Script ──
async function runGeminiScript(curProd, scriptTypes, onStart, onSuccess, onError, onFinally) {
  const gm = LS.get('gemini') || {};
  if (!gm.key) { showToast('API Key নেই — Admin থেকে সেট করুন', 'err'); return; }
  onStart && onStart();
  const TL = {
    tiktok:   'TikTok Video Script (30-60s, Hook/Problem/Solution/CTA)',
    facebook: 'Facebook Ad Copy (headline, body, CTA)',
    hook:     '5টি আলাদা Viral Hook line',
    email:    'Email Marketing Script (subject + body)'
  };
  const LL = { bn:'বাংলায় লিখুন', en:'Write in English', mixed:'বাংলা ও English মিলিয়ে লিখুন' };
  const sys = gm.prompt || 'You are an expert ecommerce ad copywriter.';
  const prompt = `${sys}\n\nProduct: ${curProd.name}\nCategory: ${curProd.niche||curProd.cat}\nDemand: ${curProd.demand}/100\nProfit: ${curProd.profit}%\nTikTok: ${curProd.tiktok||'Trending'}\nSales: ${curProd.sales||'High'}\n\nTask: ${TL[scriptTypes.tp]} তৈরি করুন। ${LL[scriptTypes.lg]}। Emoji ব্যবহার করুন। Viral ও conversion-focused।`;
  try {
    const model = gm.model || 'gemini-1.5-flash';
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gm.key}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{ parts:[{ text:prompt }] }], generationConfig:{ temperature:0.9, maxOutputTokens:1024 } }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) { const ed = await res.json().catch(()=>({})); throw new Error(ed.error?.message || `HTTP ${res.status}`); }
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) throw new Error('Gemini থেকে response পাওয়া যায়নি।');
    onSuccess && onSuccess(txt);
  } catch(e) {
    let em = e.message || 'Unknown error';
    if (e.name === 'AbortError') em = 'Timeout — ইন্টারনেট চেক করুন।';
    else if (em.includes('Failed to fetch') || em.includes('fetch')) em = 'Network Error — ইন্টারনেট সংযোগ চেক করুন।';
    else if (em.includes('API_KEY_INVALID') || em.includes('invalid')) em = 'API Key ভুল — Admin থেকে সঠিক Key দিন।';
    else if (em.includes('QUOTA') || em.includes('quota')) em = 'API Quota শেষ — একটু পরে চেষ্টা করুন।';
    onError && onError(em);
  }
  onFinally && onFinally();
}
