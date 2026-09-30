function $(id){return document.getElementById(id)}
function toastMsg(t){const x=$("toast");x.textContent=t;x.classList.add("show");setTimeout(function(){x.classList.remove("show")},2400)}
function closeModal(id){$(id).classList.remove("show")}
function openModal(id){$(id).classList.add("show")}
function showTab(t){
  ["schedule","patients","operations","residents","monthly","reports"].forEach(function(x){
    $(x+"Section").style.display=x===t?"block":"none";
    $("tab"+x.charAt(0).toUpperCase()+x.slice(1)).classList.toggle("active",x===t);
  });
  renderAll();
}
function renderAll(){
  persist();
  renderSchedule();
  renderPatients();
  renderOperations();
  renderResidents();
  renderMonthlyReport();
  renderReports();
}

function renderSchedule(){
  const ym=$("scheduleMonth").value||defaultMonth();
  $("scheduleMonth").value=ym;
  const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
  $("sDays").textContent=days.length;
  $("sAssigned").textContent=days.filter(function(d){return d.residents.length>0}).length;
  $("sUnassigned").textContent=days.filter(function(d){return d.residents.length===0}).length;
  $("sAdditional").textContent=days.filter(function(d){return d.kind==="additional"}).length;
  $("scheduleList").innerHTML=days.length?days.map(dayCardHtml).join(""):'<div class="empty">لا توجد أيام عمليات لهذا الشهر. اضغط «إنشاء الأحد والخميس».</div>';
}
function dayCardHtml(d){
  const active=dayCases(d.id,false);
  const all=dayCases(d.id,true);
  const main=active.filter(function(c){return c.dayRole!=="reserve"}).length;
  const reserve=active.filter(function(c){return c.dayRole==="reserve"}).length;
  const ready=active.filter(function(c){return readiness(c).key==="ready"}).length;
  const done=all.filter(function(c){return !!c.completedAt}).length;
  const residents=d.residents.length?d.residents.map(function(n){return '<span class="residentChip">'+esc(n)+'</span>'}).join(""):'<span class="residentChip none">غير محدد</span>';
  const closed=d.status==="completed";
  let extra="";
  if(d.kind==="additional")extra='<button class="btn violet" onclick="shareAdditionalAnnouncement(\''+d.id+'\')">إعلان اليوم الإضافي</button>';
  return '<div class="card dayCard '+dayKindClass(d.kind)+'">'+
    '<div class="row"><div><div class="dayDate">'+esc(gregDate(d.date))+'</div><div class="sub">'+esc(dayKindLabel(d.kind,d))+(closed?' · مغلق':'')+'</div><div class="residentChips">'+residents+'</div></div>'+
    '<span class="badge '+dayKindClass(d.kind)+'">'+esc(dayKindLabel(d.kind,d))+'</span></div>'+
    '<div class="dayCounts"><div><b>'+main+'</b>أساسي</div><div><b>'+reserve+'</b>احتياط</div><div><b>'+ready+'</b>جاهز</div><div><b>'+done+'</b>تمت</div></div>'+
    '<div class="actions"><button class="btn dark" onclick="openDay(\''+d.id+'\')">فتح القائمة</button>'+
    (closed?'<button class="btn secondary" onclick="reopenDay(\''+d.id+'\')">إعادة فتح</button>':'<button class="btn secondary" onclick="openDayAssignments(\''+d.id+'\')">المقيمون</button>')+
    '<button class="btn secondary" onclick="shareDay(\''+d.id+'\')">رسالة القروب</button>'+extra+
    (!closed?'<button class="btn danger" onclick="deleteDay(\''+d.id+'\')">حذف اليوم</button>':'')+'</div></div>';
}
function createStandardDays(){
  const n=generateStandardDays($("scheduleMonth").value);
  renderAll();
  toastMsg(n?"تم إنشاء "+n+" يوم عمليات":"الأيام الأساسية موجودة مسبقًا");
}
function openAdditionalDay(){
  $("addDayDate").value="";
  $("addDayLabel").value="Additional OR Day";
  $("addDayNotes").value="";
  openModal("additionalDayModal");
}
function saveAdditionalDay(){
  const date=$("addDayDate").value;
  if(!date){alert("حدد التاريخ.");return}
  const d={id:uid("OR"),date:date,kind:"additional",label:$("addDayLabel").value.trim()||"Additional OR Day",residents:[],status:"open",notes:$("addDayNotes").value.trim(),createdAt:nowIso()};
  state.orDays.push(d);
  logEvent("additional_day",null,"","إضافة يوم عمليات إضافي "+date);
  closeModal("additionalDayModal");
  if(ymFromDate(date)!==$("scheduleMonth").value)$("scheduleMonth").value=ymFromDate(date);
  renderAll();
  toastMsg("تمت إضافة يوم العمليات الإضافي");
}
function deleteDay(id){
  const d=getDay(id);if(!d)return;
  if(dayCases(id,true).some(function(c){return !!c.completedAt})){alert("لا يمكن حذف يوم يحتوي على عمليات مكتملة. يمكنك إبقاؤه كسجل تاريخي.");return}
  if(!confirm("حذف "+gregDate(d.date)+"؟ ستعود كل الحالات المرتبطة به إلى Patient Pool."))return;
  dayCases(id,false).forEach(function(c){c.orDayId="";c.preparedBy="";c.dayRole="main"});
  state.orDays=state.orDays.filter(function(x){return x.id!==id});
  logEvent("day_deleted",null,"","حذف يوم عمليات "+d.date);
  renderAll();
}
function reopenDay(id){const d=getDay(id);if(!d)return;d.status="open";delete d.completedAt;logEvent("day_reopened",null,"","إعادة فتح يوم "+d.date);renderAll()}
function closeOperatingDay(id){
  const d=getDay(id);if(!d)return;
  const pending=dayCases(id,false);
  if(!confirm("إغلاق يوم العمليات؟ سيتم إرجاع "+pending.length+" حالة لم تتم إلى Patient Pool مع الاحتفاظ بتجهيزها."))return;
  pending.forEach(function(c){c.orDayId="";c.preparedBy="";c.dayRole="main"});
  d.status="completed";d.completedAt=nowIso();
  logEvent("day_completed",null,"","إغلاق يوم العمليات "+d.date+" وإرجاع "+pending.length+" حالة للمخزون");
  closeModal("dayModal");
  renderAll();
  toastMsg("تم إغلاق اليوم");
}

