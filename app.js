const KEY="unified_surgery_residents_v1";
const CHECKS=[['cxr','أشعة صدر'],['blood','تحليل دم'],['virology','Virology'],['consult','استشارات'],['anesthesia','تخدير'],['ecg','تخطيط قلب'],['documents','توقيع الأوراق']];
let state=loadState();
let caseFilter='active',replyCaseId='',operationCaseId='',assignCaseId='';

function inflateSeeds(){const keys=['cxr','blood','virology','consult','anesthesia','ecg','documents'];return (window.SEED_ROWS||[]).map(r=>{const [id,mrn,patientName,diagnosis,procedure,pathway,archived,reqMask,doneMask,age,sex,notes]=r;const checklist={};keys.forEach((k,i)=>checklist[k]={required:!!(reqMask&(1<<i)),done:!!(doneMask&(1<<i))});return {id,mrn,patientName,diagnosis,procedure,pathway,archived:!!archived,checklist,custom:[],notes:notes||'',residentOwner:'',ownerState:'unassigned',performedBy:'',missedOfficialReason:'',age:age||'',sex:sex||'',history:[]}})}
function blankState(){return {version:1,cases:inflateSeeds(),residents:[],events:[],legacyMonthlyRecovered:structuredClone(window.LEGACY_MONTHLY_RECOVERED||[]),settings:{groupTitle:'توزيع حالات الجراحة العامة',includeNames:true,autoReplacement:true,lastBackupAt:''},createdAt:new Date().toISOString()}}
function loadState(){
  try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.version===1)return normalizeState(x)}catch(e){}
  const s=blankState();
  // Migrate resident roster and any matching ownership from the previous resident app on this same GitHub Pages origin.
  try{
    const old=JSON.parse(localStorage.getItem('gs_case_owner_v1')||'null');
    if(old){
      (old.residents||[]).forEach(r=>ensureResidentOn(s,r.name,r.active!==false));
      (old.cases||[]).forEach(oc=>{
        const c=s.cases.find(x=>(oc.mrn&&x.mrn===oc.mrn)||(!oc.mrn&&oc.patient&&x.patientName.toLowerCase()===String(oc.patient).toLowerCase()));
        if(!c)return;
        if(oc.owner){c.residentOwner=oc.owner;c.ownerState=(oc.status==='consultant'?'consultant':oc.status==='done'?'done':'assigned');}
        if(oc.previousOwner&&!c.residentOwner)c.previousOwner=oc.previousOwner;
      });
    }
  }catch(e){}
  try{
    const legacy=JSON.parse(localStorage.getItem('rct_v4_state')||'null');
    if(legacy)Object.keys(legacy.residents||{}).forEach(n=>ensureResidentOn(s,n,true));
  }catch(e){}
  s.events.push(eventObj('migration','','','إنشاء التطبيق الموحد واستيراد الحالات الحالية من النسخة المرفقة'));
  localStorage.setItem(KEY,JSON.stringify(s));return normalizeState(s);
}
function normalizeState(s){s.settings||={};if(s.settings.includeNames===undefined)s.settings.includeNames=true;if(s.settings.autoReplacement===undefined)s.settings.autoReplacement=true;s.settings.groupTitle||='توزيع حالات الجراحة العامة';if(s.settings.lastBackupAt==null)s.settings.lastBackupAt='';s.events||=[];s.residents||=[];s.cases||=[];if(!Array.isArray(s.legacyMonthlyRecovered))s.legacyMonthlyRecovered=structuredClone(window.LEGACY_MONTHLY_RECOVERED||[]);s.residents.forEach(r=>{if(r.compensation==null)r.compensation=0;if(r.operations==null)r.operations=0;if(r.failed==null)r.failed=0;if(r.active==null)r.active=true});s.cases.forEach(c=>{c.custom||=[];c.checklist||={};c.ownerState||='unassigned';if(c.archived==null)c.archived=false;if(c.operationPoints==null&&c.completedAt)c.operationPoints=(c.pathway==='emergency'?(c.emergencyOptimization==='non_optimized'?4:3):2);if(c.orHours==null)c.orHours=0;if(c.pathway==='emergency'&&c.ownerState!=='done'){c.residentOwner='';c.ownerState='unassigned'}});(window.LEGACY_COMPLETED_STATS||[]).forEach(row=>{const [id,end,proc,points,surgeon,hours]=row,c=s.cases.find(x=>x.id===id);if(c&&!c.completedAt){c.completedAt=end;c.actualProcedure=proc;c.operationPoints=points;c.performedBy=surgeon;c.orHours=hours||0;c.ownerState='done';c.archived=true}});return s}
function ensureResidentOn(s,name,active=true){name=String(name||'').trim();if(!name)return;let r=s.residents.find(x=>x.name.toLowerCase()===name.toLowerCase());if(!r)s.residents.push({id:'R'+Date.now()+Math.random(),name,active,compensation:0,operations:0,failed:0,createdAt:new Date().toISOString()})}
function persist(){localStorage.setItem(KEY,JSON.stringify(state))}
function eventObj(type,caseId='',resident='',detail=''){return {id:'E'+Date.now()+Math.random(),type,caseId,resident,detail,at:new Date().toISOString()}}
function logEvent(type,c,resident,detail){state.events.push(eventObj(type,c?.id||'',resident||'',detail||''))}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toastMsg(t){toast.textContent=t;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2500)}
function activeCases(){return state.cases.filter(c=>!c.archived&&c.ownerState!=='done')}
function activeResidents(){return state.residents.filter(r=>r.active)}
function readiness(c){
  const missing=CHECKS.filter(([k])=>c.checklist?.[k]?.required&&!c.checklist[k].done).map(([k,l])=>({key:k,label:l}));
  const custom=(c.custom||[]).filter(x=>x.required!==false&&!x.done).map((x,i)=>({key:'custom_'+i,label:x.name}));
  const all=[...missing,...custom];
  if(!all.length)return {key:'ready',label:'جاهز للعمليات',missing:[]};
  if(all.length===1&&all[0].key==='documents')return {key:'signature',label:'انتظار التوقيع',missing:all};
  return {key:'notready',label:'غير جاهز',missing:all};
}
function ownerLabel(c){if(c.ownerState==='consultant')return 'استشاري فقط';if(c.ownerState==='done')return 'مكتملة';if(c.pathway==='emergency')return 'طوارئ — خارج التوزيع';return c.residentOwner||'غير موزعة'}
function distributableCase(c){return c.pathway!=='emergency'}
function currentLoad(name){return activeCases().filter(c=>distributableCase(c)&&c.ownerState==='assigned'&&c.residentOwner===name).length}
function readyLoad(name){return activeCases().filter(c=>distributableCase(c)&&c.ownerState==='assigned'&&c.residentOwner===name&&readiness(c).key==='ready').length}
function unassigned(){return activeCases().filter(c=>distributableCase(c)&&c.ownerState==='unassigned'&&!c.residentOwner)}
function caseTitle(c){return `${c.patientName||'بدون اسم'} — ${c.mrn||c.id}`}
function pathLabel(p){return ({elective:'Elective',day:'DSU / Day Surgery',inpatient:'Inpatient',emergency:'Emergency',minor:'Minor'})[p]||p||'—'}
function operationPointsFor(c,opt){return c?.pathway==='emergency'?(opt==='non_optimized'?4:3):2}
function showTab(t){['dashboard','cases','residents','operations','monthly','reports'].forEach(x=>{document.getElementById(x+'Section').style.display=x===t?'block':'none';document.getElementById('tab'+x[0].toUpperCase()+x.slice(1)).classList.toggle('active',x===t)});renderAll()}

