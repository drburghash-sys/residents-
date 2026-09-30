// Exclusive resident follow-up ownership + PDF reporting layer.
(function(){
  function ensureClaimState(){
    let changed=false;
    (state.cases||[]).forEach(function(c){
      if(c.completedAt)return;
      if(c.followUpBy==null){c.followUpBy=c.preparedBy||"";changed=true}
      if(c.followUpBy&&!c.preparedBy){c.preparedBy=c.followUpBy;changed=true}
    });
    if(changed)persist();
  }

  function installClaimModal(){
    if(document.getElementById("claimModal"))return;
    const wrap=document.createElement("div");
    wrap.innerHTML='<div class="modal" id="claimModal"><div class="sheet">'+
      '<div class="row"><h2 style="margin:0">متابعة الحالة</h2><button class="btn secondary" onclick="closeModal(\'claimModal\')">إغلاق</button></div>'+
      '<input id="claimCaseId" type="hidden">'+
      '<div id="claimCaseInfo" class="note info"></div>'+
      '<div class="field"><label>المقيم المسؤول عن المتابعة والتجهيز</label><select id="claimResident"></select></div>'+
      '<div class="note">لا يمكن أن يكون للحالة أكثر من مقيم واحد مسؤول عن المتابعة في الوقت نفسه. نقل المتابعة يسجل في سجل الحركة.</div>'+
      '<div class="footer-actions"><button class="btn dark" onclick="saveClaimCase()">حفظ المتابعة</button></div>'+
      '</div></div>';
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById("claimModal").addEventListener("click",function(e){if(e.target.id==="claimModal")closeModal("claimModal")});
  }

  function installPdfButton(){
    if(document.getElementById("casesPdfBtn"))return;
    const box=document.getElementById("readinessReport");
    if(!box)return;
    const actions=box.parentElement.querySelector(".actions");
    if(!actions)return;
    const b=document.createElement("button");
    b.id="casesPdfBtn";
    b.className="btn dark";
    b.textContent="PDF الحالات والنواقص";
    b.onclick=shareCasesPdf;
    actions.prepend(b);
  }

  window.openClaimCase=function(id){
    const c=getCase(id);if(!c||c.completedAt)return;
    document.getElementById("claimCaseId").value=c.id;
    document.getElementById("claimCaseInfo").innerHTML='<b>'+esc(c.patientName||"—")+'</b> · MRN '+esc(c.mrn||"—")+
      '<br>المتابعة الحالية: '+esc(c.followUpBy||"متاحة");
    let opts='<option value="">— تحرير الحالة وجعلها متاحة —</option>';
    activeResidents().forEach(function(r){
      opts+='<option value="'+esc(r.name)+'" '+(r.name===c.followUpBy?"selected":"")+'>'+esc(r.name)+'</option>';
    });
    document.getElementById("claimResident").innerHTML=opts;
    openModal("claimModal");
  };

  window.saveClaimCase=function(){
    const c=getCase(document.getElementById("claimCaseId").value);if(!c)return;
    const old=c.followUpBy||"",next=document.getElementById("claimResident").value;
    if(old===next){closeModal("claimModal");return}
    const d=c.orDayId?getDay(c.orDayId):null;
    if(d&&(!next||d.residents.indexOf(next)<0)){
      if(!confirm("المقيم الجديد غير مشارك في يوم العمليات الحالي. سيتم إرجاع الحالة إلى Patient Pool مع بقاء التجهيز. متابعة؟"))return;
      c.orDayId="";c.dayRole="main";
    }
    c.followUpBy=next;
    c.preparedBy=next;
    c.updatedAt=nowIso();
    logEvent("followup_owner",c,next,next?"تعيين متابعة الحالة إلى "+next:"تحرير الحالة من المتابعة");
    closeModal("claimModal");
    renderAll();
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
    toastMsg(next?"تم حجز الحالة للمتابعة بواسطة "+next:"أصبحت الحالة متاحة للمتابعة");
  };

  window.patientCardHtml=function(c){
    const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
    let followText="متاحة",followClass="pool";
    if(c.followUpBy){followText=(r.key==="ready"?"جاهزة — ":"تحت المتابعة — ")+c.followUpBy;followClass=r.key==="ready"?"ready":"main"}
    if(c.orDayId){followText="ضمن قائمة "+(d?gregDate(d.date):"")+" — "+(c.followUpBy||"غير محدد");followClass="main"}
    if(c.completedAt){followText="تمت";followClass="done"}
    return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(pathLabel(c.pathway))+' · '+esc(c.diagnosis||"")+'</div></div><div style="display:flex;gap:5px;flex-wrap:wrap"><span class="badge '+r.key+'">'+esc(r.label)+'</span><span class="badge '+followClass+'">'+esc(followText)+'</span></div></div>'+
      '<div class="caseMeta"><div><b>العملية</b>'+esc(c.procedure||"—")+'</div><div><b>يوم العمليات</b>'+esc(d?gregDate(d.date):"—")+'</div><div><b>المتابعة بواسطة</b>'+esc(c.followUpBy||"—")+'</div><div><b>المالك القديم</b>'+esc(c.legacyResidentOwner||"—")+'</div></div>'+
      '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div>'+
      '<div class="actions">'+(!c.completedAt&&c.pathway!=="emergency"?'<button class="btn secondary" onclick="openCase(\''+c.id+'\')">تعديل التجهيز</button><button class="btn '+(c.followUpBy?"warn":"dark")+'" onclick="openClaimCase(\''+c.id+'\')">'+(c.followUpBy?"نقل/تحرير المتابعة":"أخذ للمتابعة")+'</button>':'')+(c.orDayId?'<button class="btn dark" onclick="openDay(\''+c.orDayId+'\')">فتح يوم العمليات</button>':'')+'</div></div>';
  };

  window.syncLinkCaseOwner=function(){
    const c=getCase(document.getElementById("linkCaseSelect").value);
    const sel=document.getElementById("linkPreparedBy");
    sel.innerHTML='<option value="'+esc(c&&c.followUpBy?c.followUpBy:"")+'">'+esc(c&&c.followUpBy?c.followUpBy:"غير محدد")+'</option>';
    sel.disabled=true;
  };

  window.openLinkCase=function(){
    linkingCaseId="";
    const d=getDay(currentDayId);if(!d)return;
    if(!d.residents.length){alert("حدد المقيم أو المقيمين المسؤولين عن يوم العمليات أولًا.");return}
    const list=compatiblePoolForDay(d);
    const sel=document.getElementById("linkCaseSelect");
    sel.disabled=false;
    sel.onchange=syncLinkCaseOwner;
    sel.innerHTML=list.length?list.map(function(c){
      return '<option value="'+esc(c.id)+'">'+esc(c.mrn||"—")+' — '+esc(c.patientName||"—")+' — '+esc(c.procedure||"")+' — متابعة '+esc(c.followUpBy)+'</option>';
    }).join(""):'<option value="">لا توجد حالات جاهزة يتابعها أحد مقيمي هذا اليوم</option>';
    document.getElementById("linkRole").value="main";
    document.getElementById("linkCaseDayInfo").textContent=gregDate(d.date)+" — "+dayKindLabel(d.kind,d);
    syncLinkCaseOwner();
    openModal("linkCaseModal");
  };

  window.editDayCase=function(caseId){
    const c=getCase(caseId);if(!c)return;
    const d=getDay(c.orDayId);if(!d)return;
    currentDayId=d.id;linkingCaseId=c.id;
    const sel=document.getElementById("linkCaseSelect");
    sel.disabled=true;
    sel.innerHTML='<option value="'+esc(c.id)+'">'+esc(c.mrn||"—")+' — '+esc(c.patientName||"—")+'</option>';
    document.getElementById("linkPreparedBy").innerHTML='<option value="'+esc(c.followUpBy||"")+'">'+esc(c.followUpBy||"غير محدد")+'</option>';
    document.getElementById("linkPreparedBy").disabled=true;
    document.getElementById("linkRole").value=c.dayRole||"main";
    document.getElementById("linkCaseDayInfo").textContent=gregDate(d.date)+" — "+dayKindLabel(d.kind,d);
    openModal("linkCaseModal");
  };

  window.saveLinkCase=function(){
    const d=getDay(currentDayId);if(!d)return;
    const id=linkingCaseId||document.getElementById("linkCaseSelect").value;
    const c=getCase(id);if(!c){alert("اختر حالة.");return}
    if(!c.followUpBy){alert("يجب أولًا تحديد المقيم الذي يتابع الحالة.");return}
    if(readiness(c).key!=="ready"){alert("لا يمكن تحديد الحالة ليوم العمليات قبل اكتمال تجهيزها.");return}
    if(d.residents.indexOf(c.followUpBy)<0){alert("هذه الحالة يتابعها مقيم غير مشارك في يوم العمليات المحدد.");return}
    if(!linkingCaseId&&c.orDayId){alert("الحالة مرتبطة بيوم آخر.");return}
    c.orDayId=d.id;
    c.preparedBy=c.followUpBy;
    c.dayRole=document.getElementById("linkRole").value;
    c.updatedAt=nowIso();
    logEvent(linkingCaseId?"day_case_edit":"day_case_link",c,c.followUpBy,"ربط الحالة بيوم "+d.date+" — "+(c.dayRole==="reserve"?"احتياط":"أساسي"));
    closeModal("linkCaseModal");renderAll();
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
  };

  window.unlinkCase=function(id){
    const c=getCase(id);if(!c||c.completedAt)return;
    if(!confirm("إرجاع الحالة إلى Patient Pool؟ ستبقى محجوزة لنفس المقيم للمتابعة، ويظل تجهيزها كما هو."))return;
    c.orDayId="";c.dayRole="main";c.preparedBy=c.followUpBy||"";c.updatedAt=nowIso();
    logEvent("day_case_unlink",c,c.followUpBy||"","إرجاع الحالة إلى Patient Pool مع استمرار نفس المتابعة");
    renderAll();renderDayModal();
  };

  window.deleteDay=function(id){
    const d=getDay(id);if(!d)return;
    if(dayCases(id,true).some(function(c){return !!c.completedAt})){alert("لا يمكن حذف يوم يحتوي على عمليات مكتملة.");return}
    if(!confirm("حذف "+gregDate(d.date)+"؟ ستعود الحالات إلى Patient Pool وتبقى متابعة كل حالة مع نفس المقيم."))return;
    dayCases(id,false).forEach(function(c){c.orDayId="";c.dayRole="main";c.preparedBy=c.followUpBy||""});
    state.orDays=state.orDays.filter(function(x){return x.id!==id});
    logEvent("day_deleted",null,"","حذف يوم عمليات "+d.date);
    renderAll();
  };

  window.closeOperatingDay=function(id){
    const d=getDay(id);if(!d)return;
    const pending=dayCases(id,false);
    if(!confirm("إغلاق يوم العمليات؟ ستعود "+pending.length+" حالة لم تتم إلى Patient Pool مع استمرار متابعتها مع نفس المقيم."))return;
    pending.forEach(function(c){c.orDayId="";c.dayRole="main";c.preparedBy=c.followUpBy||""});
    d.status="completed";d.completedAt=nowIso();
    logEvent("day_completed",null,"","إغلاق يوم العمليات "+d.date+" وإرجاع "+pending.length+" حالة غير منفذة للمخزون");
    closeModal("dayModal");renderAll();toastMsg("تم إغلاق اليوم");
  };

  window.saveDayAssignments=function(){
    const d=getDay(currentDayId);if(!d)return;
    const selected=Array.from(document.getElementById("dayResidentChecks").querySelectorAll('input[type="checkbox"]:checked')).map(function(x){return x.value});
    const removed=d.residents.filter(function(n){return selected.indexOf(n)<0});
    d.residents=selected;
    dayCases(d.id,false).forEach(function(c){
      if(removed.indexOf(c.followUpBy)>=0){c.orDayId="";c.dayRole="main";c.preparedBy=c.followUpBy||""}
    });
    logEvent("day_residents",null,selected.join(" + "),"تحديث مقيمي يوم "+d.date);
    closeModal("assignDayModal");renderAll();
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
  };

  window.dayCaseHtml=function(c){
    const r=readiness(c),done=!!c.completedAt;
    const role=c.dayRole==="reserve"?"reserve":"main";
    const roleLabel=role==="reserve"?"احتياط":"أساسي";
    let buttons='<button class="btn secondary" onclick="openCase(\''+c.id+'\')">التجهيز</button>';
    if(!done){
      buttons+='<button class="btn secondary" onclick="editDayCase(\''+c.id+'\')">الدور</button><button class="btn secondary" onclick="toggleDayRole(\''+c.id+'\')">'+(c.dayRole==="reserve"?"إلى أساسي":"إلى احتياط")+'</button><button class="btn warn" onclick="unlinkCase(\''+c.id+'\')">إرجاع للمخزون</button>';
      if(r.key==="ready")buttons+='<button class="btn ok" onclick="openOperation(\''+c.id+'\')">✅ تمت العملية</button>';
    }
    return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(c.diagnosis||"")+' · '+esc(c.procedure||"")+'</div></div>'+
      '<div style="display:flex;gap:5px;flex-wrap:wrap"><span class="badge '+(done?"done":r.key)+'">'+(done?"تمت":esc(r.label))+'</span><span class="badge '+role+'">'+roleLabel+'</span></div></div>'+
      '<div class="caseMeta"><div><b>المتابعة بواسطة</b>'+esc(c.followUpBy||"غير محدد")+'</div><div><b>النوع</b>'+esc(pathLabel(c.pathway))+'</div><div><b>النواقص</b>'+r.missing.length+'</div><div><b>العملية الفعلية</b>'+esc(c.actualProcedure||c.procedure||"—")+'</div></div>'+
      '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div>'+
      '<div class="actions">'+buttons+'</div></div>';
  };

  window.removeResidentById=function(id){
    const r=state.residents.find(function(x){return x.id===id});if(!r)return;
    const openDays=state.orDays.filter(function(d){return d.status!=="completed"&&d.residents.indexOf(r.name)>=0});
    const followed=activePatientCases().filter(function(c){return c.followUpBy===r.name});
    let msg="حذف "+r.name+" من المقيمين الحاليين؟";
    if(openDays.length)msg+="\nسيُزال من "+openDays.length+" يوم عمليات مفتوح.";
    if(followed.length)msg+="\nسيتم تحرير "+followed.length+" حالة كان يتابعها لتصبح متاحة، وإرجاع المرتبط منها بيوم عمليات إلى Patient Pool.";
    msg+="\nالسجل التاريخي والعمليات المكتملة لن تُحذف.";
    if(!confirm(msg))return;
    openDays.forEach(function(d){d.residents=d.residents.filter(function(n){return n!==r.name})});
    followed.forEach(function(c){c.orDayId="";c.followUpBy="";c.preparedBy="";c.dayRole="main"});
    state.removedResidents.push(Object.assign({},clone(r),{removedAt:nowIso()}));
    state.residents=state.residents.filter(function(x){return x.id!==id});
    logEvent("resident_removed",null,r.name,"حذف المقيم وتحرير الحالات التي كان يتابعها");
    renderAll();
  };

  window.toggleArchiveCase=function(){
    const c=getCase(editingCaseId);if(!c)return;
    if(c.completedAt){alert("العملية مكتملة ومحفوظة في التقرير الشهري.");return}
    if(!c.archived){
      if(!confirm("أرشفة الحالة؟ سيتم تحريرها من المتابعة وإزالتها من أي يوم عمليات."))return;
      c.archived=true;c.ownerState="archived";c.orDayId="";c.followUpBy="";c.preparedBy="";c.dayRole="main";
    }else{c.archived=false;c.ownerState="pool"}
    c.updatedAt=nowIso();closeModal("caseModal");renderAll();
  };

  function loadHtml2Pdf(){
    return new Promise(function(resolve,reject){
      if(window.html2pdf){resolve();return}
      const old=document.getElementById("html2pdfLoader");
      if(old){old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});return}
      const sc=document.createElement("script");
      sc.id="html2pdfLoader";
      sc.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc);
    });
  }

  function pdfCaseStatus(c){
    const r=readiness(c);
    if(r.key==="ready")return "مكتمل التجهيز";
    return "الناقص: "+r.missing.map(function(x){return x.label}).join("، ");
  }

  function buildCasesPdfElement(){
    const ym=document.getElementById("scheduleMonth").value||defaultMonth();
    const cases=activePatientCases().slice().sort(function(a,b){
      const pa={day:1,elective:2,inpatient:3,minor:4}[a.pathway]||9;
      const pb={day:1,elective:2,inpatient:3,minor:4}[b.pathway]||9;
      return pa-pb||String(a.patientName||"").localeCompare(String(b.patientName||""));
    });
    const root=document.createElement("div");
    root.dir="rtl";
    root.style.cssText="position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#111;padding:28px;font-family:Arial,Tahoma,sans-serif;line-height:1.55";
    let html='<div style="text-align:center;margin-bottom:18px"><h1 style="font-size:24px;margin:0">حالات الجراحة العامة ونواقص التجهيز</h1><div style="font-size:13px;margin-top:5px">'+esc(new Date().toLocaleDateString("ar-SA-u-ca-gregory"))+'</div></div>';
    let last="";
    cases.forEach(function(c){
      if(c.pathway!==last){html+='<h2 style="font-size:18px;border-bottom:2px solid #0b5266;padding-bottom:6px;margin-top:22px">'+esc(pathLabel(c.pathway))+'</h2>';last=c.pathway}
      const d=c.orDayId?getDay(c.orDayId):null;
      html+='<div style="border:1px solid #ccd7db;border-radius:10px;padding:10px;margin:8px 0;break-inside:avoid">'+
        '<div style="font-size:16px;font-weight:700">'+esc(c.patientName||"—")+'</div>'+
        '<div>MRN: '+esc(c.mrn||"—")+'</div>'+
        '<div>العملية: '+esc(c.procedure||"—")+'</div>'+
        '<div>المتابعة بواسطة: '+esc(c.followUpBy||"متاحة")+'</div>'+
        (c.consultantPrepared?'<div style="font-weight:700;color:#6c4e8a">تجهيز الاستشاري — المقيم مساعد فقط</div>':'')+
        (d?'<div>يوم العمليات: '+esc(gregDate(d.date))+' - '+esc(dayKindLabel(d.kind,d))+' - '+(c.dayRole==="reserve"?"احتياط":"أساسي")+'</div>':'<div>الموقع: Patient Pool</div>')+
        '<div style="margin-top:5px;font-weight:700">'+esc(pdfCaseStatus(c))+'</div>'+
      '</div>';
    });
    if(!cases.length)html+='<div style="text-align:center;padding:30px">لا توجد حالات نشطة.</div>';
    const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
    html+='<div style="page-break-before:auto;margin-top:28px"><h2 style="font-size:20px;border-bottom:2px solid #0b5266;padding-bottom:6px">توزيع أيام العمليات - '+esc(monthTitle(ym))+'</h2>';
    if(days.length){
      html+='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="border:1px solid #bbb;padding:7px">التاريخ</th><th style="border:1px solid #bbb;padding:7px">النوع</th><th style="border:1px solid #bbb;padding:7px">المقيمون</th></tr></thead><tbody>';
      days.forEach(function(d){html+='<tr><td style="border:1px solid #bbb;padding:7px">'+esc(gregDate(d.date))+'</td><td style="border:1px solid #bbb;padding:7px">'+esc(dayKindLabel(d.kind,d))+'</td><td style="border:1px solid #bbb;padding:7px">'+esc(d.residents.length?d.residents.join(" + "):"غير محدد")+'</td></tr>'});
      html+='</tbody></table>';
    }else html+='<div>لا توجد أيام عمليات مسجلة لهذا الشهر.</div>';
    html+='</div>';
    root.innerHTML=html;document.body.appendChild(root);return root;
  }

  window.shareCasesPdf=async function(){
    const btn=document.getElementById("casesPdfBtn");
    if(btn){btn.disabled=true;btn.textContent="جاري إنشاء PDF..."}
    let root=null;
    try{
      await loadHtml2Pdf();
      root=buildCasesPdfElement();
      const filename="Surgery_Cases_Readiness_"+new Date().toISOString().slice(0,10)+".pdf";
      const options={margin:[7,7,7,7],filename:filename,image:{type:"jpeg",quality:0.96},html2canvas:{scale:2,useCORS:true,letterRendering:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}};
      const blob=await window.html2pdf().set(options).from(root).outputPdf("blob");
      const file=new File([blob],filename,{type:"application/pdf"});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"حالات الجراحة العامة ونواقص التجهيز"});
        toastMsg("تم تجهيز PDF للمشاركة");
      }else{
        const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
        setTimeout(function(){URL.revokeObjectURL(a.href)},1500);
        toastMsg("تم إنشاء PDF. شاركه من ملف التنزيلات.");
      }
    }catch(e){
      alert("تعذر إنشاء PDF الآن. تأكد من الاتصال بالإنترنت ثم حاول مرة أخرى.");
    }finally{
      if(root)root.remove();
      if(btn){btn.disabled=false;btn.textContent="PDF الحالات والنواقص"}
    }
  };

  ensureClaimState();
  installClaimModal();
  installPdfButton();
  renderAll();
})();