function openDay(id){
  currentDayId=id;
  renderDayModal();
  openModal("dayModal");
}
function renderDayModal(){
  const d=getDay(currentDayId);if(!d)return;
  $("dayModalTitle").textContent=gregDate(d.date)+" — "+dayKindLabel(d.kind,d);
  $("dayModalInfo").innerHTML='<b>المقيمون:</b> '+(d.residents.length?d.residents.map(esc).join(" + "):"غير محدد")+(d.notes?'<br><b>ملاحظات:</b> '+esc(d.notes):"");
  const list=dayCases(d.id,true).sort(function(a,b){
    if(!!a.completedAt!==!!b.completedAt)return a.completedAt?1:-1;
    if(a.dayRole!==b.dayRole)return a.dayRole==="reserve"?1:-1;
    return String(a.patientName||"").localeCompare(String(b.patientName||""));
  });
  $("dayCaseList").innerHTML=list.length?list.map(dayCaseHtml).join(""):'<div class="empty">لم تتم إضافة حالات إلى هذا اليوم بعد.</div>';
  $("dayAddCaseBtn").disabled=d.status==="completed";
  $("dayAssignBtn").disabled=d.status==="completed";
  $("dayCloseBtn").style.display=d.status==="completed"?"none":"inline-block";
}
function dayCaseHtml(c){
  const r=readiness(c),done=!!c.completedAt;
  const role=c.dayRole==="reserve"?"reserve":"main";
  const roleLabel=role==="reserve"?"احتياط":"أساسي";
  let buttons='<button class="btn secondary" onclick="openCase(\''+c.id+'\')">التجهيز</button>';
  if(!done){
    buttons+='<button class="btn secondary" onclick="editDayCase(\''+c.id+'\')">المقيم/الدور</button><button class="btn warn" onclick="unlinkCase(\''+c.id+'\')">إرجاع للمخزون</button>';
    if(r.key==="ready")buttons+='<button class="btn ok" onclick="openOperation(\''+c.id+'\')">✅ تمت العملية</button>';
  }
  return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(c.diagnosis||"")+' · '+esc(c.procedure||"")+'</div></div>'+
    '<div style="display:flex;gap:5px;flex-wrap:wrap"><span class="badge '+(done?"done":r.key)+'">'+(done?"تمت":esc(r.label))+'</span><span class="badge '+role+'">'+roleLabel+'</span></div></div>'+
    '<div class="caseMeta"><div><b>حضّرها</b>'+esc(c.preparedBy||"غير محدد")+'</div><div><b>النوع</b>'+esc(pathLabel(c.pathway))+'</div><div><b>النواقص</b>'+r.missing.length+'</div><div><b>العملية الفعلية</b>'+esc(c.actualProcedure||c.procedure||"—")+'</div></div>'+
    '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div>'+
    '<div class="actions">'+buttons+'</div></div>';
}

function openDayAssignments(id){
  const d=getDay(id);if(!d)return;
  currentDayId=id;
  $("assignDayTitle").textContent="مقيمو "+gregDate(d.date);
  const rs=activeResidents();
  $("dayResidentChecks").innerHTML=rs.length?rs.map(function(r){
    return '<label class="pickerItem"><input type="checkbox" style="width:auto" value="'+esc(r.name)+'" '+(d.residents.indexOf(r.name)>=0?"checked":"")+'> '+esc(r.name)+'</label>';
  }).join(""):'<div class="empty">لا يوجد مقيمون. أضفهم من صفحة المقيمين.</div>';
  openModal("assignDayModal");
}
function saveDayAssignments(){
  const d=getDay(currentDayId);if(!d)return;
  const selected=Array.from($("dayResidentChecks").querySelectorAll('input[type="checkbox"]:checked')).map(function(x){return x.value});
  const removed=d.residents.filter(function(n){return selected.indexOf(n)<0});
  d.residents=selected;
  dayCases(d.id,false).forEach(function(c){
    if(removed.indexOf(c.preparedBy)>=0)c.preparedBy="";
    if(!c.preparedBy&&selected.length===1)c.preparedBy=selected[0];
  });
  logEvent("day_residents",null,selected.join(" + "),"تحديث مقيمي يوم "+d.date);
  closeModal("assignDayModal");
  renderAll();
  if($("dayModal").classList.contains("show"))renderDayModal();
}

