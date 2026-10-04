const KEY2="surgery_or_days_v2";
const KEY1="unified_surgery_residents_v1";
const CHECKS=[["cxr","أشعة صدر"],["blood","تحليل دم"],["virology","Virology"],["consult","استشارات"],["anesthesia","تخدير"],["ecg","تخطيط قلب"],["documents","توقيع الأوراق"],["patientContact","الاتصال بالمريض وأخذ الموافقة على يوم العملية"]];
let state=loadState();
let patientFilter="pool";
let currentDayId="";
let editingCaseId="";
let linkingCaseId="";

function clone(x){return JSON.parse(JSON.stringify(x))}
function nowIso(){return new Date().toISOString()}
function uid(prefix){return prefix+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)}
function eventObj(type,caseId,resident,detail){return {id:uid("E"),type:type||"",caseId:caseId||"",resident:resident||"",detail:detail||"",at:nowIso()}}
function logEvent(type,c,resident,detail){state.events.push(eventObj(type,c&&c.id?c.id:"",resident||"",detail||""))}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]})}

function blankState(){
  return {
    version:2,
    cases:[],
    residents:[],
    removedResidents:[],
    orDays:[],
    events:[],
    legacyMonthlyRecovered:[],
    settings:{groupTitle:"General Surgery Residents",includeNames:true,lastBackupAt:"",dsuWeekday:0,electiveWeekday:4},
    createdAt:nowIso()
  };
}

function migrateV1(old){
  const s=blankState();
  s.createdAt=old&&old.createdAt?old.createdAt:nowIso();
  s.events=clone(old&&old.events?old.events:[]);
  s.residents=clone(old&&old.residents?old.residents:[]).map(function(r){
    if(r.active==null)r.active=true;
    return r;
  });
  s.removedResidents=clone(old&&old.deletedResidents?old.deletedResidents:[]);
  s.legacyMonthlyRecovered=clone(old&&old.legacyMonthlyRecovered?old.legacyMonthlyRecovered:[]);
  s.settings.groupTitle=old&&old.settings&&old.settings.groupTitle?old.settings.groupTitle:"General Surgery Residents";
  s.settings.includeNames=!(old&&old.settings&&old.settings.includeNames===false);
  s.settings.lastBackupAt=old&&old.settings&&old.settings.lastBackupAt?old.settings.lastBackupAt:"";
  s.cases=clone(old&&old.cases?old.cases:[]).map(function(c){
    c.custom=c.custom||[];
    c.checklist=c.checklist||{};
    if(!c.completedAt&&!c.archived&&c.pathway!=="emergency"&&!c.checklist.patientContact){
      c.checklist.patientContact={required:true,done:false};
    }
    c.history=c.history||[];
    c.orDayId=c.orDayId||"";
    c.followUpBy=c.followUpBy||c.preparedBy||"";
    if(!c.preparedBy&&c.followUpBy)c.preparedBy=c.followUpBy;
    c.dayRole=c.dayRole||"main";
    if(c.completedAt){
      c.archived=true;
      c.ownerState="done";
    }else if(c.archived){
      c.legacyResidentOwner=c.legacyResidentOwner||c.residentOwner||"";
      c.residentOwner="";
      c.ownerState="archived";
      c.orDayId="";
      c.preparedBy="";
    }else{
      c.legacyResidentOwner=c.legacyResidentOwner||c.residentOwner||"";
      c.residentOwner="";
      c.ownerState="pool";
      c.orDayId="";
      c.preparedBy="";
      c.dayRole="main";
    }
    if(c.orHours==null)c.orHours=0;
    return c;
  });
  s.events.push(eventObj("migration_v2","","","ترحيل البيانات إلى نظام توزيع أيام العمليات؛ الحالات النشطة عادت إلى Patient Pool"));
  return normalizeV2(s);
}

