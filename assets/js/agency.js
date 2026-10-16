/* NexoraPilot Agency — Public: Services, Free Consultation, Quote Request
   ডেটা সংরক্ষণ: Firebase Firestore (collections: consultations, quoteRequests, agencyServices, agencySettings)
   Firestore Security Rules ডিপ্লয় না করলে সংরক্ষণ ব্যর্থ হবে — ব্যর্থ হলে গ্রাহককে সত্য বলা হয় ও WhatsApp fallback দেওয়া হয়। */
(function(){
if(window.AG && window.AG.__loaded) return;
var D=window.AGENCY_DEFAULTS, AG=window.AG={__loaded:true,services:[],settings:{whatsapp:D.WHATSAPP},filter:'All'};

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function $(id){return document.getElementById(id);}
function dbReady(){try{return (typeof db!=='undefined'&&db)?db:null;}catch(e){return null;}}
function toast(m,t){try{ if(window.Toast){ (t==='e'?Toast.error:Toast.success).call(Toast,m); return;} }catch(e){} }
function waNum(){return String(AG.settings.whatsapp||D.WHATSAPP).replace(/\D/g,'');}
function waLink(text){return 'https://wa.me/'+waNum()+'?text='+encodeURIComponent(text||'');}
function genId(p){var r=Math.random().toString(36).slice(2,6).toUpperCase();return 'NP-'+p+'-'+Date.now().toString(36).toUpperCase().slice(-5)+r;}
function normPhone(v){var d=String(v||'').replace(/\D/g,'');if(d.indexOf('880')===0)d=d.slice(3);if(d.charAt(0)!=='0')d='0'+d;return /^01[3-9]\d{8}$/.test(d)?'880'+d.slice(1):'';}
function bnPrice(s){return s.priceText||(s.price?('৳'+Number(s.price).toLocaleString('bn-BD')):'Custom Quote');}
function priceLabel(s){
  if(s.price){return (s.startingPrice?'Starting ':'')+'৳'+Number(s.price).toLocaleString('en-US');}
  return s.priceText||'Custom Quote';
}

/* ───────── Data loading ───────── */
AG.load=async function(){
  var d=dbReady(), list=null;
  if(d){
    try{
      var snap=await d.collection('agencyServices').get();
      if(!snap.empty){list=[];snap.forEach(function(x){var v=x.data();v.id=x.id;list.push(v);});}
    }catch(e){console.warn('agencyServices read:',e.message);}
    try{
      var st=await d.collection('agencySettings').doc('main').get();
      if(st.exists&&st.data().whatsapp) AG.settings.whatsapp=st.data().whatsapp;
    }catch(e){}
  }
  AG.services=(list||window.AGENCY_DEFAULT_SERVICES).filter(function(s){return s.active!==false;}).sort(function(a,b){return (a.order||999)-(b.order||999);});
  AG.renderServices(); AG.fillContact();
};
AG.fillContact=function(){
  document.querySelectorAll('[data-ag-wa]').forEach(function(a){a.href=waLink('আসসালামু আলাইকুম, NexoraPilot থেকে যোগাযোগ করছি। আমি আমার ব্যবসার মার্কেটিং নিয়ে জানতে চাই।');a.target='_blank';a.rel='noopener';});
};

/* ───────── Services grid ───────── */
AG.renderServices=function(){
  var box=$('agServices'); if(!box) return;
  var cats=['All'].concat(D.CATS.filter(function(c){return AG.services.some(function(s){return s.category===c;});}));
  var f=$('agFilters'); if(f) f.innerHTML=cats.map(function(c){return '<button class="ag-chip'+(c===AG.filter?' on':'')+'" onclick="AG.setFilter(\''+c.replace(/'/g,'')+'\')">'+(c==='All'?'সব সার্ভিস':esc(c))+'</button>';}).join('');
  var items=AG.services.filter(function(s){return AG.filter==='All'||s.category===AG.filter;});
  if(!items.length){box.innerHTML='<div class="ag-empty">এই মুহূর্তে কোনো সার্ভিস তালিকাভুক্ত নেই। সরাসরি ফ্রি কনসাল্টেশনের অনুরোধ করুন।</div>';return;}
  box.innerHTML=items.map(function(s){
    return '<div class="ag-card'+(s.featured?' feat':'')+'"><div class="ag-ic">'+esc(s.icon||'🧰')+'</div>'
     +'<h3>'+esc(s.name)+'</h3><p>'+esc(s.short)+'</p>'
     +(s.audience?'<div class="ag-meta"><b>কার জন্য:</b> '+esc(s.audience)+'</div>':'')
     +'<ul class="ag-dels">'+(s.deliverables||[]).slice(0,4).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'
     +(s.timeline?'<div class="ag-meta"><b>আনুমানিক সময়:</b> '+esc(s.timeline)+'</div>':'')
     +'<div class="ag-price">'+esc(priceLabel(s))+'</div>'
     +'<div class="ag-row"><button class="btn btn-outline btn-sm" onclick="AG.openService(\''+esc(s.id)+'\')">বিস্তারিত দেখুন</button>'
     +'<button class="btn btn-primary btn-sm" onclick="AG.openQuote(\''+esc(s.id)+'\')">সার্ভিস নিন</button></div></div>';
  }).join('');
};
AG.setFilter=function(c){AG.filter=c;AG.renderServices();};

/* ───────── Modal helpers ───────── */
function modal(id,html){
  var o=$(id); if(!o){o=document.createElement('div');o.id=id;o.className='ag-ov';
    o.addEventListener('click',function(e){if(e.target===o)AG.close(id);});document.body.appendChild(o);}
  o.innerHTML='<div class="ag-box" role="dialog" aria-modal="true"><button class="ag-x" aria-label="বন্ধ করুন" onclick="AG.close(\''+id+'\')">✕</button>'+html+'</div>';
  o.classList.add('open'); document.body.style.overflow='hidden'; o.scrollTop=0;
}
AG.close=function(id){var o=$(id);if(o)o.classList.remove('open');if(!document.querySelector('.ag-ov.open'))document.body.style.overflow='';};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){document.querySelectorAll('.ag-ov.open').forEach(function(o){AG.close(o.id);});}});