function openLinkCase(){
  linkingCaseId="";
  const d=getDay(currentDayId);if(!d)return;
  const list=compatiblePoolForDay(d);
  $("linkCaseSelect").disabled=false;
  $("linkCaseSelect").innerHTML=list.length?list.map(function(c){
    return '<option value="'+esc(c.id)+'">'+esc(c.mrn||"—")+' — '+esc(c.patientName||"—")+' — '+esc(c.procedure||"")+'</option>';
  }).join(""):'<option value="">لا توجد حالات مناسبة في Patient Pool</option>';
  fillLinkResidentOptions(d,"");
  $("linkRole").value="main";
  $("linkCaseDayInfo").textContent=gregDate(d.date)+" — "+dayKindLabel(d.kind,d);
  openModal("linkCaseModal");
}
function editDayCase(caseId){
  const c=getCase(caseId);if(!c)return;
  const d=getDay(c.orDayId);if(!d)return;
  currentDayId=d.id;linkingCaseId=c.id;
  $("linkCaseSelect").disabled=true;
  $("linkCaseSelect").innerHTML='<option value="'+esc(c.id)+'">'+esc(c.mrn||"—")+' — '+esc(c.patientName||"—")+'</option>';
  fillLinkResidentOptions(d,c.preparedBy||"");
  $("linkRole").value=c.dayRole||"main";
  $("linkCaseDayInfo").textContent=gregDate(d.date)+" — "+dayKindLabel(d.kind,d);
  openModal("linkCaseModal");
}
function fillLinkResidentOptions(d,selected){
  let opts='<option value="">غير محدد</option>';
  d.residents.forEach(function(n){opts+='<option value="'+esc(n)+'" '+(n===selected?"selected":"")+'>'+esc(n)+'</option>'});
  $("linkPreparedBy").innerHTML=opts;
}
function saveLinkCase(){
  const d=getDay(currentDayId);if(!d)return;
  const id=linkingCaseId||$("linkCaseSelect").value;
  const c=getCase(id);if(!c){alert("اختر حالة.");return}
  if(!linkingCaseId&&c.orDayId){alert("الحالة مرتبطة بيوم آخر.");return}
  c.orDayId=d.id;
  c.preparedBy=$("linkPreparedBy").value;
  c.dayRole=$("linkRole").value;
  c.updatedAt=nowIso();
  logEvent(linkingCaseId?"day_case_edit":"day_case_link",c,c.preparedBy,"ربط الحالة بيوم "+d.date+" — "+(c.dayRole==="reserve"?"احتياط":"أساسي"));
  closeModal("linkCaseModal");
  renderAll();
  if($("dayModal").classList.contains("show"))renderDayModal();
}
function toggleDayRole(id){
  const c=getCase(id);if(!c||c.completedAt)return;
  c.dayRole=c.dayRole==="reserve"?"main":"reserve";c.updatedAt=nowIso();
  logEvent("day_role",c,c.preparedBy||"","تغيير الحالة إلى "+(c.dayRole==="reserve"?"احتياط":"أساسي"));
  renderAll();if($("dayModal").classList.contains("show"))renderDayModal();
}
function unlinkCase(id){
  const c=getCase(id);if(!c||c.completedAt)return;
  if(!confirm("إرجاع الحالة إلى Patient Pool؟ سيبقى مستوى تجهيزها كما هو."))return;
  c.orDayId="";c.preparedBy="";c.dayRole="main";c.updatedAt=nowIso();
  logEvent("day_case_unlink",c,"","إرجاع الحالة إلى Patient Pool");
  renderAll();renderDayModal();
}

