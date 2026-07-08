/* ============================================================
   ecomnexora → NexoraPilot পোর্ট — ১৮টি AI টুল (পুরনো ১৮টা রিপ্লেস)
   টেক্সট টুল: Gemini text model (gemini-2.5-flash, ফ্রি-টিয়ার)
   ছবি টুল:   Gemini image model (gemini-2.5-flash-image, ফ্রি-টিয়ার)
   ভয়েস টুল:  Gemini TTS model
   ============================================================ */

/* ── জেনারিক রেজাল্ট রেন্ডারার ── */
window._toolResults = window._toolResults || {};

function renderTextResult(resultId, text){
  window._toolResults[resultId] = text;
  document.getElementById(resultId).innerHTML = `<div class="result-card fade-up">
    <div style="line-height:1.85;font-size:.9rem">${mdToHtml(text)}</div>
    <button class="copy-btn" style="position:static;margin-top:12px" onclick="copyText(window._toolResults['${resultId}'],this)">📋 কপি করুন</button>
  </div>`;
}

function renderImageResult(resultId, imageUrl, caption){
  document.getElementById(resultId).innerHTML = `<div class="result-card fade-up" style="text-align:center">
    <img src="${imageUrl}" style="max-width:100%;border-radius:10px;margin-bottom:10px">
    ${caption ? `<p style="font-size:.85rem;color:var(--text2);margin-bottom:10px">${mdToHtml(caption)}</p>` : ''}
    <a class="btn btn-secondary btn-sm" href="${imageUrl}" download="nexorapilot-image.png">⬇️ ডাউনলোড করুন</a>
  </div>`;
}

function renderAudioResult(resultId, audioUrl){
  document.getElementById(resultId).innerHTML = `<div class="result-card fade-up">
    <audio controls style="width:100%" src="${audioUrl}"></audio>
    <div class="mt-2"><a class="btn btn-secondary btn-sm" href="${audioUrl}" download="voiceover.wav">⬇️ ডাউনলোড করুন (WAV)</a></div>
  </div>`;
}

/* ── জেনারিক রানার — usage-limit + Gemini key চেক সহ ── */
async function runGeminiText(prompt, resultId, logName, logData){
  const el = document.getElementById(resultId);
  if(!el) return null;
  if(!GeminiEngine.hasKey()){ el.innerHTML = GeminiEngine.noKeyMsg(); return null; }
  const canRun = await Engine.checkLimit();
  if(!canRun){ el.innerHTML = await R.limitReached(); return null; }
  el.innerHTML = R.skeleton(2);
  try{
    const text = await GeminiEngine.generateText(prompt);
    await FB.incUsage(); await updateUsageDisplay();
    if(logName) await FB.logEvent(logName, logData||{});
    renderTextResult(resultId, text);
    return text;
  }catch(e){
    el.innerHTML = e.message==='NO_KEY' ? GeminiEngine.noKeyMsg() : R.error(e.message);
    return null;
  }
}

async function runGeminiImage(prompt, files, resultId, logName, logData){
  const el = document.getElementById(resultId);
  if(!el) return null;
  if(!GeminiEngine.hasKey()){ el.innerHTML = GeminiEngine.noKeyMsg(); return null; }
  const canRun = await Engine.checkLimit();
  if(!canRun){ el.innerHTML = await R.limitReached(); return null; }
  el.innerHTML = R.skeleton(2);
  try{
    const { imageUrl, text } = await GeminiEngine.generateImage(prompt, files);
    await FB.incUsage(); await updateUsageDisplay();
    if(logName) await FB.logEvent(logName, logData||{});
    renderImageResult(resultId, imageUrl, text);
    return imageUrl;
  }catch(e){
    el.innerHTML = e.message==='NO_KEY' ? GeminiEngine.noKeyMsg() : R.error(e.message);
    return null;
  }
}

async function runGeminiAudio(text, voice, resultId, logName, logData){
  const el = document.getElementById(resultId);
  if(!el) return null;
  if(!GeminiEngine.hasKey()){ el.innerHTML = GeminiEngine.noKeyMsg(); return null; }
  const canRun = await Engine.checkLimit();
  if(!canRun){ el.innerHTML = await R.limitReached(); return null; }
  el.innerHTML = R.skeleton(1);
  try{
    const audioUrl = await GeminiEngine.generateSpeech(text, voice);
    await FB.incUsage(); await updateUsageDisplay();
    if(logName) await FB.logEvent(logName, logData||{});
    renderAudioResult(resultId, audioUrl);
    return audioUrl;
  }catch(e){
    el.innerHTML = e.message==='NO_KEY' ? GeminiEngine.noKeyMsg() : R.error(e.message);
    return null;
  }
}

