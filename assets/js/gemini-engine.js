/* ============================================================
   NexoraPilot — Gemini Engine (ecomnexora tools port)
   Free-tier Gemini models only:
     text  → gemini-2.5-flash
     image → gemini-2.5-flash-image  (Nano Banana)
     tts   → gemini-2.5-flash-preview-tts
   API key: ফ্রি — https://aistudio.google.com/apikey থেকে নিন
   ============================================================ */

const GEMINI_CONFIG = {
  BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
  TEXT_MODEL:  'gemini-3.5-flash',          // ফ্রি-টিয়ার এলিজিবল (জুলাই ২০২৬ অনুযায়ী current)
  IMAGE_MODEL: 'gemini-3.1-flash-lite-image', // ছবি জেনারেশন — Google Cloud billing enable লাগবে
  TTS_MODEL:   'gemini-3.1-flash-tts-preview',
  /* মূল মডেল ব্যস্ত (503) / কোটা শেষ (429) / নেই (404) হলে এই মডেলগুলো ক্রমান্বয়ে চেষ্টা হবে */
  TEXT_FALLBACKS:  ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'],
  IMAGE_FALLBACKS: ['gemini-2.5-flash-image'],
  TTS_FALLBACKS:   ['gemini-2.5-flash-preview-tts'],
};