function normalizeV2(s){
  s=s||blankState();
  s.version=2;
  s.cases=Array.isArray(s.cases)?s.cases:[];
  s.residents=Array.isArray(s.residents)?s.residents:[];
  s.removedResidents=Array.isArray(s.removedResidents)?s.removedResidents:[];
  s.orDays=Array.isArray(s.orDays)?s.orDays:[];
  s.events=Array.isArray(s.events)?s.events:[];
  s.legacyMonthlyRecovered=Array.isArray(s.legacyMonthlyRecovered)?s.legacyMonthlyRecovered:[];
  s.settings=s.settings||{};
  s.settings.groupTitle=s.settings.groupTitle||"General Surgery Residents";
  if(s.settings.includeNames==null)s.settings.includeNames=true;
  if(s.settings.lastBackupAt==null)s.settings.lastBackupAt="";
  if(s.settings.dsuWeekday==null)s.settings.dsuWeekday=0;
  if(s.settings.electiveWeekday==null)s.settings.electiveWeekday=4;
  s.residents.forEach(function(r){if(r.active==null)r.active=true});
  s.orDays.forEach(function(d){
    d.residents=Array.isArray(d.residents)?d.residents:[];
    d.status=d.status||"open";
    d.kind=d.kind||"additional";
    d.label=d.label||"";
    d.notes=d.notes||"";
  });
  s.cases.forEach(function(c){
    c.custom=c.custom||[];
    c.checklist=c.checklist||{};
    if(!c.completedAt&&!c.archived&&!c.checklist.patientContact){
      c.checklist.patientContact={required:true,done:false};
    }else if(!c.checklist.patientContact){
      c.checklist.patientContact={required:false,done:true};
    }
    c.history=c.history||[];
    c.orDayId=c.orDayId||"";
    c.preparedBy=c.preparedBy||"";
    c.dayRole=c.dayRole||"main";
    if(c.orHours==null)c.orHours=0;
    if(c.completedAt){c.archived=true;c.ownerState="done"}
    else if(c.archived){c.ownerState="archived"}
    else{c.ownerState="pool"}
  });
  return s;
}

function loadState(){
  try{
    const v2=JSON.parse(localStorage.getItem(KEY2)||"null");
    if(v2&&v2.version===2)return normalizeV2(v2);
  }catch(e){}
  try{
    const v1=JSON.parse(localStorage.getItem(KEY1)||"null");
    if(v1&&v1.version===1){
      const migrated=migrateV1(v1);
      localStorage.setItem(KEY2,JSON.stringify(migrated));
      return migrated;
    }
  }catch(e){}
  return blankState();
}