function setPatientFilter(el){
  document.querySelectorAll("#patientFilters .chip").forEach(function(x){x.classList.remove("active")});
  el.classList.add("active");patientFilter=el.dataset.f;renderPatients();
}
function renderPatients(){
  const q=String($("patientSearch").value||"").trim().toLowerCase();
  let list=state.cases.filter(function(c){
    if(patientFilter==="archive")return c.archived||!!c.completedAt;
    if(c.archived||c.completedAt||c.pathway==="emergency")return false;
    if(patientFilter==="pool")return !c.orDayId;
    if(patientFilter==="linked")return !!c.orDayId;
    if(patientFilter==="ready")return readiness(c).key==="ready";
    if(patientFilter==="notready")return readiness(c).key!=="ready";
    return true;
  });
  if(q)list=list.filter(function(c){return [c.patientName,c.mrn,c.diagnosis,c.procedure].join(" ").toLowerCase().indexOf(q)>=0});
  list.sort(function(a,b){return String(a.patientName||"").localeCompare(String(b.patientName||""))});
  $("patientsList").innerHTML=list.length?list.map(patientCardHtml).join(""):'<div class="empty">لا توجد حالات في هذا العرض.</div>';
}
function patientCardHtml(c){
  const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
  const stateBadge=c.completedAt?"done":c.orDayId?"main":"pool";
  const stateText=c.completedAt?"تمت":c.orDayId?"ضمن قائمة "+(d?gregDate(d.date):""):"Patient Pool";
  return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(pathLabel(c.pathway))+' · '+esc(c.diagnosis||"")+'</div></div><div style="display:flex;gap:5px;flex-wrap:wrap"><span class="badge '+r.key+'">'+esc(r.label)+'</span><span class="badge '+stateBadge+'">'+esc(stateText)+'</span></div></div>'+
    '<div class="caseMeta"><div><b>العملية</b>'+esc(c.procedure||"—")+'</div><div><b>يوم العمليات</b>'+esc(d?gregDate(d.date):"—")+'</div><div><b>حضّرها</b>'+esc(c.preparedBy||"—")+'</div><div><b>المالك القديم</b>'+esc(c.legacyResidentOwner||"—")+'</div></div>'+
    '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div>'+
    '<div class="actions">'+(!c.completedAt&&c.pathway!=="emergency"?'<button class="btn secondary" onclick="openCase(\''+c.id+'\')">تعديل التجهيز</button>':'')+(c.orDayId?'<button class="btn dark" onclick="openDay(\''+c.orDayId+'\')">فتح يوم العمليات</button>':'')+'</div></div>';
}
function editorRow(k,l,x){
  return '<div class="checkitem"><span>'+l+'</span><label><input type="checkbox" data-req="'+k+'" '+(x.required?"checked":"")+' onchange="syncDoneDisabled(\''+k+'\')"> مطلوب</label><label><input type="checkbox" data-done="'+k+'" '+(x.done?"checked":"")+' '+(!x.required?"disabled":"")+'> تم</label></div>';
}
function syncDoneDisabled(k){
  const req=document.querySelector('[data-req="'+k+'"]'),done=document.querySelector('[data-done="'+k+'"]');
  done.disabled=!req.checked;if(!req.checked)done.checked=false;
}
function openCase(id){
  const c=id?getCase(id):null;editingCaseId=id||"";
  $("caseModalTitle").textContent=c?"تعديل الحالة":"إضافة حالة";
  $("patientName").value=c&&c.patientName?c.patientName:"";
  $("mrn").value=c&&c.mrn?c.mrn:"";
  $("pathway").value=c&&c.pathway&&c.pathway!=="emergency"?c.pathway:"elective";
  $("diagnosis").value=c&&c.diagnosis?c.diagnosis:"";
  $("procedure").value=c&&c.procedure?c.procedure:"";
  $("caseNotes").value=c&&c.notes?c.notes:"";
  const chk=c&&c.checklist?c.checklist:Object.fromEntries(CHECKS.map(function(k){return [k[0],{required:true,done:false}]}));
  $("checklistEditor").innerHTML=CHECKS.map(function(k){return editorRow(k[0],k[1],chk[k[0]]||{required:false,done:false})}).join("");
  $("archiveBtn").style.display=c?"inline-block":"none";
  $("archiveBtn").textContent=c&&c.archived?"إعادة من الأرشيف":"أرشفة";
  openModal("caseModal");
}
function saveCase(){
  if(!$("mrn").value.trim()&&!$("patientName").value.trim()){alert("أدخل اسم المريض أو رقم الملف.");return}
  let c=editingCaseId?getCase(editingCaseId):null;
  const isNew=!c;
  if(!c)c={id:uid("CASE"),createdAt:nowIso(),archived:false,ownerState:"pool",custom:[],history:[],orDayId:"",preparedBy:"",dayRole:"main"};
  c.patientName=$("patientName").value.trim();
  c.mrn=$("mrn").value.trim();
  c.pathway=$("pathway").value;
  c.diagnosis=$("diagnosis").value.trim();
  c.procedure=$("procedure").value.trim();
  c.notes=$("caseNotes").value.trim();
  c.checklist={};
  CHECKS.forEach(function(k){
    c.checklist[k[0]]={required:document.querySelector('[data-req="'+k[0]+'"]').checked,done:document.querySelector('[data-done="'+k[0]+'"]').checked};
  });
  c.updatedAt=nowIso();
  if(isNew){state.cases.unshift(c);logEvent("case_added",c,"","إضافة حالة إلى Patient Pool")}
  else logEvent("case_updated",c,c.preparedBy||"","تحديث بيانات وتجهيز الحالة");
  closeModal("caseModal");renderAll();
  if($("dayModal").classList.contains("show"))renderDayModal();
}
function toggleArchiveCase(){
  const c=getCase(editingCaseId);if(!c)return;
  if(c.completedAt){alert("العملية مكتملة ومحفوظة في التقرير الشهري.");return}
  if(!c.archived){
    if(!confirm("أرشفة الحالة؟ إذا كانت مرتبطة بيوم عمليات ستُزال منه."))return;
    c.archived=true;c.ownerState="archived";c.orDayId="";c.preparedBy="";c.dayRole="main";
  }else{c.archived=false;c.ownerState="pool"}
  c.updatedAt=nowIso();closeModal("caseModal");renderAll();
}