/* ── Key storage — same pattern as Store.systemApiKey, নতুন ফিল্ড systemGeminiKey ── */
const GStore = {
  getKey(){
    if(window._cachedGeminiKey) return window._cachedGeminiKey;
    try{ return (JSON.parse(localStorage.getItem('es_sys'))||{}).systemGeminiKey || ''; }catch{ return ''; }
  },
  async setKey(k){
    const d = (()=>{ try{return JSON.parse(localStorage.getItem('es_sys'))||{}}catch{return{}} })();
    d.systemGeminiKey = k;
    localStorage.setItem('es_sys', JSON.stringify(d));
    window._cachedGeminiKey = k;
    if(typeof db !== 'undefined' && db){
      try{
        await db.collection('settings').doc('config').set(
          { systemGeminiKey: k, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }catch(e){ console.warn('Gemini key Firestore save failed:', e); }
    }
  },
  async loadKeyFromFirestore(){
    if(typeof db === 'undefined' || !db) return;
    try{
      const snap = await db.collection('settings').doc('config').get();
      if(snap.exists && snap.data().systemGeminiKey){
        const k = snap.data().systemGeminiKey;
        window._cachedGeminiKey = k;
        const d = (()=>{ try{return JSON.parse(localStorage.getItem('es_sys'))||{}}catch{return{}} })();
        d.systemGeminiKey = k;
        localStorage.setItem('es_sys', JSON.stringify(d));
      }
    }catch(e){ console.warn('Gemini key Firestore load failed:', e); }
  },
};

/* ── File helpers ── */
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onloadend = ()=> resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── WAV encoding for TTS (Gemini returns raw 16-bit PCM @ 24kHz mono) ── */
function pcmBase64ToWavBlob(base64Audio){
  const binary = atob(base64Audio);
  const len = binary.length;
  const pcmBytes = new Uint8Array(len);
  for(let i=0;i<len;i++) pcmBytes[i] = binary.charCodeAt(i);

  const numChannels = 1, sampleRate = 24000, bitsPerSample = 16;
  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);
  const writeStr = (off,str)=>{ for(let i=0;i<str.length;i++) view.setUint8(off+i, str.charCodeAt(i)); };

  writeStr(0,'RIFF'); view.setUint32(4, 36+pcmBytes.length, true); writeStr(8,'WAVE');
  writeStr(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
  view.setUint16(22,numChannels,true); view.setUint32(24,sampleRate,true);
  view.setUint32(28, sampleRate*numChannels*(bitsPerSample/8), true);
  view.setUint16(32, numChannels*(bitsPerSample/8), true); view.setUint16(34,bitsPerSample,true);
  writeStr(36,'data'); view.setUint32(40, pcmBytes.length, true);
  for(let i=0;i<pcmBytes.length;i++) view.setUint8(44+i, pcmBytes[i]);

  return new Blob([view], { type:'audio/wav' });
}

/* ── Core Gemini engine ── */
const GeminiEngine = {
  hasKey(){ return !!GStore.getKey(); },

  noKeyMsg(){
    return `<div class="alert alert-warning" style="flex-direction:column;gap:12px;align-items:flex-start">
      <div>⚙️ <strong>Gemini API Key সেট করা নেই</strong></div>
      <div style="font-size:.85rem;color:var(--text2);line-height:1.6">
        ১. <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#a78bfa;font-weight:700">aistudio.google.com/apikey</a> এ যান (Google account দিয়ে লগইন)<br>
        ২. "Create API Key" চাপুন — টেক্সট টুলগুলো (পোস্ট, স্ক্রিপ্ট, ফানেল ইত্যাদি) এই ফ্রি key দিয়েই চলবে<br>
        ৩. ছবি/ভয়েস টুল (BG remover, Try-On, Photoshoot, Voiceover ইত্যাদি) চালাতে হলে একই Google Cloud প্রজেক্টে <a href="https://console.cloud.google.com/billing" target="_blank" style="color:#a78bfa;font-weight:700">Billing enable</a> করতে হবে — প্রতি ছবির খরচ মাত্র ~$0.02-0.05, কোনো মাসিক ফি নেই<br>
        ৪. Key কপি করে নিচে বসান
      </div>
      <div style="display:flex;gap:8px;width:100%">
        <input class="form-control" id="geminiKeyInput" placeholder="AIzaSy..." style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="saveGeminiKey()">✅ Save করুন</button>
      </div>
    </div>`;
  },

  async _endpoint(model){
    const key = GStore.getKey();
    return `${GEMINI_CONFIG.BASE}/${model}:generateContent?key=${key}`;
  },

  /* ── শেয়ার্ড রিকোয়েস্ট: ব্যস্ত (5xx) হলে রিট্রাই, 404/429 হলে পরের মডেল ── */
  async _request(models, body){
    const key = GStore.getKey();
    if(!key) throw new Error('NO_KEY');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const list = [...new Set(models.filter(Boolean))];
    let lastErr = null, sawQuota = false;
    for(const model of list){
      for(let attempt = 0; attempt < 2; attempt++){
        let res;
        try{
          res = await fetch(`${GEMINI_CONFIG.BASE}/${model}:generateContent?key=${key}`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
          });
        }catch(e){ throw new Error('ইন্টারনেট সংযোগ সমস্যা। আবার চেষ্টা করুন।'); }

        if(res.ok){
          const data = await res.json().catch(()=>({}));
          return { data, model };
        }
        const err = await res.json().catch(()=>({}));
        const msg = err.error?.message || '';
        if((res.status === 400 && /api key/i.test(msg)) || res.status === 401 || res.status === 403){
          throw new Error(`Gemini API Key কাজ করছে না (${res.status}): ${msg.substring(0,120)}`);
        }
        if(res.status === 429){ sawQuota = true; lastErr = new Error('RATE'); break; }      // পরের মডেল
        if(res.status === 404){ lastErr = new Error(`মডেল পাওয়া যায়নি: ${model}`); break; } // পরের মডেল
        if(res.status >= 500){                                                              // ব্যস্ত — একটু অপেক্ষা করে আবার
          lastErr = new Error(`Gemini Error (${res.status}): ${msg.substring(0,150) || 'সার্ভার ব্যস্ত'}`);
          if(attempt === 0){ await sleep(1800); continue; }
          break;
        }
        lastErr = new Error(`Gemini Error (${res.status}): ${msg.substring(0,150) || 'সমস্যা হয়েছে'}`);
        break;
      }
    }
    if(sawQuota && (!lastErr || lastErr.message === 'RATE')) throw new Error('RATE');
    throw lastErr || new Error('উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।');
  },

  /* প্লেইন টেক্সট আউটপুট (মার্কডাউন-স্টাইল) */
  async generateText(prompt){
    let r;
    try{
      r = await this._request([GEMINI_CONFIG.TEXT_MODEL, ...GEMINI_CONFIG.TEXT_FALLBACKS],
        { contents:[{ parts:[{ text: prompt }] }] });
    }catch(e){
      if(e.message === 'RATE') throw new Error('একটু বেশি রিকোয়েস্ট হয়ে গেছে (rate limit) — কিছুক্ষণ পর আবার চেষ্টা করুন।');
      throw e;
    }
    const data = r.data;
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p=>p.text||'').join('').trim();
    if(!text){
      if(data.promptFeedback?.blockReason) throw new Error(`Gemini ব্লক করেছে: ${data.promptFeedback.blockReason}`);
      throw new Error('কোনো আউটপুট পাওয়া যায়নি। আবার চেষ্টা করুন।');
    }
    return text;
  },

  /* ইমেজ জেনারেশন — টেক্সট প্রম্পট + (ঐচ্ছিক) ১টা বা একাধিক ইনপুট ইমেজ */
  async generateImage(prompt, imageFiles=[]){
    if(!GStore.getKey()) throw new Error('NO_KEY');
    const parts = [];
    for(const f of imageFiles){
      if(!f) continue;
      const b64 = await fileToBase64(f);
      parts.push({ inlineData: { mimeType: f.type, data: b64 } });
    }
    parts.push({ text: prompt });

    let r;
    try{
      r = await this._request([GEMINI_CONFIG.IMAGE_MODEL, ...GEMINI_CONFIG.IMAGE_FALLBACKS], { contents:[{ parts }] });
    }catch(e){
      if(e.message === 'RATE') throw new Error('এই ছবি-জেনারেশন মডেলের জন্য Google-এর ফ্রি কোটা শেষ/অনুপলব্ধ। ছবি/ভয়েস টুল চালাতে হলে আপনার Google Cloud প্রজেক্টে Billing enable করতে হবে (console.cloud.google.com → Billing) — প্রতি ছবির খরচ মাত্র ~$0.02-0.05, কোনো মাসিক সাবস্ক্রিপশন লাগে না।');
      throw e;
    }
    const data = r.data;
    const outParts = data.candidates?.[0]?.content?.parts || [];
    let imageUrl = '', text = '';
    for(const p of outParts){
      const inl = p.inlineData || p.inline_data;
      if(inl) imageUrl = `data:${inl.mimeType || inl.mime_type};base64,${inl.data}`;
      else if(p.text) text += p.text;
    }
    if(!imageUrl){
      if(data.promptFeedback?.blockReason) throw new Error(`Gemini ব্লক করেছে: ${data.promptFeedback.blockReason}`);
      throw new Error('ছবি জেনারেট হয়নি। আবার চেষ্টা করুন (রেট-লিমিট হলে কিছুক্ষণ পর চেষ্টা করুন)।');
    }
    return { imageUrl, text: text.trim() };
  },

  /* টেক্সট-টু-স্পিচ (voice: 'Kore' | 'Puck') */
  async generateSpeech(text, voice='Kore'){
    if(!GStore.getKey()) throw new Error('NO_KEY');
    const body = {
      contents:[{ parts:[{ text }] }],
      generationConfig:{
        responseModalities:['AUDIO'],
        speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName: voice } } }
      }
    };
    let r;
    try{
      r = await this._request([GEMINI_CONFIG.TTS_MODEL, ...GEMINI_CONFIG.TTS_FALLBACKS], body);
    }catch(e){
      if(e.message === 'RATE') throw new Error('ভয়েসওভার মডেলের ফ্রি কোটা শেষ/অনুপলব্ধ। এটা চালাতে Google Cloud প্রজেক্টে Billing enable করতে হবে (console.cloud.google.com → Billing)।');
      throw e;
    }
    const data = r.data;
    const outParts = data.candidates?.[0]?.content?.parts || [];
    const inl = outParts.map(p => p.inlineData || p.inline_data).find(Boolean);
    const b64Audio = inl?.data;
    if(!b64Audio){
      if(data.promptFeedback?.blockReason) throw new Error(`Gemini ব্লক করেছে: ${data.promptFeedback.blockReason}`);
      throw new Error('ভয়েস জেনারেট হয়নি। আবার চেষ্টা করুন।');
    }
    const blob = pcmBase64ToWavBlob(b64Audio);
    return URL.createObjectURL(blob);
  },
};

/* Admin/user key-save handler used by GeminiEngine.noKeyMsg() */
async function saveGeminiKey(){
  const v = document.getElementById('geminiKeyInput')?.value?.trim();
  if(!v){ Toast.error('Key দিন'); return; }
  await GStore.setKey(v);
  Toast.success('Gemini Key সেভ হয়েছে ✅ — এখন টুলের বাটনে আবার ক্লিক করুন');
}

/* Simple markdown-ish renderer for plain-text Gemini output (bold + line breaks + lists) */
function mdToHtml(text){
  if(!text) return '';
  let esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  esc = esc.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>');
  esc = esc.replace(/^### (.*)$/gm, '<h4 style="color:#fff;margin:10px 0 4px">$1</h4>');
  esc = esc.replace(/^## (.*)$/gm, '<h3 style="color:#fff;margin:12px 0 6px">$1</h3>');
  esc = esc.replace(/^- (.*)$/gm, '<li style="margin-left:18px">$1</li>');
  esc = esc.replace(/\n{2,}/g, '</p><p style="margin:10px 0">');
  esc = esc.replace(/\n/g, '<br>');
  return `<p style="margin:0">${esc}</p>`;
}
