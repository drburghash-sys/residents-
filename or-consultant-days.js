// Consultant may take responsibility for an OR list when no resident is assigned.
// This is day-level responsibility; it does not alter case follow-up or resident workload.
(function(){
  "use strict";
  const CONSULTANT="الاستشاري";
  function isConsultantDay(d){return !!(d&&d.consultantResponsible)}
  function dayOwner(d){return isConsultantDay(d)?CONSULTANT:(d.residents.length?d.residents.join(" + "):"غير محدد")}
  function matchesType(c,d){
    if(d.kind==="dsu")return c.pathway==="day";
    if(d.kind==="elective")return c.pathway==="elective";
    return c.pathway!=="emergency";
  }

  const oldOpenAssignments=window.openDayAssignments;
  window.openDayAssignments=function(id){
    const d=getDay(id);if(!d)return;
    oldOpenAssignments(id);
    document.getElementById("assignDayTitle").textContent="مسؤول يوم "+gregDate(d.date);
    const list=document.getElementById("dayResidentChecks");
    const empty=list.querySelector(".empty");
    if(empty)empty.textContent="لا يوجد مقيمون نشطون. يمكن تكليف الاستشاري مباشرة.";
    const label=document.createElement("label");
    label.className="pickerItem";
    const cb=document.createElement("input");
    cb.type="checkbox";cb.id="dayConsultantResponsible";cb.style.width="auto";
    cb.checked=isConsultantDay(d);
    label.append(cb,document.createTextNode(" "+CONSULTANT+" — مسؤول القائمة بدل المقيم"));
    list.prepend(label);
    const residents=Array.from(list.querySelectorAll('input[type="checkbox"]')).filter(x=>x!==cb);
    cb.addEventListener("change",function(){
      if(cb.checked)residents.forEach(x=>{x.checked=false});
    });
    residents.forEach(x=>x.addEventListener("change",function(){if(x.checked)cb.checked=false}));
    const help=document.querySelector("#assignDayModal .note.info");
    if(help)help.textContent="اختر الاستشاري أو مقيمًا واحدًا أو أكثر. اختيار الاستشاري لا يُحسب ضمن أيام المقيمين.";
  };

  window.saveDayAssignments=function(){
    const d=getDay(currentDayId);if(!d)return;
    const list=document.getElementById("dayResidentChecks");
    const cb=document.getElementById("dayConsultantResponsible");
    const consultant=!!(cb&&cb.checked);
    const inputs=Array.from(list.querySelectorAll('input[type="checkbox"]')).filter(x=>x!==cb);
    const selected=consultant?[]:inputs.filter(x=>x.checked).map(x=>x.value);
    // Consultant takeover keeps all patients on the same list and retains their follow-up owners.
    // When reverting to resident ownership, return cases followed by an unselected resident to the pool.
    const affected=consultant?[]:dayCases(d.id,false).filter(c=>
      !c.consultantPrepared&&!selected.includes(c.followUpBy));
    if(affected.length&&!confirm("سيتم إرجاع "+affected.length+" حالة إلى Patient Pool لأن مقيم المتابعة ليس ضمن مسؤولي اليوم المختارين. ستبقى متابعة هذه الحالات محفوظة. متابعة؟"))return;
    affected.forEach(c=>{
      c.orDayId="";
      c.dayRole="main";
      c.preparedBy=c.followUpBy||"";
      c.updatedAt=nowIso();
    });
    d.consultantResponsible=consultant;
    d.residents=selected;
    logEvent("day_owner",null,dayOwner(d),
      "تحديث مسؤول قائمة العمليات بتاريخ "+d.date+": "+dayOwner(d)+
      (affected.length?" — إعادة "+affected.length+" حالة إلى المخزون":""));
    closeModal("assignDayModal");
    renderAll();
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
  };

  const oldCard=window.dayCardHtml;
  window.dayCardHtml=function(d){
    let html=oldCard(d);
    if(isConsultantDay(d)){
      html=html.replace('<span class="residentChip none">غير محدد</span>','<span class="residentChip">'+CONSULTANT+'</span>');
    }
    return html.replace(/>المقيمون<\/button>/g,">اختيار المسؤول</button>")
      .replace(/>\+ مقيم أو مقيمان<\/button>/g,">+ اختيار المسؤول</button>");
  };
  const oldRenderSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    oldRenderSchedule();
    const month=document.getElementById("scheduleMonth").value||defaultMonth();
    const days=state.orDays.filter(d=>ymFromDate(d.date)===month);
    document.getElementById("sAssigned").textContent=days.filter(d=>isConsultantDay(d)||d.residents.length>0).length;
    document.getElementById("sUnassigned").textContent=days.filter(d=>!isConsultantDay(d)&&!d.residents.length).length;
  };
  const oldRenderDayModal=window.renderDayModal;
  window.renderDayModal=function(){
    oldRenderDayModal();
    const d=getDay(currentDayId);
    if(!d)return;
    if(isConsultantDay(d)){
      document.getElementById("dayModalInfo").innerHTML="<b>مسؤول يوم العمليات:</b> "+CONSULTANT+
        (d.notes?"<br><b>ملاحظات:</b> "+esc(d.notes):"");
    }
    document.getElementById("dayAssignBtn").textContent="اختيار مسؤول اليوم";
  };

  const oldOpenLinkCase=window.openLinkCase;
  window.openLinkCase=function(){
    const d=getDay(currentDayId);if(!d)return;
    if(!isConsultantDay(d))return oldOpenLinkCase();
    linkingCaseId="";
    const list=poolCases().filter(c=>matchesType(c,d)&&!!c.followUpBy);
    const info=document.getElementById("linkCaseDayInfo");
    info.innerHTML="<b>"+esc(gregDate(d.date))+" — "+esc(dayKindLabel(d.kind,d))+"</b><br>مسؤول يوم العمليات: <b>"+CONSULTANT+
      "</b><br>الحالات المسندة للمتابعة: <b>"+list.length+
      "</b> · جاهزة: <b>"+list.filter(c=>readiness(c).key==="ready").length+
      "</b> · غير جاهزة: <b>"+list.filter(c=>readiness(c).key!=="ready").length+
      "</b>"+(!list.length?'<div class="note">لا توجد حالات مناسبة. يجب أولًا تعيين المتابعة من Patient Pool.</div>':"");
    const select=document.getElementById("linkCaseSelect");
    select.disabled=!list.length;
    select.onchange=syncLinkCaseOwner;
    select.innerHTML=list.length?list.map(c=>{
      const r=readiness(c);
      return '<option value="'+esc(c.id)+'">'+esc(c.mrn||"—")+" — "+esc(c.patientName||"—")+" — "+esc(c.procedure||"")+
        " — "+esc(r.label)+" — متابعة "+esc(c.followUpBy)+"</option>";
    }).join(""):'<option value="">لا توجد حالات مناسبة</option>';
    document.getElementById("linkRole").value="main";
    const prepared=document.getElementById("linkPreparedBy");
    if(list.length)syncLinkCaseOwner();
    else{prepared.innerHTML='<option value="">—</option>';prepared.disabled=true}
    const save=document.querySelector("#linkCaseModal .footer-actions .btn");
    if(save)save.disabled=!list.length;
    openModal("linkCaseModal");
  };
  const oldSaveLinkCase=window.saveLinkCase;
  window.saveLinkCase=function(){
    const d=getDay(currentDayId);if(!d)return;
    if(!isConsultantDay(d))return oldSaveLinkCase();
    const id=linkingCaseId||document.getElementById("linkCaseSelect").value;
    const c=getCase(id);
    if(!c){alert("اختر حالة.");return}
    if(d.status==="completed"){alert("لا يمكن إضافة حالات إلى يوم مغلق.");return}
    if(!c.followUpBy&&!linkingCaseId){alert("عين مسؤول متابعة الحالة أولًا من صفحة المرضى.");return}
    if(!matchesType(c,d)){alert("نوع الحالة لا يناسب نوع يوم العمليات.");return}
    if(!linkingCaseId&&c.orDayId){alert("الحالة مرتبطة بيوم آخر.");return}
    c.orDayId=d.id;
    c.preparedBy=c.followUpBy;
    c.dayRole=document.getElementById("linkRole").value;
    c.updatedAt=nowIso();
    logEvent(linkingCaseId?"day_case_edit":"day_case_link",c,c.followUpBy,"ربط الحالة بقائمة الاستشاري ليوم "+d.date);
    closeModal("linkCaseModal");
    renderAll();
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
  };

  const oldMonthly=window.buildMonthlyScheduleText;
  window.buildMonthlyScheduleText=function(ym){
    let t=oldMonthly(ym);
    state.orDays.filter(d=>isConsultantDay(d)&&ymFromDate(d.date)===ym).forEach(d=>{
      const row="• "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+"\n  غير محدد";
      t=t.replace(row,"• "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+"\n  "+CONSULTANT);
    });
    return t;
  };
  const oldDayText=window.buildDayText;
  window.buildDayText=function(id){
    const t=oldDayText(id),d=getDay(id);
    return isConsultantDay(d)?t.replace("المقيمون: غير محدد","مسؤول القائمة: "+CONSULTANT):t;
  };
  const oldUnifiedText=window.unifiedReportText;
  if(oldUnifiedText)window.unifiedReportText=function(){
    let t=oldUnifiedText();
    state.orDays.filter(isConsultantDay).forEach(d=>{
      const from="التاريخ: "+gregDate(d.date)+" | "+dayKindLabel(d.kind,d)+"\nالمقيمون: غير محدد";
      const to="التاريخ: "+gregDate(d.date)+" | "+dayKindLabel(d.kind,d)+"\nمسؤول القائمة: "+CONSULTANT;
      t=t.replace(from,to);
    });
    return t;
  };
  const label=document.querySelector("#sAssigned");
  if(label&&label.nextElementSibling)label.nextElementSibling.textContent="تم تحديد المسؤول";
  const button=document.getElementById("dayAssignBtn");
  if(button)button.textContent="اختيار مسؤول اليوم";
  const help=document.querySelector("#assignDayModal .note.info");
  if(help)help.textContent="اختر مسؤول القائمة من الاستشاري أو المقيمين.";
  const oldOpenMove=window.openMoveDay;
  if(oldOpenMove)window.openMoveDay=function(id){
    oldOpenMove(id);
    const d=getDay(id),el=document.getElementById("moveDayInfo");
    if(isConsultantDay(d)&&el)el.innerHTML=el.innerHTML.replace("المقيمون: غير محدد","مسؤول يوم العمليات: "+CONSULTANT);
  };
  renderAll();
})();