function renderOperations(){
  const ym=$("operationsMonth").value||defaultMonth();
  $("operationsMonth").value=ym;
  const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
  $("operationsDays").innerHTML=days.length?days.map(operationDayHtml).join(""):'<div class="empty">لا توجد أيام عمليات لهذا الشهر.</div>';
}
function operationDayHtml(d){
  const all=dayCases(d.id,true),active=all.filter(function(c){return !c.completedAt});
  const ready=active.filter(function(c){return readiness(c).key==="ready"});
  const done=all.filter(function(c){return !!c.completedAt}).length;
  let caseHtml=active.length?active.map(function(c){
    const r=readiness(c);
    return '<div class="mini"><div class="row"><div><b>'+esc(c.patientName||"—")+' — '+esc(c.procedure||"")+'</b>'+esc(c.preparedBy||"غير محدد")+' · '+(c.dayRole==="reserve"?"احتياط":"أساسي")+' · '+esc(r.label)+'</div>'+(r.key==="ready"?'<button class="btn ok" onclick="openOperation(\''+c.id+'\')">✅ تمت</button>':'')+'</div></div>';
  }).join(""):'<div class="empty">لا توجد حالات مرتبطة.</div>';
  return '<div class="card dayCard '+dayKindClass(d.kind)+'"><div class="row"><div><div class="name">'+esc(gregDate(d.date))+' — '+esc(dayKindLabel(d.kind,d))+'</div><div class="sub">'+(d.residents.length?esc(d.residents.join(" + ")):"غير محدد")+' · جاهز '+ready.length+' · تمت '+done+'</div></div><button class="btn dark" onclick="openDay(\''+d.id+'\')">فتح القائمة</button></div><div class="miniList" style="margin-top:10px">'+caseHtml+'</div></div>';
}
function openOperation(id){
  const c=getCase(id);if(!c)return;
  const d=c.orDayId?getDay(c.orDayId):null;
  $("opCaseId").value=c.id;
  $("opCaseInfo").innerHTML='<b>'+esc(c.patientName||"—")+'</b> · MRN '+esc(c.mrn||"—")+'<br>'+esc(c.procedure||"")+(d?'<br>'+esc(gregDate(d.date))+' · حضّرها: '+esc(c.preparedBy||"غير محدد"):"");
  $("opProcedure").value=c.actualProcedure||c.procedure||"";
  $("opOperator").value=c.preparedBy||(d&&d.residents.length===1?d.residents[0]:"");
  $("opDuration").value=c.orHours?Math.round(c.orHours*60):"";
  openModal("operationModal");
}
function confirmOperation(){
  const c=getCase($("opCaseId").value);if(!c)return;
  const proc=$("opProcedure").value.trim();if(!proc){alert("أدخل العملية الفعلية.");return}
  c.actualProcedure=proc;
  c.performedBy=$("opOperator").value.trim()||"Consultant";
  c.operationPoints=2;
  c.orHours=Math.max(0,(Number($("opDuration").value)||0)/60);
  c.completedAt=nowIso();c.archived=true;c.ownerState="done";c.updatedAt=nowIso();
  logEvent("operation_done",c,c.performedBy,"تمت العملية وأضيفت للتقرير الشهري");
  closeModal("operationModal");renderAll();
  if($("dayModal").classList.contains("show"))renderDayModal();
  toastMsg("تمت إضافة العملية للتقرير الشهري");
}
function openEmergencyOperation(){
  ["emPatient","emMrn","emDiagnosis","emProcedure","emDuration","emOperator"].forEach(function(id){$(id).value=""});
  $("emOptimization").value="optimized";openModal("emergencyModal");
}
function saveEmergencyOperation(){
  const proc=$("emProcedure").value.trim();if(!proc){alert("أدخل اسم العملية.");return}
  const opt=$("emOptimization").value;
  const c={id:uid("EM"),mrn:$("emMrn").value.trim(),patientName:$("emPatient").value.trim(),diagnosis:$("emDiagnosis").value.trim(),procedure:proc,actualProcedure:proc,pathway:"emergency",archived:true,checklist:{},custom:[],notes:"",ownerState:"done",orDayId:"",preparedBy:"",dayRole:"main",performedBy:$("emOperator").value.trim()||"Consultant",emergencyOptimization:opt,operationPoints:opt==="non_optimized"?4:3,orHours:Math.max(0,(Number($("emDuration").value)||0)/60),completedAt:nowIso(),createdAt:nowIso(),history:[]};
  state.cases.unshift(c);logEvent("emergency_operation",c,c.performedBy,"تسجيل عملية طوارئ مباشرة — "+c.operationPoints+" نقاط");
  closeModal("emergencyModal");renderAll();toastMsg("تمت إضافة عملية الطوارئ للتقرير الشهري");
}

