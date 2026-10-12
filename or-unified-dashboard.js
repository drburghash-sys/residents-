/* Unified OR dashboard — additive layer; original clinical data model remains unchanged. */
(function(){
"use strict";
const css=document.createElement("style");
css.textContent=`
#tabOperations,#tabResidents{display:none!important}
#unifiedQuick{margin:12px 0}
#unifiedQuick .actions{flex-wrap:wrap}
.dayCard .unifiedCase{padding:10px 12px;border:1px solid var(--line,#d3dfe5);border-radius:12px;margin-top:8px}
.dayCard .unifiedCase .sub{margin:5px 0}
.dayCard .unifiedCase .actions{margin:6px 0}
#unifiedReportCard textarea{min-height:280px;direction:rtl;white-space:pre-wrap}
#reportsSection>.split,#reportsSection>.card:not(#unifiedReportCard){display:none!important}
#caseActionsModal .sheet{max-width:680px}
@media print{header,.tabs,.topbar,.actions,.btn,#unifiedQuick,#reportsSection>.split,#reportsSection>.card:not(#unifiedReportCard),#scheduleSection,#patientsSection,#operationsSection,#residentsSection,#monthlySection,.modal{display:none!important}#reportsSection{display:block!important}#unifiedReportCard{border:0;box-shadow:none}#unifiedReportCard .reportControls{display:none!important}#unifiedPrint{display:block!important;font-size:12pt;white-space:pre-wrap;line-height:1.7}#unifiedReportCard textarea{display:none!important}}
`;
document.head.appendChild(css);
const tabs=document.querySelector(".tabs");
if(tabs){document.getElementById("tabSchedule").textContent="لوحة أيام العمليات";document.getElementById("tabReports").textContent="التقارير";document.getElementById("tabMonthly").textContent="تقرير الإنجاز";}
const quick=document.createElement("div");quick.id="unifiedQuick";quick.className="card";
quick.innerHTML='<div class="name">إدارة العمليات من شاشة واحدة</div><div class="sub">اختر اليوم أدناه وأضف حالات أو مقيمين، ثم اضغط اسم المريض لإدارة حالته ونواقصه.</div><div class="actions"><button class="btn dark" onclick="openCase(\'\')">+ مريض للمخزون</button><button class="btn secondary" onclick="addResidentPrompt()">+ مقيم</button><button class="btn danger" onclick="openEmergencyOperation()">+ عملية طارئة</button><button class="btn secondary" onclick="showTab(\'patients\')">مخزون المرضى</button><button class="btn secondary" onclick="showTab(\'reports\')">تقرير العمليات</button></div>';
const schedule=document.getElementById("scheduleSection");
if(schedule)schedule.insertBefore(quick,schedule.firstChild);
const actionModal=document.createElement("div");actionModal.className="modal";actionModal.id="caseActionsModal";
actionModal.innerHTML='<div class="sheet"><div class="row"><h2 id="unifiedPatientTitle">إدارة حالة</h2><button class="btn secondary" onclick="closeModal(\'caseActionsModal\')">إغلاق</button></div><div id="unifiedPatientInfo" class="note info"></div><div class="actions"><button class="btn secondary" onclick="unifiedEditPatient()">تعديل البيانات والنواقص</button><button class="btn secondary" onclick="unifiedMovePatient()">تغيير يوم العملية</button><button class="btn warn" onclick="unifiedToPool()">إرجاع للمخزون</button><button class="btn ok" onclick="unifiedComplete()">تمت العملية</button><button class="btn danger" onclick="unifiedArchive()">أرشفة بسبب</button></div></div>';
document.body.appendChild(actionModal);
let pickedCase="",addingToDay="";
window.unifiedPatient=function(id){const c=getCase(id);if(!c)return;pickedCase=id;document.getElementById("unifiedPatientTitle").textContent=c.patientName||"حالة";const r=readiness(c);document.getElementById("unifiedPatientInfo").textContent="MRN: "+(c.mrn||"—")+" | "+(c.procedure||"—")+" | النواقص: "+(r.missing.map(x=>x.label).join("، ")||"لا يوجد");openModal("caseActionsModal")};
window.unifiedEditPatient=function(){closeModal("caseActionsModal");openCase(pickedCase)};
window.unifiedMovePatient=function(){const c=getCase(pickedCase);if(!c||c.completedAt)return;const opts=state.orDays.slice().sort((a,b)=>a.date.localeCompare(b.date)).filter(d=>d.status!=="completed");if(!opts.length){alert("أضف يوم عمليات أولاً");return}const v=prompt("اختر رقم اليوم:\n"+opts.map((d,i)=>(i+1)+" - "+d.date+" | "+dayKindLabel(d.kind,d)).join("\n"));if(v===null)return;const i=Number(v)-1;if(!Number.isInteger(i)||!opts[i]){alert("رقم غير صحيح");return}c.orDayId=opts[i].id;c.dayRole=c.dayRole||"main";c.updatedAt=nowIso();logEvent("case_move",c,c.preparedBy||"","نقل إلى "+opts[i].date);closeModal("caseActionsModal");renderAll()};
window.unifiedToPool=function(){const c=getCase(pickedCase);if(!c||c.completedAt)return;if(!confirm("إرجاع المريض إلى المخزون مع الاحتفاظ بالتجهيز؟"))return;c.orDayId="";c.preparedBy="";c.dayRole="main";c.updatedAt=nowIso();logEvent("case_pool",c,"","إرجاع للمخزون");closeModal("caseActionsModal");renderAll()};
window.unifiedComplete=function(){const c=getCase(pickedCase);if(!c||c.completedAt)return;closeModal("caseActionsModal");openOperation(pickedCase)};
window.unifiedArchive=function(){const c=getCase(pickedCase);if(!c||c.completedAt){alert("لا يمكن أرشفة عملية مكتملة بهذه الطريقة.");return}const reason=prompt("اكتب سبب الأرشفة (إلزامي):");if(reason===null)return;if(!reason.trim()){alert("سبب الأرشفة مطلوب");return}if(!confirm("تأكيد أرشفة الحالة؟"))return;c.archiveReason=reason.trim();c.archived=true;c.ownerState="archived";c.orDayId="";c.preparedBy="";c.dayRole="main";c.updatedAt=nowIso();logEvent("case_archive",c,"",reason.trim());closeModal("caseActionsModal");renderAll()};
window.unifiedNewCaseForDay=function(id){addingToDay=id;openCase("")};
const originalSave=window.saveCase;
window.saveCase=function(){const targetDay=addingToDay;const prior=new Set(state.cases.map(c=>c.id));originalSave();if(targetDay){const d=getDay(targetDay);const c=state.cases.find(c=>!prior.has(c.id));if(c&&d&&!c.completedAt){c.orDayId=d.id;c.preparedBy=d.residents.length===1?d.residents[0]:"";c.followUpBy=c.preparedBy;c.dayRole="main";c.updatedAt=nowIso();logEvent("case_add_day",c,c.preparedBy,"إضافة مباشرة إلى يوم "+d.date);renderAll()}addingToDay=""}};
const originalClose=window.closeModal;
window.closeModal=function(id){if(id==="caseModal")addingToDay="";return originalClose(id)};
const originalDayCard=window.dayCardHtml;
window.dayCardHtml=function(d){let html=originalDayCard(d);const active=dayCases(d.id,true);const rows=active.map(c=>{const r=readiness(c);return '<div class="unifiedCase"><button class="btn secondary" onclick="unifiedPatient(\''+esc(c.id)+'\')">'+esc(c.patientName||"—")+' · '+esc(c.mrn||"—")+'</button><div class="sub">'+esc(c.procedure||"")+' · '+(c.completedAt?"تمت العملية":r.key==="ready"?"جاهز":"ناقص: "+esc(r.missing.map(x=>x.label).join("، ")))+'</div><div class="sub">المقيم: '+esc(c.preparedBy||"لم يحدد")+'</div></div>'}).join("");return html.replace(/<\/div>\s*$/, '<div class="actions"><button class="btn dark" onclick="unifiedNewCaseForDay(\''+esc(d.id)+'\')">+ عملية جديدة لهذا اليوم</button><button class="btn secondary" onclick="currentDayId=\''+esc(d.id)+'\';openLinkCase()">+ من المخزون</button><button class="btn secondary" onclick="openDayAssignments(\''+esc(d.id)+'\')">+ مقيم أو مقيمان</button></div>'+rows+'</div>')};
const reports=document.getElementById("reportsSection");
if(reports){const cr=document.createElement("div");cr.className="card";cr.id="unifiedReportCard";cr.innerHTML='<div class="name">قائمة العمليات الموحدة</div><div class="sub">رسالة واحدة تحتوي أيام العمليات والمقيمين والمرضى والعمليات ونواقص التجهيز. نسخة قابلة للنسخ أو الطباعة PDF.</div><div class="reportControls"><div class="field monthPick"><label>الشهر</label><input type="month" id="unifiedReportMonth" onchange="unifiedRenderReport()"></div><div class="actions"><button class="btn dark" onclick="unifiedCopyReport()">نسخ كامل للواتساب</button><button class="btn secondary" onclick="unifiedPdfReport()">تصدير PDF</button></div><textarea id="unifiedReportText" class="reportbox" readonly></textarea></div><div id="unifiedPrint" style="display:none;white-space:pre-wrap"></div>';reports.insertBefore(cr,reports.firstChild)}
window.unifiedReportText=function(){const ym=document.getElementById("unifiedReportMonth").value||defaultMonth();const days=state.orDays.filter(d=>ymFromDate(d.date)===ym).sort((a,b)=>a.date.localeCompare(b.date));let lines=["جدول العمليات — "+ym,""];days.forEach(d=>{lines.push("━━━━━━━━━━━━━━━━━━━━","التاريخ: "+gregDate(d.date)+" | "+dayKindLabel(d.kind,d),"المقيمون: "+(d.residents.join("، ")||"غير محدد"));const cases=dayCases(d.id,true);if(!cases.length)lines.push("لا توجد حالات");cases.forEach((c,i)=>{const r=readiness(c);lines.push((i+1)+") "+(state.settings.includeNames?(c.patientName||"—"):"حالة")+" | MRN: "+(c.mrn||"—"),"التشخيص: "+(c.diagnosis||"—"),"العملية: "+(c.actualProcedure||c.procedure||"—"),"المقيم: "+(c.preparedBy||"غير محدد"),"الحالة: "+(c.completedAt?"تمت العملية":r.missing.length?"النواقص: "+r.missing.map(x=>x.label).join("، "):"جاهز"))});lines.push("")});return lines.join("\n")};
window.unifiedRenderReport=function(){const el=document.getElementById("unifiedReportText");if(el)el.value=unifiedReportText()};
window.unifiedCopyReport=async function(){const t=unifiedReportText();try{await navigator.clipboard.writeText(t);toastMsg("تم نسخ القائمة كاملة")}catch(e){prompt("انسخ القائمة",t)}};
window.unifiedPdfReport=function(){const p=document.getElementById("unifiedPrint");p.textContent=unifiedReportText();p.style.display="block";window.print();p.style.display="none"};
const originalRenderAll=window.renderAll;window.renderAll=function(){originalRenderAll();unifiedRenderReport()};
const originalShowTab=window.showTab;window.showTab=function(t){if(t==="operations"||t==="residents")t="schedule";originalShowTab(t);if(t==="reports")unifiedRenderReport()};
const m=document.getElementById("unifiedReportMonth");if(m)m.value=defaultMonth();
renderAll();
})();
