/* NexoraPilot Admin — Agency Management (Consultations, Quotes, Services, Leads/Clients, Settings)
   Firestore collections: consultations, quoteRequests, agencyServices, agencyLeads, agencySettings
   প্রকৃত সুরক্ষা Firestore Security Rules দিয়ে — Admin → Agency Settings পেজে নিয়মগুলো দেওয়া আছে। */
(function(){
if(window.AGA) return;
var D=window.AGENCY_DEFAULTS;
var AGA=window.AGA={c:[],q:[],s:[],l:{},loaded:false};
var CSTAT=['Pending','Contacted','Scheduled','Completed','Cancelled'];
var QSTAT=['Pending','Quoted','Accepted','Rejected','Closed'];
var LSTAT=['New','Contacted','Qualified','Client','Lost'];
var COL={Pending:'#f59e0b',Contacted:'#60a5fa',Scheduled:'#a78bfa',Completed:'#34d399',Cancelled:'#f87171',Quoted:'#60a5fa',Accepted:'#34d399',Rejected:'#f87171',Closed:'#94a3b8',New:'#f59e0b',Qualified:'#a78bfa',Client:'#34d399',Lost:'#f87171'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function $(i){return document.getElementById(i);}
function T(m,e){m=String(m).replace(/^✅\s*/,'');try{e?Toast.error(m):Toast.success(m);}catch(x){alert(m);}}
function fdt(iso){try{return new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return '—';}}
function badge(s){var c=COL[s]||'#94a3b8';return '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:800;background:'+c+'22;color:'+c+';border:1px solid '+c+'55">'+esc(s||'—')+'</span>';}
function waTo(phone,text){return 'https://wa.me/'+String(phone||'').replace(/\D/g,'')+'?text='+encodeURIComponent(text||'');}
function sel(arr,v){return arr.map(function(x){return '<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>';}).join('');}
function lines(v){return String(v||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);}
function fld(label,html){return '<div class="ag-f"><label>'+label+'</label>'+html+'</div>';}
function ov(id,html){var o=$(id);if(!o){o=document.createElement('div');o.id=id;o.className='ag-ov';o.addEventListener('mousedown',function(e){if(e.target===o)AGA.close(id);});document.body.appendChild(o);}
  o.innerHTML='<div class="ag-box" style="max-width:760px"><button class="ag-x" onclick="AGA.close(\''+id+'\')">✕</button>'+html+'</div>';o.classList.add('open');}
AGA.close=function(id){var o=$(id);if(o)o.classList.remove('open');};

/* ───── DOM injection ───── */
function inject(){
  var settingsBtn=document.querySelector('.sidebar-link[data-page="settings"]'); if(!settingsBtn||$('page-ag_overview')) return;
  var nav=settingsBtn.parentElement, secs=nav.querySelectorAll('.sidebar-section'), sysSec=null;
  secs.forEach(function(s){if(/System/i.test(s.textContent))sysSec=s;});
  var h='<div class="sidebar-section">Agency</div>'
   +[['ag_overview','🏢','Agency Overview',''],['ag_consult','🎯','Consultations','sb-agc'],['ag_quotes','📝','Quotations','sb-agq'],['ag_services','🧰','Services',''],['ag_leads','🧲','Leads & Clients',''],['ag_settings','⚙️','Agency Settings','']].map(function(x){
     return '<button class="sidebar-link" data-page="'+x[0]+'" onclick="showPage(\''+x[0]+'\',this)"><span class="s-icon">'+x[1]+'</span> '+x[2]+(x[3]?' <span class="s-badge" id="'+x[3]+'">0</span>':'')+'</button>';}).join('');
  var tmp=document.createElement('div'); tmp.innerHTML=h;
  while(tmp.firstChild) nav.insertBefore(tmp.firstChild, sysSec||settingsBtn);
  var main=document.querySelector('main.main-content');
  var pages={
   ag_overview:'<div class="admin-header"><div><div class="page-title">🏢 Agency Overview</div><div class="page-subtitle">Consultation, Quotation ও Client-এর সারসংক্ষেপ</div></div><button class="btn btn-sm btn-secondary" onclick="AGA.reload()">🔄 Refresh</button></div><div id="ag_ov_body"></div>',
   ag_consult:'<div class="admin-header"><div><div class="page-title">🎯 Consultation Requests</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="form-control" id="agcSearch" placeholder="নাম/ফোন খুঁজুন" oninput="AGA.rc()" style="width:180px;padding:8px 12px"><select class="form-control" id="agcFilter" onchange="AGA.rc()" style="width:auto;padding:8px 12px"><option value="">সব Status</option>'+CSTAT.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select></div></div><div class="table-card"><div id="agcTable" style="overflow-x:auto"></div></div>',
   ag_quotes:'<div class="admin-header"><div><div class="page-title">📝 Quotation Requests</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="form-control" id="agqSearch" placeholder="নাম/ফোন/সার্ভিস" oninput="AGA.rq()" style="width:180px;padding:8px 12px"><select class="form-control" id="agqFilter" onchange="AGA.rq()" style="width:auto;padding:8px 12px"><option value="">সব Status</option>'+QSTAT.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select></div></div><div class="table-card"><div id="agqTable" style="overflow-x:auto"></div></div>',
   ag_services:'<div class="admin-header"><div><div class="page-title">🧰 Service Management</div><div class="page-subtitle">এখানে বদলালে ওয়েবসাইটে সাথে সাথে বদলে যাবে</div></div><button class="btn btn-sm btn-primary" onclick="AGA.editService()">➕ নতুন Service</button></div><div id="agsNote"></div><div class="table-card"><div id="agsTable" style="overflow-x:auto"></div></div>',
   ag_leads:'<div class="admin-header"><div><div class="page-title">🧲 Leads & Clients</div><div class="page-subtitle">Consultation ও Quote অনুরোধ থেকে স্বয়ংক্রিয়ভাবে তৈরি</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="form-control" id="aglSearch" placeholder="খুঁজুন" oninput="AGA.rl()" style="width:160px;padding:8px 12px"><select class="form-control" id="aglFilter" onchange="AGA.rl()" style="width:auto;padding:8px 12px"><option value="">সব</option>'+LSTAT.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select></div></div><div class="table-card"><div id="aglTable" style="overflow-x:auto"></div></div>',
   ag_settings:'<div class="admin-header"><div><div class="page-title">⚙️ Agency Settings</div></div></div><div id="ag_set_body"></div>'
  };
  Object.keys(pages).forEach(function(k){var d=document.createElement('div');d.id='page-'+k;d.className='hidden';d.innerHTML=pages[k];main.appendChild(d);});
}

/* ───── Data ───── */
function dbq(){return db.collection.apply(db,arguments);}
AGA.reload=async function(){
  var err='';
  async function get(name){try{var sn=await db.collection(name).get(),a=[];sn.forEach(function(d){var v=d.data();v._id=d.id;a.push(v);});return a;}catch(e){err=e.message;return null;}}
  var c=await get('consultations'),q=await get('quoteRequests'),s=await get('agencyServices'),l=await get('agencyLeads');
  AGA.err=err; AGA.c=(c||[]).sort(byDate); AGA.q=(q||[]).sort(byDate); AGA.s=s||[]; AGA.l={}; (l||[]).forEach(function(x){AGA.l[x._id]=x;}); AGA.loaded=true;
  badges(); return err;
};
function byDate(a,b){return String(b.createdAtISO||'').localeCompare(String(a.createdAtISO||''));}
function badges(){var a=$('sb-agc'),b=$('sb-agq');if(a)a.textContent=AGA.c.filter(function(x){return x.status==='Pending';}).length;if(b)b.textContent=AGA.q.filter(function(x){return x.status==='Pending';}).length;}
function errBox(){return AGA.err?'<div class="alert alert-error" style="margin-bottom:14px;line-height:1.6">⚠️ ডেটা পড়তে সমস্যা: <b>'+esc(AGA.err)+'</b><br>সম্ভবত Firestore Security Rules এখনো ডিপ্লয় হয়নি। <b>Agency Settings</b> পেজে প্রয়োজনীয় Rules দেওয়া আছে — Firebase Console → Firestore → Rules-এ বসিয়ে Publish করুন।</div>':'';}
AGA.show=async function(name){
  if(!AGA.loaded){var m=$('page-'+name);if(m)m.insertAdjacentHTML('afterbegin','<div id="ag_loading" style="padding:10px;color:var(--text2)">⏳ লোড হচ্ছে...</div>');await AGA.reload();var l=$('ag_loading');if(l)l.remove();}
  ({ag_overview:AGA.ro,ag_consult:AGA.rc,ag_quotes:AGA.rq,ag_services:AGA.rs,ag_leads:AGA.rl,ag_settings:AGA.rset}[name]||function(){})();
};

/* ───── Overview ───── */
AGA.ro=function(){
  var c=AGA.c,q=AGA.q,L=leadList();
  var n=function(v,l,cl){return '<div class="stat-card"><div class="stat-num '+(cl||'')+'">'+v+'</div><div class="stat-label">'+l+'</div></div>';};
  $('ag_ov_body').innerHTML=errBox()+'<div class="stats-grid">'
   +n(c.length,'Total Consultation Requests','mint')+n(c.filter(function(x){return x.status==='Pending';}).length,'Pending Consultations','amber')
   +n(c.filter(function(x){return x.status==='Scheduled';}).length,'Confirmed (Scheduled) Appointments','violet')+n(q.length,'Total Service Inquiries','mint')
   +n(q.filter(function(x){return x.status==='Pending';}).length,'Pending Quotations','amber')+n(q.filter(function(x){return x.status==='Accepted';}).length,'Accepted Quotations','mint')
   +n(L.filter(function(x){return x.clientStatus==='Active';}).length,'Active Clients','violet')+n(L.filter(function(x){return x.clientStatus==='Completed';}).length,'Completed Projects','mint')+'</div>'
   +'<div class="table-card" style="margin-top:18px;padding:16px"><b style="color:#fff">সাম্প্রতিক Consultation</b><div style="margin-top:8px">'+(c.slice(0,5).map(function(x){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem;cursor:pointer" onclick="AGA.viewC(\''+esc(x._id)+'\')"><span>'+esc(x.name)+' · '+esc((x.problems||[]).slice(0,2).join(', '))+'</span>'+badge(x.status)+'</div>';}).join('')||'<div style="color:var(--text2);padding:8px 0">এখনো কোনো অনুরোধ নেই</div>')+'</div></div>';
};

/* ───── Consultations ───── */
AGA.rc=function(){
  var s=($('agcSearch')||{}).value||'',f=($('agcFilter')||{}).value||''; s=s.toLowerCase();
  var rows=AGA.c.filter(function(x){return (!f||x.status===f)&&(!s||(x.name||'').toLowerCase().indexOf(s)>-1||String(x.whatsapp||'').indexOf(s.replace(/\D/g,'')||'§')>-1);});
  $('agcTable').innerHTML=errBox()+(rows.length?'<table><thead><tr><th>Booking ID</th><th>নাম</th><th>WhatsApp</th><th>সমস্যা</th><th>তারিখ</th><th>Status</th><th></th></tr></thead><tbody>'
   +rows.map(function(x){return '<tr><td style="font-family:monospace;font-size:.75rem">'+esc(x._id)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.whatsapp)+'</td><td style="max-width:240px;font-size:.8rem">'+esc((x.problems||[]).join(', '))+'</td><td style="font-size:.78rem">'+fdt(x.createdAtISO)+'</td><td>'+badge(x.status)+'</td><td><button class="btn btn-sm btn-secondary" onclick="AGA.viewC(\''+esc(x._id)+'\')">দেখুন</button></td></tr>';}).join('')+'</tbody></table>':'<div style="padding:24px;text-align:center;color:var(--text2)">কোনো অনুরোধ নেই</div>');
};
AGA.viewC=function(id){
  var x=AGA.c.find(function(r){return r._id===id;}); if(!x) return; var r=x.recs||{};
  var row=function(k,v){return v?'<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem"><span style="min-width:130px;color:var(--text2)">'+k+'</span><span style="color:#fff;word-break:break-word">'+v+'</span></div>':'';};
  ov('agcModal','<h3>🎯 '+esc(x.name)+' <span style="font-family:monospace;font-size:.75rem;color:var(--text2)">'+esc(x._id)+'</span></h3><div style="margin:10px 0">'
   +row('WhatsApp',esc(x.whatsapp))+row('Business',esc(x.businessName))+row('Type',esc(x.businessType))+row('Stage',esc(x.businessStage))+row('সমস্যা',esc((x.problems||[]).join(', ')))
   +row('URL',x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener" style="color:var(--a1)">'+esc(x.url)+'</a>':'')+row('Budget',esc(x.budget))+row('যোগাযোগ',esc(x.preference))+row('পছন্দের সময়',esc(x.preferredTime))+row('বিবরণ',esc(x.details))+row('জমা',fdt(x.createdAtISO))+'</div>'
   +'<div class="ag-2">'+fld('Status','<select class="form-control" id="agcm_st">'+sel(CSTAT,x.status)+'</select>')+fld('Follow-up তারিখ','<input type="date" class="form-control" id="agcm_fu" value="'+esc(x.followUp||'')+'">')+'</div>'
   +fld('Internal Notes (গ্রাহক দেখবে না)','<textarea class="form-control" id="agcm_nt" rows="2">'+esc(x.notes||'')+'</textarea>')
   +fld('Consultation Summary','<textarea class="form-control" id="agcm_sm" rows="3">'+esc(x.summary||'')+'</textarea>')
   +'<b style="color:var(--a1);font-size:.85rem">Recommendation</b><div style="margin-top:8px">'+fld('Immediate Priority','<input class="form-control" id="agcm_r1" value="'+esc(r.priority||'')+'">')+fld('Recommended Service','<input class="form-control" id="agcm_r2" value="'+esc(r.service||'')+'">')+fld('Optional Future Improvement','<input class="form-control" id="agcm_r3" value="'+esc(r.future||'')+'">')+'</div>'
   +'<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="AGA.saveC(\''+esc(id)+'\')">💾 Save</button>'
   +'<a class="btn btn-secondary" target="_blank" rel="noopener" href="'+waTo(x.whatsapp,'আসসালামু আলাইকুম '+x.name+', NexoraPilot-এ আপনার ফ্রি কনসাল্টেশন অনুরোধ (ID: '+x._id+') পেয়েছি।')+'">📲 WhatsApp</a>'
   +'<button class="btn btn-secondary" onclick="AGA.toLead(\''+esc(x.whatsapp)+'\',\''+esc(x.name).replace(/\\/g,'')+'\',\'Consultation\')">🧲 Lead-এ যোগ</button></div>');
};
AGA.saveC=async function(id){
  var u={status:$('agcm_st').value,followUp:$('agcm_fu').value,notes:$('agcm_nt').value,summary:$('agcm_sm').value,recs:{priority:$('agcm_r1').value,service:$('agcm_r2').value,future:$('agcm_r3').value},updatedAtISO:new Date().toISOString()};
  try{await db.collection('consultations').doc(id).update(u);var x=AGA.c.find(function(r){return r._id===id;});Object.assign(x,u);T('✅ সংরক্ষিত');AGA.close('agcModal');badges();AGA.rc();}catch(e){T('সংরক্ষণ ব্যর্থ: '+e.message,1);}
};

/* ───── Quotes ───── */
AGA.rq=function(){
  var s=(($('agqSearch')||{}).value||'').toLowerCase(),f=($('agqFilter')||{}).value||'';
  var rows=AGA.q.filter(function(x){return (!f||x.status===f)&&(!s||(x.name||'').toLowerCase().indexOf(s)>-1||(x.service||'').toLowerCase().indexOf(s)>-1||String(x.whatsapp||'').indexOf(s.replace(/\D/g,'')||'§')>-1);});
  $('agqTable').innerHTML=errBox()+(rows.length?'<table><thead><tr><th>Request ID</th><th>নাম</th><th>Service</th><th>Budget</th><th>তারিখ</th><th>Status</th><th></th></tr></thead><tbody>'
   +rows.map(function(x){return '<tr><td style="font-family:monospace;font-size:.75rem">'+esc(x._id)+'</td><td>'+esc(x.name)+'<div style="font-size:.74rem;color:var(--text2)">'+esc(x.whatsapp)+'</div></td><td style="font-size:.82rem">'+esc(x.service)+'</td><td style="font-size:.78rem">'+esc(x.budget)+'</td><td style="font-size:.78rem">'+fdt(x.createdAtISO)+'</td><td>'+badge(x.status)+'</td><td><button class="btn btn-sm btn-secondary" onclick="AGA.viewQ(\''+esc(x._id)+'\')">দেখুন</button></td></tr>';}).join('')+'</tbody></table>':'<div style="padding:24px;text-align:center;color:var(--text2)">কোনো অনুরোধ নেই</div>');
};
AGA.viewQ=function(id){
  var x=AGA.q.find(function(r){return r._id===id;}); if(!x) return; var q=x.quote||{};
  var row=function(k,v){return v?'<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem"><span style="min-width:120px;color:var(--text2)">'+k+'</span><span style="color:#fff;word-break:break-word">'+v+'</span></div>':'';};
  ov('agqModal','<h3>📝 '+esc(x.service)+' <span style="font-family:monospace;font-size:.75rem;color:var(--text2)">'+esc(x._id)+'</span></h3><div style="margin:10px 0">'
   +row('নাম',esc(x.name))+row('WhatsApp',esc(x.whatsapp))+row('Website',esc(x.website))+row('Facebook',esc(x.facebook))+row('Budget',esc(x.budget))+row('লক্ষ্য',esc(x.goal))+row('সমস্যা',esc(x.problem))+row('নোট',esc(x.notes))+row('জমা',fdt(x.createdAtISO))+'</div>'
   +'<b style="color:var(--a1);font-size:.85rem">Custom Quotation</b><div style="margin-top:8px">'
   +fld('Service Scope (প্রতি লাইনে একটি)','<textarea class="form-control" id="agqm_sc" rows="4">'+esc(q.scope||'')+'</textarea>')
   +'<div class="ag-2">'+fld('মূল্য (৳ / ব্যাখ্যাসহ লিখুন)','<input class="form-control" id="agqm_pr" value="'+esc(q.price||'')+'" placeholder="যেমন: ৳৮,০০০ (এককালীন)">')+fld('Delivery Timeline','<input class="form-control" id="agqm_tl" value="'+esc(q.timeline||'')+'">')+'</div>'
   +'<div class="ag-2">'+fld('Quote মেয়াদ (Expiry)','<input type="date" class="form-control" id="agqm_ex" value="'+esc(q.expiry||'')+'">')+fld('Status','<select class="form-control" id="agqm_st">'+sel(QSTAT,x.status)+'</select>')+'</div>'
   +fld('Internal Notes','<textarea class="form-control" id="agqm_nt" rows="2">'+esc(x.notes_admin||'')+'</textarea>')+'</div>'
   +'<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="AGA.saveQ(\''+esc(id)+'\')">💾 Save</button>'
   +'<button class="btn btn-secondary" onclick="AGA.sendQ(\''+esc(id)+'\')" style="color:#25D366">📲 কোটেশন WhatsApp-এ পাঠান</button>'
   +'<button class="btn btn-secondary" onclick="AGA.toLead(\''+esc(x.whatsapp)+'\',\''+esc(x.name).replace(/\\/g,'')+'\',\'Quotation\')">🧲 Lead-এ যোগ</button></div>'
   +'<p class="ag-note" style="margin-top:10px">গ্রাহক Accept/Reject WhatsApp-এ জানালে এখানে Status নিজে আপডেট করুন। (গ্রাহকের নিজে Accept/Reject করার অনলাইন সুবিধা এখনো নেই; পেমেন্ট সিস্টেমও সংযুক্ত নয়।)</p>');
};
function qData(){return {scope:$('agqm_sc').value,price:$('agqm_pr').value.trim(),timeline:$('agqm_tl').value.trim(),expiry:$('agqm_ex').value};}
AGA.saveQ=async function(id){
  var quote=qData(),u={quote:quote,status:$('agqm_st').value,notes_admin:$('agqm_nt').value,updatedAtISO:new Date().toISOString()};
  if(u.status==='Pending'&&(quote.price||quote.scope)) u.status='Quoted';
  try{await db.collection('quoteRequests').doc(id).update(u);var x=AGA.q.find(function(r){return r._id===id;});Object.assign(x,u);T('✅ সংরক্ষিত');AGA.close('agqModal');badges();AGA.rq();}catch(e){T('সংরক্ষণ ব্যর্থ: '+e.message,1);}
};
AGA.sendQ=function(id){
  var x=AGA.q.find(function(r){return r._id===id;}),q=qData();
  if(!q.price&&!q.scope) return T('আগে Scope ও মূল্য লিখুন',1);
  var t='আসসালামু আলাইকুম '+x.name+',\nআপনার কোটেশন অনুরোধ (ID: '+x._id+') — "'+x.service+'"\n\n📌 Scope:\n'+lines(q.scope).map(function(l){return '• '+l;}).join('\n')+'\n\n💰 মূল্য: '+(q.price||'—')+'\n⏱️ সময়সীমা: '+(q.timeline||'—')+(q.expiry?'\n📅 কোটেশনের মেয়াদ: '+q.expiry:'')+'\n\nরাজি থাকলে এই মেসেজে জানান। ধন্যবাদ।';
  window.open(waTo(x.whatsapp,t),'_blank','noopener');
};

/* ───── Services ───── */
AGA.rs=function(){
  $('agsNote').innerHTML=errBox()+(!AGA.s.length?'<div class="alert alert-warning" style="margin-bottom:14px;line-height:1.6">ডেটাবেসে এখনো কোনো Service নেই; ওয়েবসাইট এখন ১৮টি ডিফল্ট Service (Custom Quote) দেখাচ্ছে। এগুলো এডিট করতে প্রথমে ইমপোর্ট করুন। <button class="btn btn-sm btn-primary" onclick="AGA.seed()">⬇️ ১৮টি ডিফল্ট Service ইমপোর্ট করুন</button></div>':'');
  var rows=AGA.s.slice().sort(function(a,b){return (a.order||999)-(b.order||999);});
  $('agsTable').innerHTML=rows.length?'<table><thead><tr><th>#</th><th>Service</th><th>Category</th><th>মূল্য</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(function(s){
   return '<tr><td>'+(s.order||'')+'</td><td>'+esc(s.icon)+' '+esc(s.name)+(s.featured?' ⭐':'')+'</td><td style="font-size:.8rem">'+esc(s.category)+'</td><td style="font-size:.8rem">'+esc(s.price?((s.startingPrice?'Starting ':'')+'৳'+s.price):(s.priceText||'Custom Quote'))+'</td><td>'+badge(s.active===false?'Closed':'Completed').replace('Closed','Disabled').replace('Completed','Active')+'</td>'
   +'<td style="white-space:nowrap"><button class="btn btn-sm btn-secondary" onclick="AGA.editService(\''+esc(s._id)+'\')">✏️</button> <button class="btn btn-sm btn-secondary" onclick="AGA.toggleS(\''+esc(s._id)+'\')">'+(s.active===false?'Enable':'Disable')+'</button> <button class="btn btn-sm btn-danger" onclick="AGA.delS(\''+esc(s._id)+'\')">🗑️</button></td></tr>';}).join('')+'</tbody></table>':'<div style="padding:24px;text-align:center;color:var(--text2)">কোনো Service নেই</div>';
};
AGA.seed=async function(){
  if(!confirm('১৮টি ডিফল্ট Service ডেটাবেসে যোগ হবে। চালিয়ে যাবেন?')) return;
  try{var b=db.batch();window.AGENCY_DEFAULT_SERVICES.forEach(function(s){var d=Object.assign({},s);delete d.id;b.set(db.collection('agencyServices').doc(s.id),d);});await b.commit();T('✅ ইমপোর্ট হয়েছে');await AGA.reload();AGA.rs();}catch(e){T('ব্যর্থ: '+e.message,1);}
};
AGA.toggleS=async function(id){var s=AGA.s.find(function(x){return x._id===id;});try{await db.collection('agencyServices').doc(id).update({active:s.active===false});s.active=s.active===false;AGA.rs();}catch(e){T(e.message,1);}};
AGA.delS=async function(id){if(!confirm('এই Service মুছে ফেলবেন?'))return;try{await db.collection('agencyServices').doc(id).delete();AGA.s=AGA.s.filter(function(x){return x._id!==id;});AGA.rs();T('মুছে ফেলা হয়েছে');}catch(e){T(e.message,1);}};
AGA.editService=function(id){
  var s=id?AGA.s.find(function(x){return x._id===id;}):{active:true,order:AGA.s.length+1,category:D.CATS[0],icon:'🧰'}; s=s||{};
  ov('agsModal','<h3>'+(id?'✏️ Service এডিট':'➕ নতুন Service')+'</h3>'
   +'<div class="ag-2">'+fld('Icon (emoji)','<input class="form-control" id="agsm_ic" value="'+esc(s.icon||'')+'" maxlength="4">')+fld('Service Name *','<input class="form-control" id="agsm_nm" value="'+esc(s.name||'')+'">')+'</div>'
   +'<div class="ag-2">'+fld('Category','<select class="form-control" id="agsm_ct">'+sel(D.CATS,s.category)+'</select>')+fld('Sort Order','<input type="number" class="form-control" id="agsm_or" value="'+esc(s.order||'')+'">')+'</div>'
   +fld('সংক্ষিপ্ত বিবরণ','<textarea class="form-control" id="agsm_sh" rows="2">'+esc(s.short||'')+'</textarea>')+fld('কার জন্য উপযুক্ত','<input class="form-control" id="agsm_au" value="'+esc(s.audience||'')+'">')
   +fld('Scope of Work (প্রতি লাইনে একটি)','<textarea class="form-control" id="agsm_sc" rows="3">'+esc((s.scope||[]).join('\n'))+'</textarea>')
   +fld('Deliverables (প্রতি লাইনে একটি)','<textarea class="form-control" id="agsm_de" rows="3">'+esc((s.deliverables||[]).join('\n'))+'</textarea>')
   +fld('Client Requirements (প্রতি লাইনে একটি)','<textarea class="form-control" id="agsm_rq" rows="3">'+esc((s.requirements||[]).join('\n'))+'</textarea>')
   +fld('FAQ (প্রতি লাইনে: প্রশ্ন | উত্তর)','<textarea class="form-control" id="agsm_fq" rows="3">'+esc((s.faqs||[]).map(function(f){return f.q+' | '+f.a;}).join('\n'))+'</textarea>')
   +'<div class="ag-2">'+fld('মূল্য (সংখ্যা, ফাঁকা = Custom Quote)','<input type="number" class="form-control" id="agsm_pr" value="'+esc(s.price||'')+'">')+fld('মূল্যের লেখা (মূল্য ফাঁকা থাকলে দেখাবে)','<input class="form-control" id="agsm_pt" value="'+esc(s.priceText||'Custom Quote')+'">')+'</div>'
   +'<div class="ag-2">'+fld('Delivery Time','<input class="form-control" id="agsm_tl" value="'+esc(s.timeline||'')+'" placeholder="নির্ধারিত না হলে ফাঁকা রাখুন">')
   +'<div class="ag-checks" style="margin-top:22px"><label><input type="checkbox" id="agsm_sp" '+(s.startingPrice?'checked':'')+'> Starting Price</label><label><input type="checkbox" id="agsm_ac" '+(s.active!==false?'checked':'')+'> Active</label><label><input type="checkbox" id="agsm_ft" '+(s.featured?'checked':'')+'> Featured</label></div></div>'
   +'<button class="btn btn-primary" onclick="AGA.saveS(\''+(id||'')+'\')">💾 Save</button>');
};
AGA.saveS=async function(id){
  var name=$('agsm_nm').value.trim(); if(!name) return T('Service নাম দিন',1);
  var d={name:name,icon:$('agsm_ic').value.trim()||'🧰',category:$('agsm_ct').value,order:Number($('agsm_or').value)||999,short:$('agsm_sh').value.trim(),audience:$('agsm_au').value.trim(),
    scope:lines($('agsm_sc').value),deliverables:lines($('agsm_de').value),requirements:lines($('agsm_rq').value),
    faqs:lines($('agsm_fq').value).map(function(l){var p=l.split('|');return {q:(p[0]||'').trim(),a:p.slice(1).join('|').trim()};}).filter(function(f){return f.q;}),
    price:Number($('agsm_pr').value)||null,priceText:$('agsm_pt').value.trim()||'Custom Quote',startingPrice:$('agsm_sp').checked,timeline:$('agsm_tl').value.trim(),active:$('agsm_ac').checked,featured:$('agsm_ft').checked};
  try{var ref=id?db.collection('agencyServices').doc(id):db.collection('agencyServices').doc();await ref.set(d,{merge:true});T('✅ সংরক্ষিত');AGA.close('agsModal');await AGA.reload();AGA.rs();}catch(e){T('ব্যর্থ: '+e.message,1);}
};

/* ───── Leads & Clients ───── */
function leadList(){
  var m={};
  function add(phone,name,src,svc){ if(!phone) return; var o=m[phone]||(m[phone]=Object.assign({phone:phone,name:name,source:src,interested:[],leadStatus:'New',clientStatus:'',followUp:'',notes:''},AGA.l[phone]||{}));
    if(!o.name) o.name=name; if(svc&&o.interested.indexOf(svc)<0&&!(AGA.l[phone]&&AGA.l[phone].interested)) o.interested.push(svc); }
  AGA.c.forEach(function(x){add(x.whatsapp,x.name,'Consultation',(x.recs&&x.recs.service)||(x.problems||[])[0]);});
  AGA.q.forEach(function(x){add(x.whatsapp,x.name,'Quotation',x.service);});
  Object.keys(AGA.l).forEach(function(p){add(p,AGA.l[p].name,AGA.l[p].source||'Manual','');});
  return Object.keys(m).map(function(k){return m[k];});
}
AGA.rl=function(){
  var s=(($('aglSearch')||{}).value||'').toLowerCase(),f=($('aglFilter')||{}).value||'';
  var rows=leadList().filter(function(x){return (!f||x.leadStatus===f)&&(!s||(x.name||'').toLowerCase().indexOf(s)>-1||x.phone.indexOf(s.replace(/\D/g,'')||'§')>-1);});
  $('aglTable').innerHTML=errBox()+(rows.length?'<table><thead><tr><th>নাম</th><th>Phone</th><th>Source</th><th>আগ্রহ</th><th>Lead</th><th>Client</th><th>Follow-up</th><th></th></tr></thead><tbody>'+rows.map(function(x){
   return '<tr><td>'+esc(x.name)+'</td><td style="font-size:.8rem">'+esc(x.phone)+'</td><td style="font-size:.8rem">'+esc(x.source)+'</td><td style="font-size:.78rem;max-width:200px">'+esc((x.interested||[]).join(', '))+'</td><td>'+badge(x.leadStatus)+'</td><td style="font-size:.8rem">'+esc(x.clientStatus||'—')+'</td><td style="font-size:.8rem">'+esc(x.followUp||'—')+'</td><td><button class="btn btn-sm btn-secondary" onclick="AGA.viewL(\''+esc(x.phone)+'\')">এডিট</button></td></tr>';}).join('')+'</tbody></table>':'<div style="padding:24px;text-align:center;color:var(--text2)">কোনো Lead নেই</div>');
};
AGA.toLead=async function(phone,name,src){
  try{await db.collection('agencyLeads').doc(phone).set({name:name,phone:phone,source:src,leadStatus:AGA.l[phone]?AGA.l[phone].leadStatus:'New'},{merge:true});AGA.l[phone]=Object.assign(AGA.l[phone]||{},{name:name,phone:phone});T('✅ Lead তালিকায় যোগ হয়েছে');}catch(e){T(e.message,1);}
};
AGA.viewL=function(phone){
  var x=leadList().find(function(l){return l.phone===phone;}); if(!x) return;
  ov('aglModal','<h3>🧲 '+esc(x.name)+' · '+esc(x.phone)+'</h3>'
   +'<div class="ag-2">'+fld('Lead Status','<select class="form-control" id="aglm_ls">'+sel(LSTAT,x.leadStatus)+'</select>')+fld('Client Status','<select class="form-control" id="aglm_cs"><option value="">— Client নয় —</option>'+sel(['Active','Completed'],x.clientStatus)+'</select>')+'</div>'
   +'<div class="ag-2">'+fld('Lead Source','<input class="form-control" id="aglm_sr" value="'+esc(x.source||'')+'">')+fld('Follow-up তারিখ','<input type="date" class="form-control" id="aglm_fu" value="'+esc(x.followUp||'')+'">')+'</div>'
   +fld('আগ্রহী সার্ভিস (কমা দিয়ে)','<input class="form-control" id="aglm_in" value="'+esc((x.interested||[]).join(', '))+'">')+fld('Customer Notes','<textarea class="form-control" id="aglm_nt" rows="3">'+esc(x.notes||'')+'</textarea>')
   +'<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="AGA.saveL(\''+esc(phone)+'\')">💾 Save</button><button class="btn btn-secondary" onclick="AGA.saveL(\''+esc(phone)+'\',true)">✅ Client-এ রূপান্তর</button><a class="btn btn-secondary" target="_blank" rel="noopener" href="'+waTo(phone,'আসসালামু আলাইকুম '+x.name)+'">📲 WhatsApp</a></div>');
};
AGA.saveL=async function(phone,convert){
  var x=leadList().find(function(l){return l.phone===phone;});
  var d={name:x.name,phone:phone,leadStatus:convert?'Client':$('aglm_ls').value,clientStatus:convert?($('aglm_cs').value||'Active'):$('aglm_cs').value,source:$('aglm_sr').value,followUp:$('aglm_fu').value,
    interested:$('aglm_in').value.split(',').map(function(a){return a.trim();}).filter(Boolean),notes:$('aglm_nt').value,updatedAtISO:new Date().toISOString()};
  try{await db.collection('agencyLeads').doc(phone).set(d,{merge:true});AGA.l[phone]=Object.assign(AGA.l[phone]||{},d);T('✅ সংরক্ষিত');AGA.close('aglModal');AGA.rl();}catch(e){T('ব্যর্থ: '+e.message,1);}
};

/* ───── Settings ───── */
var RULES="rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    function isAdmin(){ return request.auth != null && request.auth.token.email == 'totul01744@gmail.com'; }\n\n    // গ্রাহকের Consultation: যে কেউ নতুন তৈরি করতে পারবে (যাচাইসহ), শুধু Admin পড়তে/বদলাতে পারবে\n    match /consultations/{id} {\n      allow create: if request.resource.data.keys().hasAll(['name','whatsapp','problems','consent','status'])\n                    && request.resource.data.status == 'Pending'\n                    && request.resource.data.consent == true\n                    && request.resource.data.name is string && request.resource.data.name.size() <= 80\n                    && request.resource.data.whatsapp is string && request.resource.data.whatsapp.size() <= 15\n                    && request.resource.data.problems is list && request.resource.data.problems.size() <= 11;\n      allow read, update, delete: if isAdmin();\n    }\n    match /quoteRequests/{id} {\n      allow create: if request.resource.data.keys().hasAll(['name','whatsapp','service','problem','consent','status'])\n                    && request.resource.data.status == 'Pending'\n                    && request.resource.data.consent == true\n                    && request.resource.data.name.size() <= 80 && request.resource.data.whatsapp.size() <= 15\n                    && request.resource.data.problem.size() <= 900;\n      allow read, update, delete: if isAdmin();\n    }\n    // Service তালিকা সবার দেখার জন্য, বদলাতে পারবে শুধু Admin\n    match /agencyServices/{id} { allow read: if true; allow write: if isAdmin(); }\n    match /agencySettings/{id} { allow read: if true; allow write: if isAdmin(); }\n    match /agencyLeads/{id}    { allow read, write: if isAdmin(); }\n  }\n}";
AGA.rset=function(){
  var st=AGA.settings||{}; 
  $('ag_set_body').innerHTML=errBox()+'<div class="settings-section"><h3>📲 WhatsApp নম্বর</h3><p class="ag-note" style="margin-bottom:10px">ওয়েবসাইটের সব WhatsApp বাটন এই নম্বর ব্যবহার করে (দেশ কোডসহ, যেমন 8801XXXXXXXXX)। বর্তমান ডিফল্ট: '+esc(D.WHATSAPP)+'</p>'
   +'<input class="form-control" id="ag_set_wa" placeholder="8801XXXXXXXXX" style="max-width:280px;margin-bottom:10px"><br><button class="btn btn-primary btn-sm" onclick="AGA.saveSet()">💾 Save</button></div>'
   +'<div class="settings-section"><h3>🔒 Firestore Security Rules (অবশ্যই প্রয়োজন)</h3><p class="ag-note" style="margin-bottom:10px;line-height:1.7">Firebase Console → Firestore Database → Rules-এ এই অংশ <b>আপনার বিদ্যমান rules-এর ভেতরে</b> (match /databases/{database}/documents-এর মধ্যে) যোগ করে Publish করুন। এটিই গ্রাহকের তথ্য সুরক্ষার আসল (server-side) ব্যবস্থা। এটি ছাড়া ফর্ম সংরক্ষণ ও Admin ডেটা পড়া ব্যর্থ হবে।</p><textarea class="form-control" readonly rows="12" style="font-family:monospace;font-size:.74rem" onclick="this.select()">'+esc(RULES)+'</textarea><button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="navigator.clipboard.writeText(document.querySelector(\'#ag_set_body textarea\').value).then(function(){Toast.success(\'Copied\')})">📋 Copy</button></div>'
   +'<div class="settings-section"><h3>📬 নোটিফিকেশন অবস্থা</h3><p class="ag-note" style="line-height:1.7">⚠️ Email/WhatsApp অটো-নোটিফিকেশন এখনো সংযুক্ত নয় (কোনো Provider কনফিগার করা নেই)। নতুন অনুরোধ এই Admin Panel-এর সাইডবার ব্যাজে দেখা যায় — নিয়মিত Panel খুলে দেখুন।</p></div>';
  db.collection('agencySettings').doc('main').get().then(function(d){if(d.exists&&d.data().whatsapp)$('ag_set_wa').value=d.data().whatsapp;else $('ag_set_wa').value=D.WHATSAPP;}).catch(function(){$('ag_set_wa').value=D.WHATSAPP;});
};
AGA.saveSet=async function(){
  var v=($('ag_set_wa').value||'').replace(/\D/g,''); if(v.length<10||v.length>15) return T('সঠিক নম্বর দিন (দেশ কোডসহ)',1);
  try{await db.collection('agencySettings').doc('main').set({whatsapp:v,updatedAtISO:new Date().toISOString()},{merge:true});T('✅ সংরক্ষিত');}catch(e){T('ব্যর্থ: '+e.message,1);}
};

/* ───── boot ───── */
function boot(){
  inject();
  if(typeof window.showPage==='function' && !window.showPage.__ag){
    var o=window.showPage; window.showPage=function(n,b){o(n,b); if(String(n).indexOf('ag_')===0) AGA.show(n);}; window.showPage.__ag=true;
  }
  var t=setInterval(function(){var a=$('adminApp');if(a&&!a.classList.contains('hidden')&&typeof db!=='undefined'&&db){clearInterval(t);AGA.reload();}},1200);
  setTimeout(function(){clearInterval(t);},120000);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