function renderResidents(){
  const ym=$("residentMonth").value||$("scheduleMonth").value||defaultMonth();
  $("residentMonth").value=ym;
  const rs=activeResidents();
  $("residentStatsList").innerHTML=rs.length?rs.map(function(r){
    const x=residentDayStats(r.name,ym);
    return '<div class="resRow"><div><b class="big">'+esc(r.name)+'</b><div class="sub">'+x.total+' يوم عمليات</div></div><span>'+x.solo+'</span><span>'+x.shared+'</span><span>'+x.prepared+'</span><span>'+x.operated+'</span><span class="mobileHide"><button class="dangerMini" onclick="removeResidentById(\''+r.id+'\')">حذف</button></span></div>';
  }).join(""):'<div class="empty">لا يوجد مقيمون.</div>';
}
function addResidentPrompt(){
  const name=(prompt("اسم المقيم")||"").trim();if(!name)return;
  if(state.residents.some(function(r){return r.name.toLowerCase()===name.toLowerCase()})){alert("المقيم موجود مسبقًا.");return}
  state.residents.push({id:uid("R"),name:name,active:true,createdAt:nowIso()});
  logEvent("resident",null,name,"إضافة مقيم");renderAll();
}
function removeResidentById(id){
  const r=state.residents.find(function(x){return x.id===id});if(!r)return;
  const openDays=state.orDays.filter(function(d){return d.status!=="completed"&&d.residents.indexOf(r.name)>=0});
  const prepared=activePatientCases().filter(function(c){return c.preparedBy===r.name});
  let msg="حذف "+r.name+" من المقيمين الحاليين؟";
  if(openDays.length)msg+="\nسيُزال من "+openDays.length+" يوم عمليات مفتوح.";
  if(prepared.length)msg+="\nستبقى "+prepared.length+" حالة في قوائمها لكن يصبح «حضّرها» غير محدد.";
  msg+="\nالسجل التاريخي للأيام المكتملة والعمليات لن يُحذف.";
  if(!confirm(msg))return;
  openDays.forEach(function(d){d.residents=d.residents.filter(function(n){return n!==r.name})});
  prepared.forEach(function(c){c.preparedBy=""});
  state.removedResidents.push(Object.assign({},clone(r),{removedAt:nowIso()}));
  state.residents=state.residents.filter(function(x){return x.id!==id});
  logEvent("resident_removed",null,r.name,"حذف المقيم من النظام الجديد مع حفظ التاريخ");
  renderAll();
}

function renderMonthlyReport(){
  if(!$("monthlyMonth"))return;
  const ym=$("monthlyMonth").value||defaultMonth();$("monthlyMonth").value=ym;
  const a=state.cases.filter(function(c){return c.completedAt&&String(c.completedAt).slice(0,7)===ym}).slice();
  (state.legacyMonthlyRecovered||[]).filter(function(x){return x.month===ym}).forEach(function(x){
    for(let i=0;i<Number(x.count||1);i++)a.push({id:"legacy-"+i,pathway:x.pathway,actualProcedure:x.procedure,procedure:x.procedure,operationPoints:Number(x.points||0),completedAt:ym+"-01T00:00:00",orHours:0,legacyStatOnly:true});
  });
  const groups=[["Elective","elective"],["Inpatient","inpatient"],["Emergency","emergency"],["Day Surgery","day"],["Minor","minor"]];
  let totalPts=0;
  $("monthlyStats").innerHTML=groups.map(function(g){
    const arr=a.filter(function(c){return c.pathway===g[1]}),pts=arr.reduce(function(z,c){return z+Number(c.operationPoints==null?operationPointsFor(c,c.emergencyOptimization):c.operationPoints)},0);
    totalPts+=pts;return '<div class="monthStat"><b>'+arr.length+'</b><span>'+g[0]+' Cases</span><em>'+pts+' Points</em></div>';
  }).join("")+'<div class="monthStat total"><b>'+a.length+'</b><span>Total Cases</span><em>'+totalPts+' Points</em></div>';
  const proc={};
  a.forEach(function(c){const n=String(c.actualProcedure||c.procedure||"Unknown").trim()||"Unknown";if(!proc[n])proc[n]={count:0,points:0};proc[n].count++;proc[n].points+=Number(c.operationPoints==null?operationPointsFor(c,c.emergencyOptimization):c.operationPoints)});
  const rows=Object.entries(proc).sort(function(x,y){return y[1].count-x[1].count||x[0].localeCompare(y[0])});
  $("monthlyProcedureRows").innerHTML=rows.length?rows.map(function(x){return '<tr><td>'+esc(x[0])+'</td><td>'+x[1].count+'</td><td>'+x[1].points+'</td></tr>'}).join(""):'<tr><td colspan="3" class="empty">لا توجد عمليات مكتملة في هذا الشهر.</td></tr>';
  const hours=a.reduce(function(z,c){return z+Number(c.orHours||0)},0);
  $("monthlyOrHours").textContent="OR Utilization: "+(Math.round(hours*10)/10)+" hours";
  $("monthlyCaseList").innerHTML=a.length?a.slice().sort(function(x,y){return String(y.completedAt).localeCompare(String(x.completedAt))}).map(function(c){
    if(c.legacyStatOnly)return '<div class="mini"><b>'+esc(c.actualProcedure||c.procedure||"—")+'</b>سجل إحصائي قديم مستعاد · '+Number(c.operationPoints||0)+' points</div>';
    return '<div class="mini"><b>'+esc(c.actualProcedure||c.procedure||"—")+'</b>'+esc(c.patientName||"—")+' · '+esc(pathLabel(c.pathway))+' · '+Number(c.operationPoints||0)+' points · '+new Date(c.completedAt).toLocaleDateString("en-GB")+'</div>';
  }).join(""):'<div class="empty">لا توجد عمليات مكتملة في هذا الشهر.</div>';
}