function persist(){localStorage.setItem(KEY2,JSON.stringify(state))}
function activeResidents(){return state.residents.filter(function(r){return r.active!==false})}
function activePatientCases(){return state.cases.filter(function(c){return !c.archived&&!c.completedAt&&c.pathway!=="emergency"})}
function poolCases(){return activePatientCases().filter(function(c){return !c.orDayId})}
function linkedCases(){return activePatientCases().filter(function(c){return !!c.orDayId})}
function getCase(id){return state.cases.find(function(c){return c.id===id})}
function getDay(id){return state.orDays.find(function(d){return d.id===id})}
function dayCases(id,includeDone){
  return state.cases.filter(function(c){return c.orDayId===id&&(includeDone||!c.completedAt)})
}
function readiness(c){
  const missing=[];
  CHECKS.forEach(function(k){
    const x=c.checklist&&c.checklist[k[0]];
    if(x&&x.required&&!x.done)missing.push({key:k[0],label:k[1]});
  });
  (c.custom||[]).forEach(function(x,i){
    if(x.required!==false&&!x.done)missing.push({key:"custom_"+i,label:x.name||"متطلب إضافي"});
  });
  if(!missing.length)return {key:"ready",label:"جاهز",missing:[]};
  if(missing.length===1&&missing[0].key==="documents")return {key:"signature",label:"انتظار توقيع",missing:missing};
  return {key:"notready",label:"غير جاهز",missing:missing};
}
function pathLabel(p){
  return {day:"DSU / Day Surgery",elective:"Elective",inpatient:"Inpatient",minor:"Minor",emergency:"Emergency"}[p]||p||"—";
}
function dayKindLabel(k,d){
  if(k==="dsu")return "DSU";
  if(k==="elective")return "Elective";
  return d&&d.label?d.label:"Additional OR Day";
}
function dayKindClass(k){return k==="dsu"?"dsu":k==="elective"?"elective":"additional"}
function gregDate(date){
  if(!date)return "—";
  return new Date(date+"T12:00:00").toLocaleDateString("ar-SA-u-ca-gregory",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function ymFromDate(date){return String(date||"").slice(0,7)}
function defaultMonth(){
  const n=new Date();
  let y=n.getFullYear(),m=n.getMonth()+1;
  if(n.getDate()>=25){m++;if(m===13){m=1;y++}}
  return String(y)+"-"+String(m).padStart(2,"0");
}
function monthTitle(ym){
  if(!ym)return "";
  return new Date(ym+"-01T12:00:00").toLocaleDateString("ar-SA-u-ca-gregory",{month:"long",year:"numeric"});
}
function dayByDateKind(date,kind){return state.orDays.find(function(d){return d.date===date&&d.kind===kind})}
function generateStandardDays(ym){
  if(!/^\d{4}-\d{2}$/.test(ym))return 0;
  const parts=ym.split("-"),y=Number(parts[0]),m=Number(parts[1]),last=new Date(y,m,0).getDate();
  let added=0;
  for(let n=1;n<=last;n++){
    const dt=new Date(y,m-1,n,12,0,0),dow=dt.getDay();
    let kind="";
    if(dow===0)kind="dsu";
    if(dow===4)kind="elective";
    if(!kind)continue;
    const date=ym+"-"+String(n).padStart(2,"0");
    if(dayByDateKind(date,kind))continue;
    state.orDays.push({id:"OR-"+date+"-"+kind,date:date,kind:kind,label:"",residents:[],status:"open",notes:"",createdAt:nowIso()});
    added++;
  }
  if(added)state.events.push(eventObj("generate_days","","","إنشاء "+added+" يوم عمليات أساسي لشهر "+ym));
  return added;
}
function compatiblePoolForDay(day){
  return poolCases().filter(function(c){
    if(!c.followUpBy)return false;
    if(day.residents.indexOf(c.followUpBy)<0)return false;
    if(readiness(c).key!=="ready")return false;
    if(day.kind==="dsu")return c.pathway==="day";
    if(day.kind==="elective")return c.pathway==="elective";
    return c.pathway!=="emergency";
  });
}
function residentDayStats(name,ym){
  const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym&&d.residents.indexOf(name)>=0});
  const solo=days.filter(function(d){return d.residents.length===1}).length;
  const shared=days.filter(function(d){return d.residents.length>1}).length;
  const ids=days.map(function(d){return d.id});
  const prepared=state.cases.filter(function(c){return ids.indexOf(c.orDayId)>=0&&c.preparedBy===name}).length;
  const operated=state.cases.filter(function(c){
    return c.completedAt&&String(c.completedAt).slice(0,7)===ym&&String(c.performedBy||"").trim().toLowerCase()===String(name).trim().toLowerCase();
  }).length;
  return {solo:solo,shared:shared,total:days.length,prepared:prepared,operated:operated};
}
function operationPointsFor(c,opt){
  if(c&&c.pathway==="emergency")return opt==="non_optimized"?4:3;
  return 2;
}
function backupStatusText(){
  const t=state.settings.lastBackupAt;
  if(!t)return "آخر نسخة احتياطية: لم يتم بعد — يُنصح بإنشاء نسخة الآن.";
  const d=new Date(t),days=Math.floor((Date.now()-d.getTime())/86400000);
  return "آخر نسخة احتياطية: "+d.toLocaleString("ar-SA")+(days>=7?" — ⚠️ مر "+days+" أيام، أنشئ نسخة جديدة.":" — سليم");
}