function opts(arr,ph){return '<option value="">'+esc(ph||'— নির্বাচন করুন —')+'</option>'+arr.map(function(x){return '<option>'+esc(x)+'</option>';}).join('');}
function userPrefill(){try{return {name:(currentUserData&&currentUserData.name)||'',wa:(currentUserData&&currentUserData.whatsapp)||''};}catch(e){return {name:'',wa:''};}}

/* ───────── Service details ───────── */
AG.openService=function(id){
  var s=AG.services.find(function(x){return x.id===id;}); if(!s) return;
  var li=function(a){return '<ul>'+(a||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';};
  modal('agSvcModal','<div class="ag-det"><div class="ag-ic" style="margin-bottom:10px">'+esc(s.icon||'🧰')+'</div><h3>'+esc(s.name)+'</h3><p class="sub">'+esc(s.short)+'</p>'
   +(s.audience?'<h4>কার জন্য উপযুক্ত</h4><p class="ag-note" style="font-size:.86rem">'+esc(s.audience)+'</p>':'')
   +'<h4>Scope of Work</h4>'+li(s.scope)+'<h4>Deliverables</h4>'+li(s.deliverables)+'<h4>Client Requirements</h4>'+li(s.requirements)
   +'<h4>মূল্য ও সময়</h4><p style="color:#fff;font-size:.9rem">'+esc(priceLabel(s))+(s.timeline?' · '+esc(s.timeline):' · সময়সীমা কোটেশনে নির্ধারিত হবে')+'</p>'
   +((s.faqs&&s.faqs.length)?'<h4>সাধারণ প্রশ্ন</h4>'+s.faqs.map(function(f){return '<details><summary>'+esc(f.q)+'</summary><p style="padding:6px 0">'+esc(f.a)+'</p></details>';}).join(''):'')
   +'<div class="ag-2" style="margin-top:20px"><button class="btn btn-primary" onclick="AG.close(\'agSvcModal\');AG.openQuote(\''+esc(s.id)+'\')">Request a Quote</button>'
   +'<button class="btn btn-outline" onclick="AG.close(\'agSvcModal\');AG.openConsult({service:\''+esc(s.name).replace(/\\/g,'')+'\'})">Book Consultation</button></div>'
   +'<p class="ag-note" style="margin-top:12px">কোটেশন/কনসাল্টেশন অনুরোধ ফ্রি। এটি কোনো সার্ভিস কেনার বাধ্যবাধকতা নয়; ফলাফলের নিশ্চয়তা দেওয়া হয় না।</p></div>');
};

/* ───────── Consultation form ───────── */
AG.openConsult=function(o){
  o=o||{}; var u=userPrefill();
  modal('agConsultModal','<h3>🎯 ফ্রি কনসাল্টেশন</h3><p class="sub">আপনার ব্যবসার অবস্থা জানান। প্রাথমিক Marketing Needs Assessment ও সংক্ষিপ্ত পরামর্শ বিনামূল্যে। দীর্ঘ অডিট, ক্যাম্পেইন ব্যবস্থাপনা ও বাস্তবায়ন আলাদা Paid Service।</p>'
   +'<form id="agCForm" onsubmit="return AG.submitConsult(event)" novalidate>'
   +'<input class="ag-hp" name="website_hp" id="agC_hp" tabindex="-1" autocomplete="off">'
   +'<div class="ag-2"><div class="ag-f"><label>পূর্ণ নাম <i>*</i></label><input class="form-control" id="agC_name" value="'+esc(u.name)+'" maxlength="80" autocomplete="name"></div>'
   +'<div class="ag-f"><label>WhatsApp নম্বর <i>*</i></label><input class="form-control" id="agC_wa" type="tel" value="'+esc(u.wa)+'" placeholder="01XXXXXXXXX" maxlength="20" autocomplete="tel"></div></div>'
   +'<div class="ag-2"><div class="ag-f"><label>Business Name</label><input class="form-control" id="agC_bn" maxlength="100"></div>'
   +'<div class="ag-f"><label>Business Type</label><select class="form-control" id="agC_bt">'+opts(D.BUSINESS_TYPES)+'</select></div></div>'
   +'<div class="ag-f"><label>Business Stage</label><select class="form-control" id="agC_st">'+opts(D.STAGES)+'</select></div>'
   +'<div class="ag-f"><label>প্রধান সমস্যা (একাধিক নির্বাচন করা যাবে) <i>*</i></label><div class="ag-checks" id="agC_pr">'+D.PROBLEMS.map(function(p,i){return '<label><input type="checkbox" value="'+esc(p)+'"> '+esc(p)+'</label>';}).join('')+'</div></div>'
   +'<div class="ag-f"><label>Website বা Facebook Page URL</label><input class="form-control" id="agC_url" type="url" inputmode="url" maxlength="300" placeholder="https://"></div>'
   +'<div class="ag-2"><div class="ag-f"><label>মাসিক Advertising Budget</label><select class="form-control" id="agC_bd">'+opts(D.BUDGETS)+'</select></div>'
   +'<div class="ag-f"><label>যোগাযোগের মাধ্যম</label><select class="form-control" id="agC_pf">'+opts(D.PREFS)+'</select></div></div>'
   +'<div class="ag-f"><label>পছন্দের তারিখ/সময় (অনুরোধ মাত্র — নিশ্চিত নয়)</label><input class="form-control" id="agC_dt" maxlength="120" placeholder="যেমন: শনিবার সন্ধ্যা ৭টার পর"></div>'
   +'<div class="ag-f"><label>অতিরিক্ত তথ্য</label><textarea class="form-control" id="agC_dtl" rows="3" maxlength="1200">'+esc(o.service?('আগ্রহী সার্ভিস: '+o.service):(o.agency?'Agency Partner প্ল্যান সম্পর্কে জানতে চাই।':''))+'</textarea></div>'
   +'<label style="display:flex;gap:10px;align-items:flex-start;font-size:.8rem;color:var(--text2);line-height:1.6;margin-bottom:12px;cursor:pointer"><input type="checkbox" id="agC_ok" style="width:20px;height:20px;min-height:0;margin-top:2px;flex-shrink:0;accent-color:#00f5d4"><span><b style="color:#cbd5e1">গোপনীয়তা:</b> আমার দেওয়া তথ্য শুধু আমার এই অনুরোধের উত্তর ও পরামর্শ দেওয়ার জন্য ব্যবহারে সম্মতি দিচ্ছি। আমার আলাদা সম্মতি ছাড়া প্রচারমূলক বার্তা পাঠানো হবে না।</span></label>'
   +'<div class="ag-err" id="agC_err"></div>'
   +'<button class="btn btn-primary btn-full" id="agC_btn" type="submit">📨 অনুরোধ পাঠান</button></form>');
};
function checked(id){return Array.prototype.map.call(document.querySelectorAll('#'+id+' input:checked'),function(i){return i.value;});}
function showErr(id,m){var e=$(id);if(e){e.textContent=m;e.style.display=m?'block':'none';}}
function recentDup(key){try{var v=JSON.parse(sessionStorage.getItem('ag_last_'+key)||'null');if(v&&Date.now()-v.t<10*60*1000)return v;}catch(e){}return null;}
function markSent(key,id){try{sessionStorage.setItem('ag_last_'+key,JSON.stringify({t:Date.now(),id:id}));}catch(e){}}

AG.submitConsult=async function(ev){
  if(ev)ev.preventDefault();
  if(AG._busyC) return false;
  if($('agC_hp').value) return false;
  var name=$('agC_name').value.trim(), wa=normPhone($('agC_wa').value), probs=checked('agC_pr'), url=$('agC_url').value.trim();
  if(name.length<2) return showErr('agC_err','আপনার পূর্ণ নাম লিখুন'),false;
  if(!wa) return showErr('agC_err','সঠিক WhatsApp নম্বর দিন (যেমন 01XXXXXXXXX)'),false;
  if(!probs.length) return showErr('agC_err','কমপক্ষে একটি সমস্যা নির্বাচন করুন'),false;
  if(url&&!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)) return showErr('agC_err','URL সঠিক নয় (https:// দিয়ে শুরু করুন) অথবা ফাঁকা রাখুন'),false;
  if(!$('agC_ok').checked) return showErr('agC_err','গোপনীয়তা নীতিতে সম্মতি দিন'),false;
  showErr('agC_err','');
  var dup=recentDup('c_'+wa);
  if(dup){AG.showConsultDone(dup.id,name,true);return false;}
  var id=genId('C'), now=new Date().toISOString();
  var rec={bookingId:id,name:name,whatsapp:wa,businessName:$('agC_bn').value.trim(),businessType:$('agC_bt').value,businessStage:$('agC_st').value,
    problems:probs,url:url,budget:$('agC_bd').value,preference:$('agC_pf').value,preferredTime:$('agC_dt').value.trim(),details:$('agC_dtl').value.trim(),
    consent:true,status:'Pending',source:'website',createdAtISO:now,uid:(typeof currentUser!=='undefined'&&currentUser)?currentUser.uid:null};
  AG._busyC=true; var b=$('agC_btn'); b.disabled=true; b.textContent='⏳ পাঠানো হচ্ছে...';
  try{
    var d=dbReady(); if(!d) throw new Error('ডেটাবেস সংযুক্ত নয়');
    rec.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    await d.collection('consultations').doc(id).set(rec);
    markSent('c_'+wa,id); AG.showConsultDone(id,name,false);
  }catch(e){
    console.error('consult save',e);
    AG._busyC=false; b.disabled=false; b.textContent='📨 অনুরোধ পাঠান';
    var msg='আসসালামু আলাইকুম, ফ্রি কনসাল্টেশন চাই।\nনাম: '+name+'\nWhatsApp: '+wa+'\nব্যবসা: '+(rec.businessName||'-')+'\nসমস্যা: '+probs.join(', ')+'\nBudget: '+(rec.budget||'-');
    var err=$('agC_err'); err.style.display='block';
    err.innerHTML='⚠️ দুঃখিত, অনুরোধটি সার্ভারে সংরক্ষণ করা যায়নি, তাই এটি জমা হয়েছে বলে ধরা হচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন অথবা সরাসরি WhatsApp-এ জানান: <a href="'+waLink(msg)+'" target="_blank" rel="noopener" style="color:#25D366;font-weight:800">📲 WhatsApp-এ পাঠান</a>';
  }
  AG._busyC=false; return false;
};
AG.showConsultDone=function(id,name,dup){
  var msg='আসসালামু আলাইকুম, আমি '+name+'। ফ্রি কনসাল্টেশনের অনুরোধ করেছি। Booking ID: '+id;
  modal('agConsultModal','<div class="ag-ok"><div class="big">✅</div><h3 style="margin:8px 0">'+(dup?'আপনার অনুরোধ আগেই গ্রহণ করা হয়েছে':'অনুরোধ গ্রহণ করা হয়েছে')+'</h3>'
   +'<div class="ag-bid">'+esc(id)+'</div><div class="ag-note">Booking ID সংরক্ষণ করে রাখুন</div>'
   +'<p style="color:var(--text2);font-size:.88rem;line-height:1.7;margin:14px 0">অবস্থা: <b style="color:var(--a3)">Pending</b>। আমরা আপনার অনুরোধ দেখে নির্বাচিত মাধ্যমে যোগাযোগ করব। সময় নিশ্চিত না হওয়া পর্যন্ত এটি Appointment Confirmed নয়।</p>'
   +'<a class="btn btn-primary btn-full" style="background:linear-gradient(135deg,#25D366,#128C7E)" target="_blank" rel="noopener" href="'+waLink(msg)+'">📲 WhatsApp-এ যোগাযোগ করুন</a>'
   +'<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="AG.close(\'agConsultModal\')">বন্ধ করুন</button></div>');
};

/* ───────── Quote request ───────── */
AG.openQuote=function(id){
  var u=userPrefill(); var sel=AG.services.find(function(s){return s.id===id;});
  modal('agQuoteModal','<h3>📝 কোটেশনের অনুরোধ</h3><p class="sub">কোটেশন অনুরোধ বিনামূল্যে এবং এটি কিছু কেনার বাধ্যবাধকতা তৈরি করে না। আপনার প্রয়োজন দেখে কাস্টম কোটেশন দেওয়া হবে।</p>'
   +'<form onsubmit="return AG.submitQuote(event)" novalidate><input class="ag-hp" id="agQ_hp" tabindex="-1" autocomplete="off">'
   +'<div class="ag-2"><div class="ag-f"><label>নাম <i>*</i></label><input class="form-control" id="agQ_name" value="'+esc(u.name)+'" maxlength="80"></div>'
   +'<div class="ag-f"><label>WhatsApp নম্বর <i>*</i></label><input class="form-control" id="agQ_wa" type="tel" value="'+esc(u.wa)+'" placeholder="01XXXXXXXXX" maxlength="20"></div></div>'
   +'<div class="ag-f"><label>নির্বাচিত সার্ভিস <i>*</i></label><select class="form-control" id="agQ_svc">'+opts(AG.services.map(function(s){return s.name;}),'— সার্ভিস নির্বাচন —')+'</select></div>'
   +'<div class="ag-2"><div class="ag-f"><label>Website/Store URL</label><input class="form-control" id="agQ_web" maxlength="300" placeholder="https://"></div>'
   +'<div class="ag-f"><label>Facebook Page URL</label><input class="form-control" id="agQ_fb" maxlength="300" placeholder="https://facebook.com/..."></div></div>'
   +'<div class="ag-f"><label>মাসিক Ad Budget</label><select class="form-control" id="agQ_bd">'+opts(D.BUDGETS)+'</select></div>'
   +'<div class="ag-f"><label>ব্যবসার লক্ষ্য</label><textarea class="form-control" id="agQ_goal" rows="2" maxlength="600"></textarea></div>'
   +'<div class="ag-f"><label>বর্তমান সমস্যা <i>*</i></label><textarea class="form-control" id="agQ_prob" rows="3" maxlength="900"></textarea></div>'
   +'<div class="ag-f"><label>অতিরিক্ত নোট</label><textarea class="form-control" id="agQ_note" rows="2" maxlength="600"></textarea></div>'
   +'<label style="display:flex;gap:10px;align-items:flex-start;font-size:.8rem;color:var(--text2);line-height:1.6;margin-bottom:12px;cursor:pointer"><input type="checkbox" id="agQ_ok" style="width:20px;height:20px;min-height:0;margin-top:2px;flex-shrink:0;accent-color:#00f5d4"><span>আমার তথ্য শুধু এই কোটেশনের উত্তর দেওয়ার জন্য ব্যবহারে সম্মতি দিচ্ছি।</span></label>'
   +'<div class="ag-err" id="agQ_err"></div><button class="btn btn-primary btn-full" id="agQ_btn" type="submit">📨 কোটেশন চাই</button></form>');
  if(sel) $('agQ_svc').value=sel.name;
};
AG.submitQuote=async function(ev){
  if(ev)ev.preventDefault(); if(AG._busyQ) return false; if($('agQ_hp').value) return false;
  var name=$('agQ_name').value.trim(), wa=normPhone($('agQ_wa').value), svc=$('agQ_svc').value, prob=$('agQ_prob').value.trim();
  if(name.length<2) return showErr('agQ_err','নাম লিখুন'),false;
  if(!wa) return showErr('agQ_err','সঠিক WhatsApp নম্বর দিন'),false;
  if(!svc) return showErr('agQ_err','একটি সার্ভিস নির্বাচন করুন'),false;
  if(prob.length<5) return showErr('agQ_err','আপনার বর্তমান সমস্যা সংক্ষেপে লিখুন'),false;
  if(!$('agQ_ok').checked) return showErr('agQ_err','সম্মতি দিন'),false;
  showErr('agQ_err','');
  var key='q_'+wa+'_'+svc, dup=recentDup(key);
  if(dup){AG.showQuoteDone(dup.id,name,true);return false;}
  var id=genId('Q'), rec={requestId:id,name:name,whatsapp:wa,service:svc,website:$('agQ_web').value.trim(),facebook:$('agQ_fb').value.trim(),
    budget:$('agQ_bd').value,goal:$('agQ_goal').value.trim(),problem:prob,notes:$('agQ_note').value.trim(),consent:true,status:'Pending',source:'website',
    createdAtISO:new Date().toISOString(),uid:(typeof currentUser!=='undefined'&&currentUser)?currentUser.uid:null};
  AG._busyQ=true; var b=$('agQ_btn'); b.disabled=true; b.textContent='⏳ পাঠানো হচ্ছে...';
  try{
    var d=dbReady(); if(!d) throw new Error('ডেটাবেস সংযুক্ত নয়');
    rec.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    await d.collection('quoteRequests').doc(id).set(rec);
    markSent(key,id); AG.showQuoteDone(id,name,false);
  }catch(e){
    console.error('quote save',e); b.disabled=false; b.textContent='📨 কোটেশন চাই';
    var msg='আসসালামু আলাইকুম, "'+svc+'" সার্ভিসের কোটেশন চাই।\nনাম: '+name+'\nWhatsApp: '+wa+'\nসমস্যা: '+prob;
    var err=$('agQ_err'); err.style.display='block';
    err.innerHTML='⚠️ অনুরোধটি সার্ভারে সংরক্ষণ করা যায়নি, তাই জমা হয়েছে বলে ধরা হচ্ছে না। আবার চেষ্টা করুন অথবা <a href="'+waLink(msg)+'" target="_blank" rel="noopener" style="color:#25D366;font-weight:800">📲 WhatsApp-এ পাঠান</a>।';
  }
  AG._busyQ=false; return false;
};
AG.showQuoteDone=function(id,name,dup){
  modal('agQuoteModal','<div class="ag-ok"><div class="big">✅</div><h3 style="margin:8px 0">'+(dup?'অনুরোধ আগেই গ্রহণ করা হয়েছে':'কোটেশনের অনুরোধ গ্রহণ করা হয়েছে')+'</h3><div class="ag-bid">'+esc(id)+'</div>'
   +'<p style="color:var(--text2);font-size:.88rem;line-height:1.7;margin:14px 0">অবস্থা: <b style="color:var(--a3)">Pending</b>। আপনার অনুরোধ পর্যালোচনা করে কাস্টম কোটেশন WhatsApp-এ জানানো হবে। এখনো কোনো পেমেন্ট প্রয়োজন নেই।</p>'
   +'<a class="btn btn-primary btn-full" style="background:linear-gradient(135deg,#25D366,#128C7E)" target="_blank" rel="noopener" href="'+waLink('আসসালামু আলাইকুম, আমি '+name+'। কোটেশনের অনুরোধ করেছি। Request ID: '+id)+'">📲 WhatsApp-এ জানান</a>'
   +'<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="AG.close(\'agQuoteModal\')">বন্ধ করুন</button></div>');
};

/* Hash deep-links: #consultation → open form */
function boot(){
  AG.renderServices(); AG.fillContact(); AG.load();
  if(location.hash==='#consult-form') setTimeout(function(){AG.openConsult();},500);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
/* db তৈরি হওয়ার পর আবার লোড (Firebase দেরিতে init হলে) */
setTimeout(function(){if(dbReady()&&!AG._reloaded){AG._reloaded=true;AG.load();}},1800);
})();