function buildMonthlyScheduleText(ym){
  const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
  let t="📅 جدول أيام العمليات — "+monthTitle(ym)+"\n\n";
  if(!days.length)return t+"لا توجد أيام مسجلة.";
  days.forEach(function(d){
    t+="• "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+"\n";
    t+="  "+(d.residents.length?d.residents.join(" + "):"غير محدد")+"\n";
  });
  t+="\n━━━━━━━━ ملخص الأيام ━━━━━━━━\n";
  activeResidents().forEach(function(r){
    const x=residentDayStats(r.name,ym);
    t+=r.name+": "+x.total+" يوم (منفرد "+x.solo+" | مشترك "+x.shared+")\n";
  });
  return t.trim();
}
function buildDayText(id){
  const d=getDay(id);if(!d)return "";
  const list=dayCases(id,false);
  let t="📋 "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+"\n";
  t+="المقيمون: "+(d.residents.length?d.residents.join(" + "):"غير محدد")+"\n\n";
  if(!list.length)return t+"لا توجد حالات مرتبطة حتى الآن.";
  list.forEach(function(c,i){
    const r=readiness(c);
    t+=(i+1)+". ";
    if(state.settings.includeNames)t+=(c.patientName||"—")+"\n";
    t+="MRN: "+(c.mrn||"—")+"\n";
    t+="التشخيص: "+(c.diagnosis||"—")+"\n";
    t+="العملية: "+(c.procedure||"—")+"\n";
    t+="حضّرها: "+(c.preparedBy||"غير محدد")+"\n";
    t+="الدور: "+(c.dayRole==="reserve"?"احتياط":"أساسي")+"\n";
    if(r.key==="ready")t+="الحالة: جاهز\n";
    else t+="الناقص: "+r.missing.map(function(x){return x.label}).join("، ")+"\n";
    t+="──────────────\n";
  });
  return t.trim();
}
function readinessSection(path,title){
  const list=activePatientCases().filter(function(c){return c.pathway===path});
  let t="━━━━━━━━ "+title+" ━━━━━━━━\n";
  [["ready","جاهز"],["signature","انتظار التوقيع"],["notready","غير جاهز"]].forEach(function(g){
    const a=list.filter(function(c){return readiness(c).key===g[0]});
    t+="【 "+g[1]+" — "+a.length+" 】\n";
    a.forEach(function(c,i){
      const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
      t+=(i+1)+". "+(c.patientName||"—")+" | MRN "+(c.mrn||"—")+"\n";
      t+=(c.procedure||"—")+"\n";
      if(r.missing.length)t+="الناقص: "+r.missing.map(function(x){return x.label}).join("، ")+"\n";
      if(d)t+="اليوم: "+gregDate(d.date)+" | حضّرها: "+(c.preparedBy||"غير محدد")+"\n";
    });
    t+="\n";
  });
  return t;
}
function buildReadinessReport(){
  const ym=$("scheduleMonth").value||defaultMonth();
  const list=activePatientCases().slice().sort(function(a,b){
    const pa={day:1,elective:2,inpatient:3,minor:4}[a.pathway]||9;
    const pb={day:1,elective:2,inpatient:3,minor:4}[b.pathway]||9;
    if(pa!==pb)return pa-pb;
    return String(a.patientName||"").localeCompare(String(b.patientName||""));
  });
  let t="📋 جميع الحالات النشطة ونواقص التجهيز\n\n";
  let lastPath="";
  list.forEach(function(c){
    if(c.pathway!==lastPath){
      if(lastPath)t+="\n";
      t+="━━━━━━━━ "+pathLabel(c.pathway)+" ━━━━━━━━\n";
      lastPath=c.pathway;
    }
    const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
    t+="• "+(c.patientName||"—")+"\n";
    t+="MRN: "+(c.mrn||"—")+"\n";
    t+="العملية: "+(c.procedure||"—")+"\n";
    if(d){
      t+="يوم العمليات: "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+"\n";
      t+="حضّرها: "+(c.preparedBy||"غير محدد")+" | "+(c.dayRole==="reserve"?"احتياط":"أساسي")+"\n";
    }else{
      t+="الموقع: Patient Pool\n";
    }
    t+="النواقص: "+(r.key==="ready"?"لا يوجد — مكتمل التجهيز":r.missing.map(function(x){return x.label}).join("، "))+"\n";
    if(c.consultantPrepared)t+="ملاحظة: تجهيز الاستشاري — المقيم مساعد فقط\n";
    t+="──────────────\n";
  });
  if(!list.length)t+="لا توجد حالات نشطة.\n";
  t+="\n━━━━━━━━ توزيع أيام العمليات — "+monthTitle(ym)+" ━━━━━━━━\n";
  t+=buildMonthlyScheduleText(ym);
  return t.trim();
}
function shareReadinessReport(){
  shareText(buildReadinessReport(),"جميع الحالات وتوزيع أيام العمليات");
}
function renderReports(){
  const ym=$("scheduleMonth").value||defaultMonth();
  $("monthlyScheduleReport").value=buildMonthlyScheduleText(ym);
  const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
  const old=$("reportDaySelect").value;
  $("reportDaySelect").innerHTML=days.length?days.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(gregDate(d.date))+' — '+esc(dayKindLabel(d.kind,d))+'</option>'}).join(""):'<option value="">لا يوجد يوم</option>';
  if(days.some(function(d){return d.id===old}))$("reportDaySelect").value=old;
  $("dayGroupReport").value=$("reportDaySelect").value?buildDayText($("reportDaySelect").value):"";
  $("readinessReport").value=buildReadinessReport();
  $("historyList").innerHTML=state.events.length?state.events.slice().reverse().slice(0,150).map(function(e){
    const c=e.caseId?getCase(e.caseId):null;
    return '<div class="timeline"><b>'+esc(e.detail||e.type)+'</b><div>'+esc(e.resident||"")+(c?" · "+esc(c.mrn||c.patientName||""):"")+'</div><small>'+new Date(e.at).toLocaleString("ar-SA")+'</small></div>';
  }).join(""):'<div class="empty">لا يوجد سجل.</div>';
}
function updateDayReport(){ $("dayGroupReport").value=$("reportDaySelect").value?buildDayText($("reportDaySelect").value):"" }
async function shareText(text,title){
  if(!text)return;
  if(navigator.share){try{await navigator.share({title:title||"General Surgery",text:text});return}catch(e){}}
  try{await navigator.clipboard.writeText(text);toastMsg("تم نسخ الرسالة")}catch(e){prompt("انسخ الرسالة:",text)}
}
function shareMonthlySchedule(){shareText(buildMonthlyScheduleText($("scheduleMonth").value),"جدول أيام العمليات")}
function shareDay(id){shareText(buildDayText(id),"قائمة العمليات")}
function shareSelectedDay(){if($("reportDaySelect").value)shareDay($("reportDaySelect").value)}
function shareAdditionalAnnouncement(id){
  const d=getDay(id);if(!d)return;
  const t="📢 يوم عمليات إضافي\n"+gregDate(d.date)+"\n"+dayKindLabel(d.kind,d)+"\n\nمن يرغب بأخذ هذا اليوم وتجهيز قائمته؟";
  shareText(t,"يوم عمليات إضافي");
}
async function copyTextArea(id){
  const t=$(id).value||"";
  try{await navigator.clipboard.writeText(t);toastMsg("تم النسخ")}catch(e){prompt("انسخ النص:",t)}
}

