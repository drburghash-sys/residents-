// Consultant-prepared case protection + manual resident compensation.
(function(){
  const CONSULTANT_LABEL="الاستشاري";
  const oldBuildMonthlyScheduleText=window.buildMonthlyScheduleText;

  state.compensationLog=Array.isArray(state.compensationLog)?state.compensationLog:[];
  state.residents.forEach(function(r){r.compensation=Number(r.compensation||0)});
  state.cases.forEach(function(c){
    c.consultantPrepared=!!c.consultantPrepared||c.followUpBy===CONSULTANT_LABEL;
    if(c.consultantPrepared){c.followUpBy=CONSULTANT_LABEL;c.preparedBy=CONSULTANT_LABEL}
  });
  persist();

  window.pathLabel=function(p){
    return {day:"DSU / Day Surgery",elective:"Elective",inpatient:"Inpatient",minor:"Minor",emergency:"طارئة"}[p]||p||"—";
  };

  function installAssistantField(){
    if(document.getElementById("opAssistant"))return;
    const op=document.getElementById("opOperator");
    if(!op)return;
    const field=document.createElement("div");
    field.className="field";
    field.innerHTML='<label>المساعد في العملية</label><select id="opAssistant"><option value="">لا يوجد / غير محدد</option></select>';
    op.closest(".field").insertAdjacentElement("afterend",field);
  }

  function installCompModal(){
    if(document.getElementById("compensationModal"))return;
    const x=document.createElement("div");
    x.className="modal";x.id="compensationModal";
    x.innerHTML='<div class="sheet">'+
      '<div class="row"><h2 style="margin:0">إضافة تعويض للمقيم</h2><button class="btn secondary" onclick="closeModal(\'compensationModal\')">إغلاق</button></div>'+
      '<input id="compResidentName" type="hidden">'+
      '<div id="compResidentInfo" class="note info"></div>'+
      '<div class="grid">'+
        '<div class="field"><label>سبب التعويض</label><select id="compReason">'+
          '<option value="مناوبة">مناوبة</option><option value="Post-call">Post-call</option><option value="عيادة">عيادة</option><option value="إجازة رسمية">إجازة رسمية</option><option value="تكليف رسمي">تكليف رسمي</option><option value="تعارض رسمي آخر">تعارض رسمي آخر</option>'+
        '</select></div>'+
        '<div class="field"><label>يوم العمليات الذي تعذر حضوره</label><select id="compDay"><option value="">غير محدد</option></select></div>'+
      '</div>'+
      '<div class="field" style="margin-top:10px"><label>ملاحظة</label><input id="compNote" placeholder="اختياري"></div>'+
      '<div class="footer-actions"><button class="btn dark" onclick="saveCompensation()">إضافة +1 تعويض</button></div>'+
      '</div>';
    document.body.appendChild(x);
    x.addEventListener("click",function(e){if(e.target.id==="compensationModal")closeModal("compensationModal")});
  }

  window.openCompensation=function(name){
    const r=state.residents.find(function(x){return x.name===name});if(!r)return;
    document.getElementById("compResidentName").value=name;
    document.getElementById("compResidentInfo").textContent=name+" — رصيد التعويض الحالي: +"+Number(r.compensation||0);
    document.getElementById("compNote").value="";
    const days=state.orDays.filter(function(d){return d.residents.indexOf(name)>=0}).sort(function(a,b){return b.date.localeCompare(a.date)});
    document.getElementById("compDay").innerHTML='<option value="">غير محدد</option>'+days.map(function(d){
      return '<option value="'+esc(d.id)+'">'+esc(gregDate(d.date))+' — '+esc(dayKindLabel(d.kind,d))+'</option>';
    }).join("");
    openModal("compensationModal");
  };

  window.saveCompensation=function(){
    const name=document.getElementById("compResidentName").value;
    const r=state.residents.find(function(x){return x.name===name});if(!r)return;
    const reason=document.getElementById("compReason").value;
    const dayId=document.getElementById("compDay").value;
    const d=dayId?getDay(dayId):null;
    const note=document.getElementById("compNote").value.trim();
    r.compensation=Number(r.compensation||0)+1;
    state.compensationLog.push({id:uid("COMP"),resident:name,change:1,reason:reason,dayId:dayId,date:d?d.date:"",note:note,at:nowIso()});
    logEvent("compensation_add",null,name,"إضافة +1 تعويض بسبب "+reason+(d?" عن يوم "+d.date:""));
    closeModal("compensationModal");renderAll();toastMsg("أضيف +1 تعويض إلى "+name);
  };

  window.useCompensation=function(name){
    const r=state.residents.find(function(x){return x.name===name});if(!r||Number(r.compensation||0)<=0)return;
    const note=(prompt("اكتب تاريخ/وصف يوم التعويض البديل (اختياري):","")||"").trim();
    if(!confirm("استخدام تعويض واحد لـ "+name+"؟ سيصبح الرصيد +"+(Number(r.compensation)-1)))return;
    r.compensation=Number(r.compensation||0)-1;
    state.compensationLog.push({id:uid("COMP"),resident:name,change:-1,reason:"استخدام تعويض",dayId:"",date:"",note:note,at:nowIso()});
    logEvent("compensation_use",null,name,"استخدام -1 من رصيد التعويض"+(note?" — "+note:""));
    renderAll();toastMsg("تم استخدام تعويض واحد");
  };

  window.renderResidents=function(){
    const ym=document.getElementById("residentMonth").value||document.getElementById("scheduleMonth").value||defaultMonth();
    document.getElementById("residentMonth").value=ym;
    const rs=activeResidents();
    document.getElementById("residentStatsList").innerHTML=rs.length?rs.map(function(r){
      const x=residentDayStats(r.name,ym),comp=Number(r.compensation||0);
      return '<div class="resRow"><div><b class="big">'+esc(r.name)+'</b><div class="sub">'+x.total+' يوم عمليات · تعويض +'+comp+'</div></div>'+
        '<span>'+x.solo+'</span><span>'+x.shared+'</span><span>'+x.prepared+'</span><span>'+x.operated+'</span>'+
        '<span><button class="dangerMini" style="background:#e8f1f4;color:#0b5266" onclick="openCompensation(\''+esc(r.name)+'\')">+ تعويض</button> '+
        (comp>0?'<button class="dangerMini" style="background:#fff0d8;color:#8b5800" onclick="useCompensation(\''+esc(r.name)+'\')">استخدام</button> ':'')+
        '<button class="dangerMini" onclick="removeResidentById(\''+r.id+'\')">حذف</button></span></div>';
    }).join(""):'<div class="empty">لا يوجد مقيمون.</div>';
  };

  const oldOpenClaim=window.openClaimCase;
  window.openClaimCase=function(id){
    oldOpenClaim(id);
    const sel=document.getElementById("claimResident");
    if(!sel)return;
    const c=getCase(id);
    const o=document.createElement("option");
    o.value="__CONSULTANT__";o.textContent="الاستشاري — تجهيز الاستشاري (المقيم مساعد فقط)";
    if(c&&c.consultantPrepared)o.selected=true;
    sel.insertBefore(o,sel.children[1]||null);
  };

  window.saveClaimCase=function(){
    const c=getCase(document.getElementById("claimCaseId").value);if(!c)return;
    const v=document.getElementById("claimResident").value;
    const next=v==="__CONSULTANT__"?CONSULTANT_LABEL:v;
    const consultant=v==="__CONSULTANT__";
    const old=c.followUpBy||"";
    if(old===next&&!!c.consultantPrepared===consultant){closeModal("claimModal");return}
    const d=c.orDayId?getDay(c.orDayId):null;
    if(d&&!consultant&&(!next||d.residents.indexOf(next)<0)){
      if(!confirm("المقيم الجديد غير مشارك في يوم العمليات الحالي. سيتم إرجاع الحالة إلى Patient Pool مع بقاء التجهيز. متابعة؟"))return;
      c.orDayId="";c.dayRole="main";
    }
    c.consultantPrepared=consultant;
    c.followUpBy=next;c.preparedBy=next;c.updatedAt=nowIso();
    logEvent("followup_owner",c,next,consultant?"الحالة جهزها الاستشاري — المقيم مساعد فقط":(next?"تعيين متابعة الحالة إلى "+next:"تحرير الحالة من المتابعة"));
    closeModal("claimModal");renderAll();
    toastMsg(consultant?"تم تعليم الحالة: تجهيز الاستشاري — المقيم مساعد فقط":(next?"تم حجز الحالة للمتابعة بواسطة "+next:"أصبحت الحالة متاحة"));
  };

  window.compatiblePoolForDay=function(day){
    return poolCases().filter(function(c){
      if(c.consultantPrepared){
        if(day.kind==="dsu")return c.pathway==="day";
        if(day.kind==="elective")return c.pathway==="elective";
        return c.pathway!=="emergency";
      }
      if(!c.followUpBy||day.residents.indexOf(c.followUpBy)<0)return false;
      if(day.kind==="dsu")return c.pathway==="day";
      if(day.kind==="elective")return c.pathway==="elective";
      return c.pathway!=="emergency";
    });
  };

  window.patientCardHtml=function(c){
    const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
    let followText="متاحة",followClass="pool";
    if(c.consultantPrepared){followText="تجهيز الاستشاري — المقيم مساعد فقط";followClass="violet"}
    else if(c.followUpBy){followText=(r.key==="ready"?"جاهزة — ":"تحت المتابعة — ")+c.followUpBy;followClass=r.key==="ready"?"ready":"main"}
    if(c.orDayId)followText="ضمن قائمة "+(d?gregDate(d.date):"")+" — "+(c.consultantPrepared?"الاستشاري / مساعد فقط":(c.followUpBy||"غير محدد"));
    if(c.completedAt){followText="تمت";followClass="done"}
    return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(pathLabel(c.pathway))+' · '+esc(c.diagnosis||"")+'</div></div><div style="display:flex;gap:5px;flex-wrap:wrap"><span class="badge '+r.key+'">'+esc(r.label)+'</span><span class="badge '+followClass+'">'+esc(followText)+'</span></div></div>'+
      '<div class="caseMeta"><div><b>العملية</b>'+esc(c.procedure||"—")+'</div><div><b>يوم العمليات</b>'+esc(d?gregDate(d.date):"—")+'</div><div><b>المتابعة بواسطة</b>'+esc(c.followUpBy||"—")+'</div><div><b>الوضع</b>'+esc(c.consultantPrepared?"المقيم مساعد فقط":"تدريب مقيم")+'</div></div>'+
      '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div>'+
      '<div class="actions">'+(!c.completedAt&&c.pathway!=="emergency"?'<button class="btn secondary" onclick="openCase(\''+c.id+'\')">تعديل التجهيز</button><button class="btn '+(c.followUpBy?"warn":"dark")+'" onclick="openClaimCase(\''+c.id+'\')">'+(c.followUpBy?"نقل/تحرير المتابعة":"أخذ للمتابعة")+'</button>':'')+(c.orDayId?'<button class="btn dark" onclick="openDay(\''+c.orDayId+'\')">فتح يوم العمليات</button>':'')+'</div></div>';
  };

  window.saveLinkCase=function(){
    const d=getDay(currentDayId);if(!d)return;
    const id=linkingCaseId||document.getElementById("linkCaseSelect").value;
    const c=getCase(id);if(!c){alert("اختر حالة.");return}
    if(!c.followUpBy){alert("يجب أولًا تحديد من يتابع الحالة.");return}
    if(!c.consultantPrepared&&d.residents.indexOf(c.followUpBy)<0){alert("هذه الحالة يتابعها مقيم غير مشارك في يوم العمليات المحدد.");return}
    if(!linkingCaseId&&c.orDayId){alert("الحالة مرتبطة بيوم آخر.");return}
    c.orDayId=d.id;c.preparedBy=c.followUpBy;c.dayRole=document.getElementById("linkRole").value;c.updatedAt=nowIso();
    logEvent(linkingCaseId?"day_case_edit":"day_case_link",c,c.followUpBy,"ربط الحالة بيوم "+d.date+(c.consultantPrepared?" — تجهيز الاستشاري / مساعد فقط":""));
    closeModal("linkCaseModal");renderAll();
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
  };

  window.dayCaseHtml=function(c){
    const r=readiness(c),done=!!c.completedAt,role=c.dayRole==="reserve"?"reserve":"main";
    let buttons='<button class="btn secondary" onclick="openCase(\''+c.id+'\')">التجهيز</button>';
    if(!done){
      buttons+='<button class="btn secondary" onclick="editDayCase(\''+c.id+'\')">الدور</button><button class="btn secondary" onclick="toggleDayRole(\''+c.id+'\')">'+(c.dayRole==="reserve"?"إلى أساسي":"إلى احتياط")+'</button><button class="btn warn" onclick="unlinkCase(\''+c.id+'\')">إرجاع للمخزون</button>';
      if(r.key==="ready")buttons+='<button class="btn ok" onclick="openOperation(\''+c.id+'\')">✅ تمت العملية</button>';
    }
    return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(c.diagnosis||"")+' · '+esc(c.procedure||"")+'</div></div>'+
      '<div><span class="badge '+(done?"done":r.key)+'">'+(done?"تمت":esc(r.label))+'</span> <span class="badge '+role+'">'+(role==="reserve"?"احتياط":"أساسي")+'</span></div></div>'+
      '<div class="caseMeta"><div><b>المتابعة بواسطة</b>'+esc(c.followUpBy||"غير محدد")+'</div><div><b>الوضع</b>'+esc(c.consultantPrepared?"المقيم مساعد فقط":"حالة مقيم")+'</div><div><b>النواقص</b>'+r.missing.length+'</div><div><b>العملية</b>'+esc(c.actualProcedure||c.procedure||"—")+'</div></div>'+
      '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div><div class="actions">'+buttons+'</div></div>';
  };

  window.openOperation=function(id){
    const c=getCase(id);if(!c)return;
    const d=c.orDayId?getDay(c.orDayId):null;
    document.getElementById("opCaseId").value=c.id;
    document.getElementById("opCaseInfo").innerHTML='<b>'+esc(c.patientName||"—")+'</b> · MRN '+esc(c.mrn||"—")+'<br>'+esc(c.procedure||"")+
      (c.consultantPrepared?'<br><b>تجهيز الاستشاري — المقيم مساعد فقط</b>':'')+
      (d?'<br>'+esc(gregDate(d.date))+' · حضّرها: '+esc(c.preparedBy||"غير محدد"):"");
    document.getElementById("opProcedure").value=c.actualProcedure||c.procedure||"";
    const op=document.getElementById("opOperator");
    op.value=c.consultantPrepared?"Consultant":(c.preparedBy||(d&&d.residents.length===1?d.residents[0]:""));
    op.disabled=!!c.consultantPrepared;
    const as=document.getElementById("opAssistant");
    as.innerHTML='<option value="">لا يوجد / غير محدد</option>'+((d&&d.residents)||[]).map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join("");
    as.value=c.assistedBy||"";
    document.getElementById("opDuration").value=c.orHours?Math.round(c.orHours*60):"";
    openModal("operationModal");
  };

  window.confirmOperation=function(){
    const c=getCase(document.getElementById("opCaseId").value);if(!c)return;
    const proc=document.getElementById("opProcedure").value.trim();if(!proc){alert("أدخل العملية الفعلية.");return}
    c.actualProcedure=proc;
    c.performedBy=c.consultantPrepared?"Consultant":(document.getElementById("opOperator").value.trim()||"Consultant");
    c.assistedBy=document.getElementById("opAssistant").value||"";
    c.operationPoints=2;c.orHours=Math.max(0,(Number(document.getElementById("opDuration").value)||0)/60);
    c.completedAt=nowIso();c.archived=true;c.ownerState="done";c.updatedAt=nowIso();
    logEvent("operation_done",c,c.performedBy,"تمت العملية"+(c.assistedBy?" — المساعد "+c.assistedBy:"")+" وأضيفت للتقرير الشهري");
    document.getElementById("opOperator").disabled=false;
    closeModal("operationModal");renderAll();toastMsg("تمت إضافة العملية للتقرير الشهري");
  };

  window.buildMonthlyScheduleText=function(ym){
    let t=oldBuildMonthlyScheduleText(ym);
    const balances=activeResidents().filter(function(r){return Number(r.compensation||0)>0});
    if(balances.length){
      t+="\n\n━━━━━━━━ رصيد التعويض ━━━━━━━━\n";
      balances.forEach(function(r){t+=r.name+": +"+Number(r.compensation||0)+" يوم\n"});
    }
    return t.trim();
  };

  installAssistantField();
  installCompModal();
  renderAll();
})();