function reqVal(id, label){
  const v = document.getElementById(id)?.value?.trim();
  if(!v){ Toast.error(`${label} দিন`); return null; }
  return v;
}
function reqFile(id, label){
  const f = document.getElementById(id)?.files?.[0];
  if(!f){ Toast.error(`${label} আপলোড করুন`); return null; }
  return f;
}

/* ════════════════════ TOOLS তালিকা (১৮টি) ════════════════════ */
const TOOLS = [
  {id:'post_generator',icon:'📱',name:'পোস্ট জেনারেটর',desc:'সাধারণ পণ্যের বিবরণকে আকর্ষণীয় ফেসবুক পোস্টে রূপান্তর করুন',color:'rgba(59,130,246,.06)',border:'rgba(59,130,246,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">📱 পোস্ট জেনারেটর</h3><div class="form-group"><label class="form-label">পণ্যের বিবরণ *</label><textarea class="form-control" id="pg-desc" rows="6" placeholder="পণ্যের নাম, বৈশিষ্ট্য, দাম, টার্গেট কাস্টমার লিখুন..."></textarea></div><button class="btn btn-primary" onclick="runPostGenerator()">📱 পোস্ট তৈরি করুন</button><div id="pg-result" class="result-area mt-3"></div></div>`},

  {id:'ad_copy_generator',icon:'📢',name:'অ্যাড কপি জেনারেটর',desc:'পণ্যের বিবরণ থেকে আকর্ষণীয় বিজ্ঞাপন কপি তৈরি করুন',color:'rgba(0,245,212,.06)',border:'rgba(0,245,212,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">📢 অ্যাড কপি জেনারেটর</h3><div class="form-group"><label class="form-label">পণ্যের নাম *</label><input class="form-control" id="adc-product" placeholder="যেমন: প্রিমিয়াম কটন পাঞ্জাবি"></div><div class="form-group"><label class="form-label">লক্ষ্য</label><select class="form-control" id="adc-goal"><option value="sales">সেলস বাড়ানো</option><option value="leads">লিড সংগ্রহ</option><option value="awareness">ব্র্যান্ড অ্যাওয়ারনেস</option></select></div><div class="form-group"><label class="form-label">টার্গেট অডিয়েন্স</label><input class="form-control" id="adc-audience" placeholder="যেমন: ২৫-৪০ বছরের চাকরিজীবী পুরুষ"></div><button class="btn btn-primary" onclick="runAdCopyGenerator()">📢 কপি তৈরি করুন</button><div id="adc-result" class="result-area mt-3"></div></div>`},

  {id:'viral_post_generator',icon:'🔥',name:'ভাইরাল পোস্ট জেনারেটর',desc:'ট্রেন্ডিং পোস্ট থেকে নতুন লেখা ও ছবি সহ ইউনিক পোস্ট তৈরি করুন',color:'rgba(236,72,153,.06)',border:'rgba(236,72,153,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🔥 ভাইরাল পোস্ট জেনারেটর</h3><div class="form-group"><label class="form-label">ট্রেন্ডিং পোস্টের লেখা *</label><textarea class="form-control" id="vp-text" rows="5" placeholder="যে পোস্টটি ভাইরাল হয়েছে সেটার লেখা এখানে পেস্ট করুন..."></textarea></div><div class="form-group"><label class="form-label">রেফারেন্স ছবি (ঐচ্ছিক)</label><input class="form-control" type="file" accept="image/*" id="vp-img" onchange="previewImg(this,'vp-preview')"><img id="vp-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><button class="btn btn-primary" onclick="runViralPostGenerator()">🔥 তৈরি করুন</button><div id="vp-result" class="result-area mt-3"></div></div>`},

  {id:'ai_content_studio',icon:'🪄',name:'AI কন্টেন্ট স্টুডিও',desc:'আপনার লেখা থেকে ছবি তৈরি করুন',color:'rgba(124,58,237,.06)',border:'rgba(124,58,237,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🪄 AI কন্টেন্ট স্টুডিও</h3><div class="form-group"><label class="form-label">ছবির বর্ণনা *</label><textarea class="form-control" id="cs-prompt" rows="4" placeholder="যেমন: সবুজ শাড়ি পরা একজন মডেল ফুলের বাগানে দাঁড়িয়ে আছে, স্টুডিও লাইটিং, হাই-কোয়ালিটি"></textarea></div><div class="form-group"><label class="form-label">Aspect Ratio</label><select class="form-control" id="cs-ratio"><option value="1:1">1:1 (স্কয়ার)</option><option value="9:16">9:16 (স্টোরি/রিল)</option><option value="16:9">16:9 (ল্যান্ডস্কেপ)</option><option value="4:3">4:3</option><option value="3:4">3:4</option></select></div><button class="btn btn-primary" onclick="runAiContentStudio()">🪄 ছবি তৈরি করুন</button><div id="cs-result" class="result-area mt-3"></div></div>`},

  {id:'watermark_remover',icon:'🧽',name:'ওয়াটারমার্ক রিমুভার',desc:'ছবি থেকে ওয়াটারমার্ক/অবাঞ্ছিত অংশ মুছে ফেলুন',color:'rgba(245,158,11,.06)',border:'rgba(245,158,11,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🧽 ওয়াটারমার্ক রিমুভার</h3><p style="font-size:.82rem;color:var(--text2);margin-bottom:14px">মূল ছবি এবং একটি মাস্ক ছবি দিন — মাস্কে যে অংশ সাদা (white) থাকবে সেটাই মুছে ফেলা হবে।</p><div class="form-group"><label class="form-label">মূল ছবি *</label><input class="form-control" type="file" accept="image/*" id="wr-img" onchange="previewImg(this,'wr-preview')"><img id="wr-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><div class="form-group"><label class="form-label">মাস্ক ছবি * (সাদা = মুছে ফেলুন)</label><input class="form-control" type="file" accept="image/*" id="wr-mask" onchange="previewImg(this,'wr-mask-preview')"><img id="wr-mask-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><button class="btn btn-primary" onclick="runWatermarkRemover()">🧽 মুছে ফেলুন</button><div id="wr-result" class="result-area mt-3"></div></div>`},

  {id:'garment_enhancer',icon:'🎨',name:'পোশাকের ছবি এডিটর',desc:'সাধারণ পোশাকের ছবিকে অসাধারণ করে তুলুন',color:'rgba(0,245,212,.06)',border:'rgba(0,245,212,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🎨 পোশাকের ছবি এডিটর</h3><div class="form-group"><label class="form-label">পোশাকের ছবি *</label><input class="form-control" type="file" accept="image/*" id="ge-img" onchange="previewImg(this,'ge-preview')"><img id="ge-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><div class="form-group"><label class="form-label">কী পরিবর্তন চান (ঐচ্ছিক)</label><input class="form-control" id="ge-notes" placeholder="যেমন: ব্যাকগ্রাউন্ড প্রফেশনাল স্টুডিও করুন, লাইটিং উন্নত করুন"></div><button class="btn btn-primary" onclick="runGarmentEnhancer()">🎨 এনহান্স করুন</button><div id="ge-result" class="result-area mt-3"></div></div>`},

  {id:'photoshoot',icon:'📷',name:'প্রোডাক্ট ফটোশুট',desc:'সাধারণ পণ্যের ছবিকে পেশাদার ফটোশুটের ছবিতে রূপান্তর করুন',color:'rgba(59,130,246,.06)',border:'rgba(59,130,246,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">📷 প্রোডাক্ট ফটোশুট</h3><div class="form-group"><label class="form-label">পণ্যের ছবি *</label><input class="form-control" type="file" accept="image/*" id="ps-img" onchange="previewImg(this,'ps-preview')"><img id="ps-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><div class="form-group"><label class="form-label">সিন/ব্যাকগ্রাউন্ড বর্ণনা</label><input class="form-control" id="ps-scene" placeholder="যেমন: মার্বেল টেবিলে, প্রাকৃতিক আলোয়, ন্যূনতম ব্যাকগ্রাউন্ড"></div><button class="btn btn-primary" onclick="runPhotoshoot()">📷 ফটোশুট তৈরি করুন</button><div id="ps-result" class="result-area mt-3"></div></div>`},

  {id:'bg_remover',icon:'✂️',name:'ব্যাকগ্রাউন্ড রিমুভার',desc:'ছবি থেকে নিখুঁতভাবে ব্যাকগ্রাউন্ড মুছে ফেলুন',color:'rgba(124,58,237,.06)',border:'rgba(124,58,237,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">✂️ ব্যাকগ্রাউন্ড রিমুভার</h3><div class="form-group"><label class="form-label">ছবি আপলোড করুন *</label><input class="form-control" type="file" accept="image/*" id="bg-img" onchange="previewImg(this,'bg-preview')"><img id="bg-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><button class="btn btn-primary" onclick="runBgRemover()">✂️ ব্যাকগ্রাউন্ড মুছুন</button><div id="bg-result" class="result-area mt-3"></div></div>`},

  {id:'virtual_try_on',icon:'✨',name:'ভার্চুয়াল ট্রাই-অন',desc:'মডেলের উপর ভার্চুয়ালি পোশাক পরিয়ে দেখুন',color:'rgba(236,72,153,.06)',border:'rgba(236,72,153,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">✨ ভার্চুয়াল ট্রাই-অন</h3><div class="form-group"><label class="form-label">মডেলের ছবি *</label><input class="form-control" type="file" accept="image/*" id="vt-model" onchange="previewImg(this,'vt-model-preview')"><img id="vt-model-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><div class="form-group"><label class="form-label">পোশাকের ছবি *</label><input class="form-control" type="file" accept="image/*" id="vt-garment" onchange="previewImg(this,'vt-garment-preview')"><img id="vt-garment-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><button class="btn btn-primary" onclick="runVirtualTryOn()">✨ ট্রাই-অন করুন</button><div id="vt-result" class="result-area mt-3"></div></div>`},

  {id:'model_from_garment',icon:'🧍',name:'পোশাক থেকে মডেল',desc:'শুধুমাত্র পোশাকের ছবি থেকে মডেল তৈরি করুন',color:'rgba(245,158,11,.06)',border:'rgba(245,158,11,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🧍 পোশাক থেকে মডেল</h3><div class="form-group"><label class="form-label">পোশাকের ছবি *</label><input class="form-control" type="file" accept="image/*" id="mg-img" onchange="previewImg(this,'mg-preview')"><img id="mg-preview" style="max-width:120px;display:none;margin-top:8px;border-radius:8px"></div><div class="form-group"><label class="form-label">মডেলের ধরন</label><select class="form-control" id="mg-type"><option>দক্ষিণ এশীয় নারী মডেল</option><option>দক্ষিণ এশীয় পুরুষ মডেল</option><option>যেকোনো নারী মডেল</option><option>যেকোনো পুরুষ মডেল</option></select></div><button class="btn btn-primary" onclick="runModelFromGarment()">🧍 মডেল তৈরি করুন</button><div id="mg-result" class="result-area mt-3"></div></div>`},

  {id:'video_prompt_generator',icon:'💡',name:'ভিডিও প্রম্পট জেনারেটর',desc:'ফ্যাশন ভিডিওর জন্য Veo/Sora স্টাইল প্রম্পট তৈরি করুন',color:'rgba(0,245,212,.06)',border:'rgba(0,245,212,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">💡 ভিডিও প্রম্পট জেনারেটর</h3><div class="form-group"><label class="form-label">সিন/পণ্যের বর্ণনা *</label><input class="form-control" id="vpr-scene" placeholder="যেমন: শাড়ি পরা মডেল হাঁটছে"></div><div class="form-group"><label class="form-label">স্টাইল</label><select class="form-control" id="vpr-style"><option>সিনেমাটিক</option><option>রিয়েলিস্টিক</option><option>প্রোডাক্ট শোকেস</option></select></div><button class="btn btn-primary" onclick="runVideoPromptGenerator()">💡 প্রম্পট তৈরি করুন</button><div id="vpr-result" class="result-area mt-3"></div></div>`},

  {id:'ad_funnel_generator',icon:'🧭',name:'অ্যাড ফানেল জেনারেটর',desc:'পণ্যের জন্য সম্পূর্ণ ফেসবুক অ্যাড ফানেল তৈরি করুন',color:'rgba(124,58,237,.06)',border:'rgba(124,58,237,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🧭 অ্যাড ফানেল জেনারেটর</h3><div class="form-group"><label class="form-label">পণ্যের নাম *</label><input class="form-control" id="af-product" placeholder="Product name"></div><div class="form-group"><label class="form-label">দৈনিক বাজেট</label><select class="form-control" id="af-budget"><option>৳৫০০-২০০০ (কম)</option><option selected>৳২০০০-৫০০০ (মাঝারি)</option><option>৳৫০০০+ (বেশি)</option></select></div><button class="btn btn-primary" onclick="runAdFunnelGenerator()">🧭 ফানেল তৈরি করুন</button><div id="af-result" class="result-area mt-3"></div></div>`},

  {id:'promotional_post_generator',icon:'🎁',name:'প্রচারমূলক পোস্ট জেনারেটর',desc:'অফার/সেল নিয়ে প্রচারমূলক পোস্ট তৈরি করুন',color:'rgba(245,158,11,.06)',border:'rgba(245,158,11,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🎁 প্রচারমূলক পোস্ট</h3><div class="form-group"><label class="form-label">পণ্যের নাম *</label><input class="form-control" id="pp-product" placeholder="Product name"></div><div class="form-group"><label class="form-label">অফার</label><select class="form-control" id="pp-offer"><option>ডিসকাউন্ট</option><option>বাই ১ পান ১ ফ্রি</option><option>ফ্রি ডেলিভারি</option><option>ফ্ল্যাশ সেল</option></select></div><div class="form-group"><label class="form-label">সময়সীমা</label><select class="form-control" id="pp-duration"><option>২৪ ঘণ্টা</option><option>৪৮ ঘণ্টা</option><option>৭ দিন</option></select></div><button class="btn btn-primary" onclick="runPromotionalPostGenerator()">🎁 তৈরি করুন</button><div id="pp-result" class="result-area mt-3"></div></div>`},

  {id:'storyboard_generator',icon:'🎬',name:'স্টোরিবোর্ড জেনারেটর',desc:'বিজ্ঞাপনের জন্য ৩ ধাপের ভিজ্যুয়াল গল্প তৈরি করুন',color:'rgba(59,130,246,.06)',border:'rgba(59,130,246,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🎬 স্টোরিবোর্ড জেনারেটর</h3><div class="form-group"><label class="form-label">টপিক *</label><input class="form-control" id="sb-topic" placeholder="Video topic"></div><div class="form-group"><label class="form-label">ধরন</label><select class="form-control" id="sb-type"><option>প্রোডাক্ট শোকেস</option><option>টেস্টিমোনিয়াল</option><option>টিউটোরিয়াল</option></select></div><button class="btn btn-primary" onclick="runStoryboardGenerator()">🎬 তৈরি করুন</button><div id="sb-result" class="result-area mt-3"></div></div>`},

  {id:'subtitle_translator',icon:'🌐',name:'সাবটাইটেল ট্রান্সলেটর',desc:'ভিডিওর সাবটাইটেল অনুবাদ করুন',color:'rgba(0,245,212,.06)',border:'rgba(0,245,212,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🌐 সাবটাইটেল ট্রান্সলেটর</h3><div class="form-group"><label class="form-label">টেক্সট *</label><textarea class="form-control" id="st-text" rows="5" placeholder="সাবটাইটেল টেক্সট..."></textarea></div><div class="form-group"><label class="form-label">থেকে</label><select class="form-control" id="st-from"><option>English</option><option>Bengali</option><option>Hindi</option></select></div><div class="form-group"><label class="form-label">এ</label><select class="form-control" id="st-to"><option>Bengali</option><option>English</option><option>Hindi</option></select></div><button class="btn btn-primary" onclick="runSubtitleTranslator()">🌐 অনুবাদ করুন</button><div id="st-result" class="result-area mt-3"></div></div>`},

  {id:'ai_voiceover_studio',icon:'🔊',name:'AI ভয়েসওভার স্টুডিও',desc:'পণ্যের বর্ণনা থেকে ভয়েসওভার তৈরি করুন',color:'rgba(124,58,237,.06)',border:'rgba(124,58,237,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🔊 AI ভয়েসওভার স্টুডিও</h3><div class="form-group"><label class="form-label">স্ক্রিপ্ট *</label><textarea class="form-control" id="vo-text" rows="5" placeholder="যে টেক্সট ভয়েসওভার করতে চান..."></textarea></div><div class="form-group"><label class="form-label">ভয়েস</label><select class="form-control" id="vo-voice"><option value="Kore">Kore (নারী কণ্ঠ)</option><option value="Puck">Puck (পুরুষ কণ্ঠ)</option></select></div><button class="btn btn-primary" onclick="runAiVoiceoverStudio()">🔊 ভয়েসওভার তৈরি করুন</button><div id="vo-result" class="result-area mt-3"></div></div>`},

  {id:'concept_architect',icon:'🏗️',name:'কনসেপ্ট আর্কিটেক্ট',desc:'কীওয়ার্ড থেকে ভিজ্যুয়াল কনসেপ্ট ও প্রম্পট তৈরি করুন',color:'rgba(245,158,11,.06)',border:'rgba(245,158,11,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🏗️ কনসেপ্ট আর্কিটেক্ট</h3><div class="form-group"><label class="form-label">কীওয়ার্ড/আইডিয়া *</label><textarea class="form-control" id="con-idea" rows="3" placeholder="আপনার আইডিয়া লিখুন..."></textarea></div><button class="btn btn-primary" onclick="runConceptArchitect()">🏗️ তৈরি করুন</button><div id="con-result" class="result-area mt-3"></div></div>`},

  {id:'video_script_generator',icon:'🎥',name:'ভিডিও স্ক্রিপ্ট জেনারেটর',desc:'পণ্যের জন্য সম্পূর্ণ ভিডিও মার্কেটিং স্ক্রিপ্ট তৈরি করুন',color:'rgba(59,130,246,.06)',border:'rgba(59,130,246,.12)',html:`<div class="card" style="padding:24px"><h3 style="margin-bottom:18px">🎥 ভিডিও স্ক্রিপ্ট জেনারেটর</h3><div class="form-group"><label class="form-label">টপিক/পণ্য *</label><input class="form-control" id="vs-topic" placeholder="Video topic"></div><div class="form-group"><label class="form-label">দৈর্ঘ্য</label><select class="form-control" id="vs-duration"><option>১-২ মিনিট</option><option>৩-৫ মিনিট</option><option>৫-১০ মিনিট</option></select></div><div class="form-group"><label class="form-label">প্ল্যাটফর্ম</label><select class="form-control" id="vs-platform"><option>YouTube</option><option>Facebook</option><option>TikTok</option></select></div><button class="btn btn-primary" onclick="runVideoScriptGenerator()">🎥 স্ক্রিপ্ট লিখুন</button><div id="vs-result" class="result-area mt-3"></div></div>`},
];

/* ════════════════════ RUN ফাংশনগুলো ════════════════════ */

async function runPostGenerator(){
  const desc = reqVal('pg-desc','পণ্যের বিবরণ'); if(!desc) return;
  const prompt = `আপনি বাংলাদেশের এক নম্বর ভাইরাল মার্কেটিং এক্সপার্ট। নিচের পণ্যের বিবরণ থেকে একটি চোখ ধাঁধানো, সর্বোচ্চ শেয়ারযোগ্য বাংলা ফেসবুক পোস্ট লিখুন — ভাইরাল হুক দিয়ে শুরু, ছোট গল্পের ছোঁয়া, মোবাইল-ফ্রেন্ডলি ফরম্যাটিং, ইমোজি (✨🔥🛍️💖), শক্তিশালী CTA, এবং ৩-৫টি প্রাসঙ্গিক হ্যাশট্যাগ। শুধু ফাইনাল পোস্টটি দিন, কোনো ভূমিকা নয়।\n\nপণ্যের বিবরণ:\n${desc}`;
  await runGeminiText(prompt, 'pg-result', 'post_generator', {desc});
}

async function runAdCopyGenerator(){
  const product = reqVal('adc-product','পণ্যের নাম'); if(!product) return;
  const goal = document.getElementById('adc-goal').value;
  const audience = document.getElementById('adc-audience').value || 'সাধারণ ক্রেতা';
  const prompt = `আপনি একজন এক্সপার্ট ফেসবুক/গুগল অ্যাড কপিরাইটার। "${product}" পণ্যের জন্য একটি উচ্চ-কনভার্টিং বিজ্ঞাপন কপি লিখুন। লক্ষ্য: ${goal}। টার্গেট অডিয়েন্স: ${audience}। আউটপুটে থাকবে: একটি আকর্ষণীয় হেডলাইন, একটি প্রাইমারি টেক্সট (৩-৪ লাইন), এবং একটি শক্তিশালী CTA বাটন টেক্সট। বাংলায় লিখুন, শুধু ফাইনাল কপি দিন।`;
  await runGeminiText(prompt, 'adc-result', 'ad_copy_generator', {product});
}

async function runViralPostGenerator(){
  const postText = reqVal('vp-text','ট্রেন্ডিং পোস্টের লেখা'); if(!postText) return;
  const imgFile = document.getElementById('vp-img')?.files?.[0];
  const prompt = `আপনি একজন বিশ্বসেরা ভাইরাল কনটেন্ট ক্রিয়েটর। নিচের ট্রেন্ডিং ফেসবুক পোস্টের মূল ভাব ও আবেগ ঠিক রেখে, সম্পূর্ণ নতুন হুক ও ভাষায় এটিকে পুনর্লিখন করুন — আরও আকর্ষণীয় ও শেয়ারযোগ্য করে। শুধু নতুন পোস্টের লেখাটি বাংলায় দিন। এরপর একটি সংক্ষিপ্ত ইমেজ প্রম্পট (ইংরেজিতে) দিন যা দিয়ে এই পোস্টের সাথে মানানসই একটি ছবি তৈরি করা যাবে, "IMAGE PROMPT:" লেবেল দিয়ে শুরু করে।\n\nট্রেন্ডিং পোস্ট:\n${postText}`;
  const el = document.getElementById('vp-result');
  if(!GeminiEngine.hasKey()){ el.innerHTML = GeminiEngine.noKeyMsg(); return; }
  const canRun = await Engine.checkLimit();
  if(!canRun){ el.innerHTML = await R.limitReached(); return; }
  el.innerHTML = R.skeleton(2);
  try{
    const text = await GeminiEngine.generateText(prompt);
    const imgPromptMatch = text.match(/IMAGE PROMPT:\s*([\s\S]*)/i);
    const postOnly = text.replace(/IMAGE PROMPT:[\s\S]*/i,'').trim();
    let imageUrl = '';
    if(imgPromptMatch){
      try{
        const imgResult = await GeminiEngine.generateImage(imgPromptMatch[1].trim(), imgFile?[imgFile]:[]);
        imageUrl = imgResult.imageUrl;
      }catch(e){ /* ছবি ছাড়াই টেক্সট দেখাবে */ }
    }
    await FB.incUsage(); await updateUsageDisplay();
    await FB.logEvent('viral_post_generator',{});
    window._toolResults['vp-result'] = postOnly;
    el.innerHTML = `<div class="result-card fade-up">
      ${imageUrl?`<img src="${imageUrl}" style="max-width:100%;border-radius:10px;margin-bottom:14px">`:''}
      <div style="line-height:1.85;font-size:.9rem">${mdToHtml(postOnly)}</div>
      <button class="copy-btn" style="position:static;margin-top:12px" onclick="copyText(window._toolResults['vp-result'],this)">📋 কপি করুন</button>
      ${imageUrl?`<a class="btn btn-secondary btn-sm" style="margin-top:8px;display:inline-block" href="${imageUrl}" download="viral-post.png">⬇️ ছবি ডাউনলোড</a>`:''}
    </div>`;
  }catch(e){
    el.innerHTML = e.message==='NO_KEY' ? GeminiEngine.noKeyMsg() : R.error(e.message);
  }
}

async function runAiContentStudio(){
  const prompt = reqVal('cs-prompt','ছবির বর্ণনা'); if(!prompt) return;
  const ratio = document.getElementById('cs-ratio').value;
  const fullPrompt = `${prompt}\n\n(Aspect ratio: ${ratio}, high quality, photorealistic)`;
  await runGeminiImage(fullPrompt, [], 'cs-result', 'ai_content_studio', {});
}

async function runWatermarkRemover(){
  const img = reqFile('wr-img','মূল ছবি'); if(!img) return;
  const mask = reqFile('wr-mask','মাস্ক ছবি'); if(!mask) return;
  const prompt = `You are an expert photo editor specializing in inpainting. Given an original image and a corresponding mask image, intelligently and seamlessly remove the parts of the original image indicated by the white areas in the mask. Fill in the removed areas so they blend perfectly with surrounding textures, lighting, and shadows. Output only the edited, clean image.`;
  await runGeminiImage(prompt, [img, mask], 'wr-result', 'watermark_remover', {});
}

async function runGarmentEnhancer(){
  const img = reqFile('ge-img','পোশাকের ছবি'); if(!img) return;
  const notes = document.getElementById('ge-notes').value.trim();
  const prompt = `Enhance this garment/clothing product photo to look professional and high-end — improve lighting, sharpness, and background so it looks like a premium e-commerce studio photo. Keep the garment's exact color, design and details unchanged. ${notes ? 'Additional instructions: '+notes : ''}`;
  await runGeminiImage(prompt, [img], 'ge-result', 'garment_enhancer', {});
}

async function runPhotoshoot(){
  const img = reqFile('ps-img','পণ্যের ছবি'); if(!img) return;
  const scene = document.getElementById('ps-scene').value.trim() || 'clean professional studio background with soft natural lighting';
  const prompt = `Transform this ordinary product photo into a professional product photoshoot image. Scene/background: ${scene}. Keep the product itself exactly the same — only change the background, lighting, and composition to look like a premium commercial photoshoot.`;
  await runGeminiImage(prompt, [img], 'ps-result', 'photoshoot', {});
}

async function runBgRemover(){
  const img = reqFile('bg-img','ছবি'); if(!img) return;
  const prompt = `Remove the background from this image completely and precisely, leaving only the main subject with clean, sharp edges. Output the subject on a plain solid white background.`;
  await runGeminiImage(prompt, [img], 'bg-result', 'bg_remover', {});
}

async function runVirtualTryOn(){
  const model = reqFile('vt-model','মডেলের ছবি'); if(!model) return;
  const garment = reqFile('vt-garment','পোশাকের ছবি'); if(!garment) return;
  const prompt = `Take the person in the first image and realistically dress them in the garment shown in the second image. Keep the person's face, pose, and body exactly the same. Make the garment fit naturally with correct draping, shadows, and lighting matched to the original photo.`;
  await runGeminiImage(prompt, [model, garment], 'vt-result', 'virtual_try_on', {});
}

async function runModelFromGarment(){
  const img = reqFile('mg-img','পোশাকের ছবি'); if(!img) return;
  const type = document.getElementById('mg-type').value;
  const prompt = `Using only this garment image, generate a realistic full-body photo of a ${type} wearing this exact garment in a professional studio setting with clean background and natural lighting. Keep the garment's exact color, pattern, and design unchanged.`;
  await runGeminiImage(prompt, [img], 'mg-result', 'model_from_garment', {});
}

async function runVideoPromptGenerator(){
  const scene = reqVal('vpr-scene','সিন/পণ্যের বর্ণনা'); if(!scene) return;
  const style = document.getElementById('vpr-style').value;
  const prompt = `আপনি একজন এক্সপার্ট AI ভিডিও প্রম্পট রাইটার (Veo/Sora/Kling এর জন্য)। নিচের সিন বর্ণনা থেকে ৩টি ভিন্ন, বিস্তারিত ইংরেজি ভিডিও প্রম্পট তৈরি করুন — প্রতিটিতে camera movement, lighting, mood বর্ণনা থাকবে। স্টাইল: ${style}।\n\nসিন: ${scene}`;
  await runGeminiText(prompt, 'vpr-result', 'video_prompt_generator', {scene});
}

async function runAdFunnelGenerator(){
  const product = reqVal('af-product','পণ্যের নাম'); if(!product) return;
  const budget = document.getElementById('af-budget').value;
  const prompt = `আপনি একজন এক্সপার্ট ফেসবুক অ্যাড ফানেল স্ট্র্যাটেজিস্ট। "${product}" এর জন্য একটি সম্পূর্ণ ৩-ধাপ (Awareness → Consideration → Conversion) বিজ্ঞাপন ফানেল তৈরি করুন। দৈনিক বাজেট: ${budget}। প্রতিটি ধাপে দিন: টার্গেট অডিয়েন্স, অ্যাড ফরম্যাট, হেডলাইন, বিজ্ঞাপনের লেখা, এবং CTA। বাংলায় লিখুন, স্পষ্ট হেডিং দিয়ে সাজান।`;
  await runGeminiText(prompt, 'af-result', 'ad_funnel_generator', {product});
}

async function runPromotionalPostGenerator(){
  const product = reqVal('pp-product','পণ্যের নাম'); if(!product) return;
  const offer = document.getElementById('pp-offer').value;
  const duration = document.getElementById('pp-duration').value;
  const prompt = `"${product}" পণ্যের জন্য একটি জরুরি-অনুভূতি সৃষ্টিকারী প্রচারমূলক ফেসবুক পোস্ট লিখুন। অফার: ${offer}। সময়সীমা: ${duration}। আকর্ষণীয় হুক, স্পষ্ট অফার বিবরণ, urgency তৈরি করা ভাষা, ইমোজি এবং শক্তিশালী CTA সহ বাংলায় লিখুন।`;
  await runGeminiText(prompt, 'pp-result', 'promotional_post_generator', {product});
}

async function runStoryboardGenerator(){
  const topic = reqVal('sb-topic','টপিক'); if(!topic) return;
  const type = document.getElementById('sb-type').value;
  const prompt = `"${topic}" নিয়ে একটি বিজ্ঞাপনের জন্য ৩-দৃশ্যের স্টোরিবোর্ড তৈরি করুন (ধরন: ${type})। প্রতিটি দৃশ্যের জন্য দিন: দৃশ্য নম্বর, সময়কাল, ভিজ্যুয়াল বর্ণনা, ক্যামেরা অ্যাঙ্গেল, এবং সংলাপ/ভয়েসওভার টেক্সট। বাংলায় লিখুন, স্পষ্টভাবে সাজানো।`;
  await runGeminiText(prompt, 'sb-result', 'storyboard_generator', {topic});
}

async function runSubtitleTranslator(){
  const text = reqVal('st-text','টেক্সট'); if(!text) return;
  const from = document.getElementById('st-from').value;
  const to = document.getElementById('st-to').value;
  const prompt = `Translate the following subtitle text from ${from} to ${to}. Keep the tone natural and conversational, suitable for video subtitles. Output only the translated text, nothing else.\n\nText:\n${text}`;
  await runGeminiText(prompt, 'st-result', 'subtitle_translator', {from,to});
}

async function runAiVoiceoverStudio(){
  const text = reqVal('vo-text','স্ক্রিপ্ট'); if(!text) return;
  const voice = document.getElementById('vo-voice').value;
  await runGeminiAudio(text, voice, 'vo-result', 'ai_voiceover_studio', {});
}

async function runConceptArchitect(){
  const idea = reqVal('con-idea','কীওয়ার্ড/আইডিয়া'); if(!idea) return;
  const prompt = `আপনি একজন ক্রিয়েটিভ ডিরেক্টর। নিচের আইডিয়া/কীওয়ার্ড থেকে ৩টি ভিন্ন ভিজ্যুয়াল কনসেপ্ট তৈরি করুন। প্রতিটি কনসেপ্টের জন্য দিন: কনসেপ্টের নাম, সংক্ষিপ্ত বর্ণনা, মুড/টোন, এবং একটি ইংরেজি ইমেজ-জেনারেশন প্রম্পট (Midjourney/Flux স্টাইলে)। বাংলায় বর্ণনা লিখুন, প্রম্পট ইংরেজিতে দিন।\n\nআইডিয়া: ${idea}`;
  await runGeminiText(prompt, 'con-result', 'concept_architect', {idea});
}

async function runVideoScriptGenerator(){
  const topic = reqVal('vs-topic','টপিক/পণ্য'); if(!topic) return;
  const duration = document.getElementById('vs-duration').value;
  const platform = document.getElementById('vs-platform').value;
  const prompt = `"${topic}" নিয়ে ${platform} এর জন্য একটি সম্পূর্ণ ভিডিও মার্কেটিং স্ক্রিপ্ট লিখুন। দৈর্ঘ্য: ${duration}। স্ক্রিপ্টে থাকবে: হুক (প্রথম ৩ সেকেন্ড), সমস্যা তুলে ধরা, সমাধান/পণ্যের পরিচিতি, মূল বেনিফিট, এবং CTA। প্রতিটি অংশে সময় (timestamp) উল্লেখ করুন এবং ভিজ্যুয়াল নির্দেশনাও দিন। বাংলায় লিখুন।`;
  await runGeminiText(prompt, 'vs-result', 'video_script_generator', {topic});
}