function openSettings(){
  $("groupTitle").value=state.settings.groupTitle||"General Surgery Residents";
  $("includeNames").checked=state.settings.includeNames!==false;
  $("backupStatus").textContent=backupStatusText();
  openModal("settingsModal");
}
function saveSettings(){
  state.settings.groupTitle=$("groupTitle").value.trim()||"General Surgery Residents";
  state.settings.includeNames=$("includeNames").checked;
  closeModal("settingsModal");renderAll();
}
function exportBackup(){
  const now=nowIso();state.settings.lastBackupAt=now;persist();
  const data={format:"SURGERY_OR_DAYS_V2",schemaVersion:2,exportedAt:now,state:clone(state)};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Surgery_OR_Days_Backup_"+now.slice(0,10)+".json";a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1500);
  $("backupStatus").textContent=backupStatusText();toastMsg("تم إنشاء نسخة احتياطية كاملة");
}
function restoreBackup(ev){
  const f=ev.target.files&&ev.target.files[0];ev.target.value="";if(!f)return;
  const r=new FileReader();
  r.onload=function(){
    try{
      const d=JSON.parse(r.result),fmt=d.format||"";
      let restored=null;
      if(fmt==="SURGERY_OR_DAYS_V2"&&d.state)restored=normalizeV2(d.state);
      else if(fmt==="UNIFIED_SURGERY_RESIDENTS_V1"&&d.state)restored=migrateV1(d.state);
      else throw new Error("bad");
      if(!confirm("استعادة النسخة؟ سيتم استبدال البيانات الحالية. إذا كانت النسخة من النظام القديم فستتحول الحالات النشطة تلقائيًا إلى Patient Pool."))return;
      state=restored;persist();closeModal("settingsModal");initMonthInputs();renderAll();toastMsg("تمت الاستعادة بنجاح");
    }catch(e){alert("ملف النسخة الاحتياطية غير صالح أو غير مدعوم.")}
  };
  r.readAsText(f);
}

function initMonthInputs(){
  const d=defaultMonth();
  ["scheduleMonth","operationsMonth","residentMonth","monthlyMonth"].forEach(function(id){if(!$(id).value)$(id).value=d});
}
function initApp(){
  initMonthInputs();
  ["dayModal","assignDayModal","additionalDayModal","linkCaseModal","caseModal","operationModal","emergencyModal","settingsModal"].forEach(function(id){
    $(id).addEventListener("click",function(e){if(e.target.id===id)closeModal(id)});
  });
  $("patientSearch").addEventListener("input",renderPatients);
  renderAll();
  if("serviceWorker" in navigator)window.addEventListener("load",function(){navigator.serviceWorker.register("./sw.js").catch(function(){})});
}
initApp();