function renderAll(){persist();renderDashboard();renderCases();renderResidents();renderOperations();renderMonthlyReport();renderReports()}
function renderDashboard(){
  const a=activeCases(),rs=a.map(readiness);dActive.textContent=a.length;dReady.textContent=rs.filter(x=>x.key==='ready').length;dSign.textContent=rs.filter(x=>x.key==='signature').length;dNotReady.textContent=rs.filter(x=>x.key==='notready').length;dUnassigned.textContent=unassigned().length;dComp.textContent=state.residents.reduce((n,r)=>n+Number(r.compensation||0),0);
  const box=(path)=>{const list=a.filter(c=>c.pathway===path);const cnt=k=>list.filter(c=>readiness(c).key===k).length;return `<div class="mini"><b>جاهز: ${cnt('ready')}</b>انتظار توقيع: ${cnt('signature')} · غير جاهز: ${cnt('notready')}</div><div class="mini"><b>إجمالي: ${list.length}</b>غير موزع: ${list.filter(c=>c.ownerState==='unassigned').length} · استشاري فقط: ${list.filter(c=>c.ownerState==='consultant').length}</div>`};dashDay.innerHTML=box('day');dashElective.innerHTML=box('elective');
  const notes=[];const last=state.settings.lastBackupAt?new Date(state.settings.lastBackupAt).getTime():0;if(!last||Date.now()-last>=7*86400000)notes.push(`<div class="mini"><b>⚠️ النسخة الاحتياطية</b>${last?'مر أكثر من 7 أيام منذ آخر نسخة.':'لم يتم إنشاء نسخة احتياطية بعد.'}</div>`);const ua=unassigned().length;if(ua)notes.push(`<div class="mini"><b>${ua} حالة غير موزعة</b>تحتاج توزيعًا أو قرارًا يدويًا.</div>`);const comps=state.residents.filter(r=>r.compensation>0);if(comps.length)notes.push(`<div class="mini"><b>تعويضات مستحقة</b>${comps.map(r=>`${esc(r.name)} +${r.compensation}`).join(' · ')}</div>`);const or=a.filter(c=>readiness(c).key==='ready'&&(c.ownerState==='assigned'||c.ownerState==='consultant')).length;if(or)notes.push(`<div class="mini"><b>${or} حالة جاهزة للعملية</b>افتح صفحة العمليات لتسجيل النتيجة.</div>`);attentionList.innerHTML=notes.join('')||'<div class="empty">لا يوجد شيء عاجل الآن.</div>';
}
function setCaseFilter(b){document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');caseFilter=b.dataset.f;renderCases()}
function renderCases(){
  let list=state.cases.filter(c=>{if(caseFilter==='archive')return c.archived||c.ownerState==='done';if(c.archived||c.ownerState==='done')return false;if(caseFilter==='active')return true;if(['day','elective','inpatient','emergency','minor'].includes(caseFilter))return c.pathway===caseFilter;if(caseFilter==='consultant')return c.ownerState==='consultant';return readiness(c).key===caseFilter});
  list.sort((a,b)=>{const ar=readiness(a).key,br=readiness(b).key;const p={notready:0,signature:1,ready:2};return (p[ar]-p[br])||String(a.patientName).localeCompare(String(b.patientName))});
  casesList.innerHTML=list.length?list.map(caseCard).join(''):'<div class="empty">لا توجد حالات في هذا العرض.</div>';
}
function caseCard(c){
  const r=readiness(c);const misses=r.missing;const ownerBadge=c.ownerState==='consultant'?'consultant':c.residentOwner?'assigned':'unassigned';
  let actions=`<button class="btn secondary" onclick="openCase('${c.id}')">تعديل</button>`;
  if(!c.archived&&c.ownerState!=='done'){
    if(c.ownerState==='unassigned'&&c.pathway!=='emergency')actions=`<button class="btn dark" onclick="openAssign('${c.id}')">تعيين</button>`+actions;
    if(c.pathway==='emergency'&&c.ownerState==='unassigned')actions=`<button class="btn danger" onclick="openOperation('${c.id}')">✅ تمت عملية الطوارئ</button>`+actions;
    if(c.ownerState==='assigned')actions=`<button class="btn ${r.key==='ready'?'ok':'secondary'}" onclick="openReply('${c.id}')">تحديث رد المقيم</button>`+(r.key==='ready'?`<button class="btn dark" onclick="openOperation('${c.id}')">تسجيل العملية</button>`:'')+actions;
    if(c.ownerState==='consultant'&&r.key==='ready')actions=`<button class="btn violet" onclick="openOperation('${c.id}')">تمت بواسطة الاستشاري</button>`+actions;
  }
  return `<div class="card"><div class="row"><div><div class="name">${esc(c.patientName||'—')}</div><div class="sub">MRN ${esc(c.mrn||'—')} · ${pathLabel(c.pathway)} · ${esc(c.diagnosis||'')}</div></div><div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end"><span class="badge ${r.key}">${r.label}</span><span class="badge ${ownerBadge}">${esc(ownerLabel(c))}</span></div></div><div class="meta"><div><b>العملية</b>${esc(c.procedure||'—')}</div><div><b>المقيم</b>${esc(c.residentOwner||c.previousOwner||'—')}</div><div><b>النواقص</b>${misses.length}</div><div><b>الحالة</b>${c.archived?'أرشيف':ownerLabel(c)}</div></div><div class="missing">${misses.length?misses.map(x=>`<span class="miss">${esc(x.label)}</span>`).join(''):'<span class="miss done">التجهيز مكتمل</span>'}</div><div class="actions">${actions}</div></div>`;
}

function renderResidents(){
  const rs=state.residents;residentTable.innerHTML=rs.length?rs.map((r,i)=>`<div class="resRow"><span>${i+1}</span><div><b>${esc(r.name)}</b><div class="orderBtns"><button onclick="moveResident(${i},-1)">↑</button><button onclick="moveResident(${i},1)">↓</button></div></div><span class="big">${currentLoad(r.name)}</span><span>${readyLoad(r.name)}</span><span>${r.operations||0}</span><span class="comp">${r.compensation?('+'+r.compensation):'0'}</span><span class="hideMobile"><button class="btn ${r.active?'ok':'secondary'}" onclick="toggleResident(${i})">${r.active?'نشط':'موقوف'}</button></span></div>`).join(''):'<div class="empty">أضف أسماء المقيمين أولًا.</div>';
  const extras=unassigned();surplusList.innerHTML=extras.length?extras.map(c=>`<div class="mini"><div class="row"><div><b>${esc(caseTitle(c))}</b><span>${esc(c.diagnosis||'')} · ${readiness(c).label}</span></div><button class="btn warn" onclick="openAssign('${c.id}')">تعيين يدوي</button></div></div>`).join(''):'<div class="empty">لا توجد حالات غير موزعة.</div>';
  const comp=activeResidents().filter(r=>r.compensation>0);distributionStatus.innerHTML=`<div class="mini"><b>الحالات غير الموزعة: ${extras.length}</b>المقيمون النشطون: ${activeResidents().length}${comp.length?` · أصحاب التعويض: ${comp.map(r=>`${esc(r.name)} +${r.compensation}`).join('، ')}`:''}</div>`;
}
function addResidentPrompt(){const name=(prompt('اسم المقيم')||'').trim();if(!name)return;if(state.residents.some(r=>r.name.toLowerCase()===name.toLowerCase())){alert('المقيم موجود مسبقًا');return}state.residents.push({id:'R'+Date.now(),name,active:true,compensation:0,operations:0,failed:0,createdAt:new Date().toISOString()});logEvent('resident','',name,'إضافة مقيم');renderAll()}
function moveResident(i,d){const j=i+d;if(j<0||j>=state.residents.length)return;[state.residents[i],state.residents[j]]=[state.residents[j],state.residents[i]];renderAll()}
function toggleResident(i){const r=state.residents[i];if(!r)return;r.active=!r.active;renderAll()}
function assignTo(c,name,reason='تعيين'){if(!c||c.ownerState!=='unassigned')return false;c.residentOwner=name;c.ownerState='assigned';c.assignedAt=new Date().toISOString();logEvent('assign',c,name,reason);return true}
function distributeCases(){
  const rs=activeResidents();if(!rs.length){alert('أضف مقيمين نشطين أولًا.');return}let q=unassigned().slice();if(!q.length){toastMsg('لا توجد حالات غير موزعة');return}let n=0;
  // 1) Compensation cases are additional and consume compensation balance.
  for(const r of rs){while(r.compensation>0&&q.length){const c=q.shift();assignTo(c,r.name,'حالة تعويضية بعذر رسمي');r.compensation--;n++;}}
  // 2) Fair balancing. Stop when remaining cases cannot give a complete next fairness layer.
  const loads=Object.fromEntries(rs.map(r=>[r.name,currentLoad(r.name)]));
  while(q.length){const vals=rs.map(r=>loads[r.name]);const min=Math.min(...vals),max=Math.max(...vals);if(min<max){const need=rs.filter(r=>loads[r.name]===min);if(q.length<need.length)break;for(const r of need){const c=q.shift();assignTo(c,r.name,'توزيع متساوٍ');loads[r.name]++;n++;}}else{if(q.length<rs.length)break;for(const r of rs){const c=q.shift();assignTo(c,r.name,'طبقة توزيع متساوية');loads[r.name]++;n++;}}}
  renderAll();toastMsg(n?`تم توزيع ${n} حالة`:'بقيت الزيادة لتعيينك اليدوي');
}
function openAssign(id){const c=state.cases.find(x=>x.id===id);if(!c||c.ownerState!=='unassigned')return;assignCaseId=id;assignInfo.textContent=caseTitle(c)+' — '+(c.diagnosis||'');assignResident.innerHTML=activeResidents().map(r=>`<option value="${esc(r.name)}">${esc(r.name)} — الحالي ${currentLoad(r.name)}${r.compensation?` — تعويض +${r.compensation}`:''}</option>`).join('');assignModal.classList.add('show')}
function confirmManualAssign(){const c=state.cases.find(x=>x.id===assignCaseId),name=assignResident.value;if(!c||!name)return;assignTo(c,name,'تعيين يدوي');closeModal('assignModal');renderAll()}

function renderOperations(){
  const list=activeCases().filter(c=>c.pathway!=='emergency'&&readiness(c).key==='ready');
  operationsList.innerHTML=list.length?list.map(c=>`<div class="card orCard ${c.ownerState==='consultant'?'consultantCard':''}"><div class="row"><div><div class="name">${esc(c.patientName||'—')} — ${esc(c.procedure||'')}</div><div class="sub">MRN ${esc(c.mrn||'—')} · ${pathLabel(c.pathway)} · ${esc(c.diagnosis||'')}</div></div><span class="badge ${c.ownerState==='consultant'?'consultant':c.residentOwner?'assigned':'unassigned'}">${esc(ownerLabel(c))}</span></div><div class="actions"><button class="btn ok" onclick="openOperation('${c.id}')">✅ تمت العملية</button><button class="btn secondary" onclick="openCase('${c.id}')">فتح الحالة</button></div></div>`).join(''):'<div class="empty">لا توجد حالات جاهزة للعملية حاليًا.</div>';
}
function openEmergencyOperation(){emPatient.value='';emMrn.value='';emDiagnosis.value='';emProcedure.value='';emOptimization.value='optimized';emDuration.value='';emOperator.value='';emergencyModal.classList.add('show')}
function saveEmergencyOperation(){
  const proc=emProcedure.value.trim();if(!proc){alert('أدخل اسم العملية.');return}
  const c={id:'EM-'+Date.now(),mrn:emMrn.value.trim(),patientName:emPatient.value.trim(),diagnosis:emDiagnosis.value.trim(),procedure:proc,actualProcedure:proc,pathway:'emergency',archived:true,checklist:{},custom:[],notes:'',residentOwner:'',ownerState:'done',performedBy:emOperator.value.trim()||'Consultant',emergencyOptimization:emOptimization.value,operationPoints:emOptimization.value==='non_optimized'?4:3,orHours:Math.max(0,(Number(emDuration.value)||0)/60),completedAt:new Date().toISOString(),createdAt:new Date().toISOString(),history:[]};
  state.cases.unshift(c);logEvent('emergency_operation',c,'',`تم تسجيل عملية طوارئ مباشرة — ${c.operationPoints} نقاط`);closeModal('emergencyModal');renderAll();toastMsg('تمت إضافة عملية الطوارئ للتقرير الشهري')
}
function openOperation(id){const c=state.cases.find(x=>x.id===id);if(!c)return;operationCaseId=id;operationCaseInfo.textContent=caseTitle(c)+' — صاحب الحالة: '+(c.residentOwner||c.previousOwner||'استشاري');operationOutcome.value=(c.pathway==='emergency'||!c.residentOwner||c.ownerState==='consultant')?'consultant':'owner';actualOperator.value='';officialReason.value='مناوبة';operationProcedure.value=c.actualProcedure||c.procedure||'';orDurationMinutes.value=c.orHours?Math.round(c.orHours*60):'';emergencyOptimization.value=c.emergencyOptimization||'optimized';renderOperationReason();operationModal.classList.add('show')}
function renderOperationReason(){officialReasonWrap.style.display=operationOutcome.value==='official_miss'?'block':'none';const c=state.cases.find(x=>x.id===operationCaseId);emergencyStatsWrap.style.display=c?.pathway==='emergency'?'block':'none';operationPointPreview.textContent='النقاط: '+operationPointsFor(c,emergencyOptimization.value)}
function giveNormalReplacement(name){if(!state.settings.autoReplacement||!name)return null;const c=unassigned()[0];if(c){assignTo(c,name,'حالة بديلة بعد العملية');return c}return null}
function confirmOperation(){
  const c=state.cases.find(x=>x.id===operationCaseId);if(!c)return;const outcome=operationOutcome.value;const owner=c.residentOwner||c.previousOwner||'';let msg='تم تسجيل العملية';
  if(outcome==='owner'){
    if(!owner){alert('لا يوجد صاحب حالة مسجل.');return}const r=state.residents.find(x=>x.name===owner);if(r)r.operations=(r.operations||0)+1;c.performedBy=actualOperator.value.trim()||owner;logEvent('operation',c,owner,'أجراها صاحب الحالة');const rep=giveNormalReplacement(owner);if(rep)msg+=` وأُعطي ${owner} حالة بديلة`;
  }else if(outcome==='official_miss'){
    if(!owner){alert('لا يوجد صاحب حالة لتعويضه.');return}const r=state.residents.find(x=>x.name===owner);if(r)r.compensation=(r.compensation||0)+1;c.missedOfficialReason=officialReason.value;c.performedBy=actualOperator.value.trim()||'غير صاحب الحالة';logEvent('official_miss',c,owner,`حُرم من العملية بسبب ${officialReason.value}؛ تعويض +1`);const rep=giveNormalReplacement(owner);if(rep)msg+=` وأُعطي ${owner} البديل المعتاد، وبقي له تعويض +1`;
  }else{c.performedBy=actualOperator.value.trim()||'Consultant';logEvent('consultant_operation',c,owner,'أجراها الاستشاري');}
  c.actualProcedure=operationProcedure.value.trim()||c.procedure||'';c.emergencyOptimization=c.pathway==='emergency'?emergencyOptimization.value:'';c.operationPoints=operationPointsFor(c,c.emergencyOptimization);c.orHours=Math.max(0,(Number(orDurationMinutes.value)||0)/60);c.ownerState='done';c.completedAt=new Date().toISOString();c.archived=true;closeModal('operationModal');renderAll();toastMsg(msg);
}

function openReply(id){const c=state.cases.find(x=>x.id===id);if(!c||c.ownerState!=='assigned')return;replyCaseId=id;replyCaseInfo.textContent=caseTitle(c)+' — '+(c.residentOwner||'');partialEditor.style.display='none';replyModal.classList.add('show')}
function completePreparation(){const c=state.cases.find(x=>x.id===replyCaseId);if(!c)return;CHECKS.forEach(([k])=>{if(c.checklist?.[k]?.required)c.checklist[k].done=true});(c.custom||[]).forEach(x=>{if(x.required!==false)x.done=true});logEvent('prepared',c,c.residentOwner,'المقيم أكمل تجهيز الحالة');closeModal('replyModal');renderAll();toastMsg('أصبحت الحالة جاهزة للعملية')}
function showPartialEditor(){const c=state.cases.find(x=>x.id===replyCaseId);if(!c)return;partialEditor.style.display='block';replyChecklist.innerHTML=CHECKS.map(([k,l])=>{const x=c.checklist?.[k]||{required:false,done:false};return `<div class="checkitem"><span>${l}</span><label><input type="checkbox" data-rreq="${k}" ${x.required?'checked':''} disabled> مطلوب</label><label><input type="checkbox" data-rdone="${k}" ${x.done?'checked':''} ${!x.required?'disabled':''}> تم</label></div>`}).join('')}
function savePartialReply(){const c=state.cases.find(x=>x.id===replyCaseId);if(!c)return;document.querySelectorAll('[data-rdone]').forEach(el=>{const k=el.dataset.rdone;if(c.checklist?.[k])c.checklist[k].done=el.checked});logEvent('partial',c,c.residentOwner,'تحديث جزئي من رد المقيم');closeModal('replyModal');renderAll()}
function failPreparation(){const c=state.cases.find(x=>x.id===replyCaseId);if(!c)return;if(!confirm('ستتحول الحالة إلى «استشاري فقط» ولن تعطى لمقيم آخر، ولا يحصل المقيم على تعويض. متابعة؟'))return;const name=c.residentOwner;const r=state.residents.find(x=>x.name===name);if(r)r.failed=(r.failed||0)+1;c.previousOwner=name;c.residentOwner='';c.ownerState='consultant';logEvent('failed',c,name,'لم يكمل تجهيز الحالة؛ حُجزت للاستشاري فقط');closeModal('replyModal');renderAll()}

function editorRow(k,l,x){return `<div class="checkitem"><span>${l}</span><label><input type="checkbox" data-req="${k}" ${x.required?'checked':''} onchange="syncDoneDisabled('${k}')"> مطلوب</label><label><input type="checkbox" data-done="${k}" ${x.done?'checked':''} ${!x.required?'disabled':''}> تم</label></div>`}
function syncDoneDisabled(k){const req=document.querySelector(`[data-req="${k}"]`),done=document.querySelector(`[data-done="${k}"]`);done.disabled=!req.checked;if(!req.checked)done.checked=false}
function syncCasePathwayRules(){const emergency=pathway.value==='emergency';caseResident.disabled=emergency;emergencyNoDistribution.style.display=emergency?'block':'none';if(emergency)caseResident.value=''}
function residentOptions(selected=''){return `<option value="">غير موزعة</option>`+state.residents.map(r=>`<option value="${esc(r.name)}" ${r.name===selected?'selected':''}>${esc(r.name)}${r.active?'':' (موقوف)'}</option>`).join('')}
function openCase(id=''){
  const c=id?state.cases.find(x=>x.id===id):null;caseModalTitle.textContent=c?'تعديل الحالة':'إضافة حالة';caseId.value=c?.id||'';patientName.value=c?.patientName||'';mrn.value=c?.mrn||'';pathway.value=c?.pathway||'elective';diagnosis.value=c?.diagnosis||'';procedure.value=c?.procedure||'';caseNotes.value=c?.notes||'';caseResident.innerHTML=residentOptions(c?.residentOwner||'');
  const chk=c?.checklist||Object.fromEntries(CHECKS.map(([k])=>[k,{required:true,done:false}]));checklistEditor.innerHTML=CHECKS.map(([k,l])=>editorRow(k,l,chk[k]||{required:false,done:false})).join('');archiveBtn.style.display=c?'block':'none';archiveBtn.textContent=c?.archived?'إعادة للحالات الحالية':'أرشفة';caseModal.classList.add('show');syncCasePathwayRules()
}
function saveCase(){
  if(!mrn.value.trim()&&!patientName.value.trim()){alert('أدخل اسم المريض أو رقم الملف.');return}let c=state.cases.find(x=>x.id===caseId.value);const isNew=!c;if(!c)c={id:'CASE-'+Date.now(),createdAt:new Date().toISOString(),archived:false,ownerState:'unassigned',custom:[],history:[]};
  c.patientName=patientName.value.trim();c.mrn=mrn.value.trim();c.pathway=pathway.value;c.diagnosis=diagnosis.value.trim();c.procedure=procedure.value.trim();c.notes=caseNotes.value.trim();c.checklist={};CHECKS.forEach(([k])=>{c.checklist[k]={required:document.querySelector(`[data-req="${k}"]`).checked,done:document.querySelector(`[data-done="${k}"]`).checked}});
  if(c.pathway==='emergency'){CHECKS.forEach(([k])=>c.checklist[k]={required:false,done:true});c.residentOwner='';if(c.ownerState!=='done')c.ownerState='unassigned'}else{const newOwner=caseResident.value;if(c.ownerState!=='consultant'&&c.ownerState!=='done'){if(newOwner){c.residentOwner=newOwner;c.ownerState='assigned'}else{c.residentOwner='';c.ownerState='unassigned'}}}c.updatedAt=new Date().toISOString();if(isNew){state.cases.unshift(c);logEvent('case_added',c,c.residentOwner,'إضافة حالة جديدة')}closeModal('caseModal');renderAll()
}
function toggleArchiveCase(){const c=state.cases.find(x=>x.id===caseId.value);if(!c)return;c.archived=!c.archived;logEvent('archive',c,c.residentOwner,c.archived?'أرشفة الحالة':'إعادة الحالة من الأرشيف');closeModal('caseModal');renderAll()}

function renderMonthlyReport(){if(typeof monthlyMonth==='undefined'||!monthlyMonth)return;const now=new Date(),def=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');if(!monthlyMonth.value)monthlyMonth.value=def;const m=monthlyMonth.value;const a=state.cases.filter(c=>c.completedAt&&String(c.completedAt).slice(0,7)===m).slice();(state.legacyMonthlyRecovered||window.LEGACY_MONTHLY_RECOVERED||[]).filter(x=>x.month===m).forEach(x=>{for(let i=0;i<Number(x.count||1);i++)a.push({id:'legacy-stat-'+m+'-'+x.pathway+'-'+x.procedure+'-'+i,patientName:'سجل قديم مستعاد',pathway:x.pathway,actualProcedure:x.procedure,procedure:x.procedure,operationPoints:Number(x.points||0),completedAt:m+'-01T00:00:00',orHours:0,legacyStatOnly:true})});const groups=[['Elective','elective'],['Inpatient','inpatient'],['Emergency','emergency'],['Day Surgery','day'],['Minor','minor']];let totalPts=0;monthlyStats.innerHTML=groups.map(([label,key])=>{const arr=a.filter(c=>c.pathway===key),pts=arr.reduce((z,c)=>z+Number(c.operationPoints??operationPointsFor(c,c.emergencyOptimization)),0);totalPts+=pts;return `<div class="monthStat"><b>${arr.length}</b><span>${label} Cases</span><em>${pts} Points</em></div>`}).join('')+`<div class="monthStat total"><b>${a.length}</b><span>Total Cases</span><em>${totalPts} Points</em></div>`;const proc={};a.forEach(c=>{const name=(c.actualProcedure||c.procedure||'Unknown').trim()||'Unknown';proc[name]||={count:0,points:0};proc[name].count++;proc[name].points+=Number(c.operationPoints??operationPointsFor(c,c.emergencyOptimization))});const rows=Object.entries(proc).sort((x,y)=>y[1].count-x[1].count||x[0].localeCompare(y[0]));monthlyProcedureRows.innerHTML=rows.length?rows.map(([name,v])=>`<tr><td>${esc(name)}</td><td>${v.count}</td><td>${v.points}</td></tr>`).join(''):'<tr><td colspan="3" class="empty">لا توجد عمليات مكتملة في هذا الشهر.</td></tr>';const hours=a.reduce((z,c)=>z+Number(c.orHours||0),0);monthlyOrHours.textContent='OR Utilization: '+(Math.round(hours*10)/10)+' hours';monthlyCaseList.innerHTML=a.length?a.slice().sort((x,y)=>String(y.completedAt).localeCompare(String(x.completedAt))).map(c=>`<div class="mini"><b>${esc(c.actualProcedure||c.procedure||'—')}</b>${c.legacyStatOnly?'سجل إحصائي قديم — بيانات المريض غير موجودة في النسخة الاحتياطية':(`${esc(c.patientName||'—')} · ${pathLabel(c.pathway)} · ${Number(c.operationPoints??operationPointsFor(c,c.emergencyOptimization))} points · ${new Date(c.completedAt).toLocaleDateString('en-GB')}`)}</div>`).join(''):'<div class="empty">لا توجد عمليات مكتملة في هذا الشهر.</div>'}
function renderReports(){groupReport.value=buildGroupReport();readinessReport.value=buildReadinessReport();historyList.innerHTML=state.events.length?state.events.slice().reverse().slice(0,120).map(e=>{const c=state.cases.find(x=>x.id===e.caseId);return `<div class="timeline"><b>${esc(e.detail||e.type)}</b><div>${esc(e.resident||'')}${c?' · '+esc(c.mrn||c.patientName):''}</div><small>${new Date(e.at).toLocaleString('ar-SA')}</small></div>`}).join(''):'<div class="empty">لا يوجد سجل بعد.</div>'}
function caseLineForGroup(c,i){const r=readiness(c),m=r.missing.map(x=>x.label);let t=`${i+1}. `;if(state.settings.includeNames)t+=`${c.patientName||'—'}\n`;t+=`MRN: ${c.mrn||'—'}\nالتشخيص: ${c.diagnosis||'—'}\nالعملية: ${c.procedure||'—'}\n`;if(r.key==='ready')t+='الحالة: مكتمل التجهيز\n';else if(r.key==='signature')t+='المتبقي: توقيع الأوراق\n';else t+=`الناقص: ${m.join('، ')||'—'}\n`;return t}
function buildGroupReport(){
  const date=new Date().toLocaleDateString('ar-SA');let t=`📋 ${state.settings.groupTitle}\n${date}\n\n━━━━━━━━ ملخص التوزيع ━━━━━━━━\n`;
  const rs=activeResidents();if(!rs.length)t+='لا يوجد مقيمون مضافون بعد.\n';
  rs.forEach(r=>{t+=`${r.name}: ${currentLoad(r.name)} حالة | جاهز ${readyLoad(r.name)} | عمليات ${r.operations||0} | تعويض ${r.compensation?('+'+r.compensation):'0'}\n`});
  t+=`\nغير موزع: ${unassigned().length} | استشاري فقط: ${activeCases().filter(c=>c.pathway!=='emergency'&&c.ownerState==='consultant').length}\n`;
  rs.forEach(r=>{const list=activeCases().filter(c=>c.ownerState==='assigned'&&c.residentOwner===r.name);t+=`\n━━━━━━━━ ${r.name} — ${list.length} حالات ━━━━━━━━\n`;if(!list.length)t+='لا توجد حالات حالية\n';list.forEach((c,i)=>{t+=caseLineForGroup(c,i)+'──────────────\n'})});
  const comps=rs.filter(r=>r.compensation>0);if(comps.length){t+='\n━━━━━━━━ التعويضات المستحقة ━━━━━━━━\n';comps.forEach(r=>t+=`• ${r.name}: +${r.compensation}\n`)}
  const cons=activeCases().filter(c=>c.ownerState==='consultant');if(cons.length)t+=`\nاستشاري فقط: ${cons.length} حالة (لا يعاد توزيعها على المقيمين).\n`;
  return t.trim();
}
function sectionReport(path){const title=path==='day'?'DSU / Day Surgery':'Elective',list=activeCases().filter(c=>c.pathway===path);let t=`━━━━━━━━ ${title} ━━━━━━━━\n`;for(const [key,label] of [['ready','جاهز للعمليات'],['signature','انتظار التوقيع'],['notready','غير جاهز']]){const a=list.filter(c=>readiness(c).key===key);t+=`【 ${label} — ${a.length} 】\n`;if(!a.length)t+='لا يوجد مرضى\n';a.forEach((c,i)=>{const r=readiness(c);t+=`${i+1}. ${c.patientName||'—'}\nرقم الملف\n${c.mrn||'—'}\nالتشخيص: ${c.diagnosis||'—'}\nالعملية: ${c.procedure||'—'}\n`;if(key==='ready')t+='الحالة: مكتمل التجهيز\n';else if(key==='signature')t+='المتبقي: توقيع الأوراق\n';else t+=`الناقص: ${r.missing.map(x=>x.label).join('، ')}\n`;if(c.ownerState==='consultant')t+='ملاحظة: استشاري فقط\n';t+='──────────────\n'});t+='\n'}return t}
function buildReadinessReport(){return (sectionReport('day')+'\n\n'+sectionReport('elective')).trim()}
async function shareGroupReport(){const text=buildGroupReport();if(navigator.share){try{await navigator.share({title:state.settings.groupTitle,text});return}catch(e){}}try{await navigator.clipboard.writeText(text);toastMsg('تم نسخ رسالة القروب')}catch(e){prompt('انسخ الرسالة:',text)}}
async function copyTextArea(id){const t=document.getElementById(id).value;try{await navigator.clipboard.writeText(t);toastMsg('تم النسخ')}catch(e){prompt('انسخ النص:',t)}}

function backupStatusText(){const t=state.settings.lastBackupAt;if(!t)return 'آخر نسخة احتياطية: لم يتم بعد — يُنصح بإنشاء نسخة الآن.';const d=new Date(t),days=Math.floor((Date.now()-d.getTime())/86400000);return 'آخر نسخة احتياطية: '+d.toLocaleString('ar-SA')+(days>=7?' — ⚠️ مر '+days+' أيام، أنشئ نسخة جديدة.':' — سليم')}
function openSettings(){groupTitle.value=state.settings.groupTitle;includeNames.checked=state.settings.includeNames;autoReplacement.checked=state.settings.autoReplacement;backupStatus.textContent=backupStatusText();settingsModal.classList.add('show')}
function saveSettings(){state.settings.groupTitle=groupTitle.value.trim()||'توزيع حالات الجراحة العامة';state.settings.includeNames=includeNames.checked;state.settings.autoReplacement=autoReplacement.checked;closeModal('settingsModal');renderAll()}
function exportBackup(){const now=new Date().toISOString();state.settings.lastBackupAt=now;persist();const data={format:'UNIFIED_SURGERY_RESIDENTS_V1',schemaVersion:1,exportedAt:now,state:structuredClone(state)};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Unified_Surgery_Backup_'+now.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);if(typeof backupStatus!=='undefined'&&backupStatus)backupStatus.textContent=backupStatusText();toastMsg('تم إنشاء نسخة احتياطية كاملة')}
function restoreBackup(ev){const f=ev.target.files?.[0];ev.target.value='';if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.state||d.format!=='UNIFIED_SURGERY_RESIDENTS_V1'||!Array.isArray(d.state.cases)||!Array.isArray(d.state.residents))throw 0;const restored=normalizeState(d.state);if(!confirm('سيتم استبدال البيانات الحالية بنسخة '+(d.exportedAt?new Date(d.exportedAt).toLocaleString('ar-SA'):'غير مؤرخة')+'. متابعة؟'))return;state=restored;persist();closeModal('settingsModal');renderAll();toastMsg('تمت الاستعادة بنجاح')}catch(e){alert('ملف النسخة الاحتياطية غير صالح أو غير مكتمل')}};r.readAsText(f)}
function closeModal(id){document.getElementById(id).classList.remove('show')}
['caseModal','replyModal','operationModal','emergencyModal','assignModal','settingsModal'].forEach(id=>document.getElementById(id).addEventListener('click',e=>{if(e.target.id===id)closeModal(id)}));
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderAll();
