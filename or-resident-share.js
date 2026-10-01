// Group active cases by resident for WhatsApp/group sharing.
(function(){
  function caseBlock(c,index){
    const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
    let t=(index+1)+". "+(c.patientName||"—")+"\n";
    t+="MRN: "+(c.mrn||"—")+"\n";
    t+="العملية: "+(c.procedure||"—")+"\n";
    t+="الجاهزية: "+(r.key==="ready"?"جاهز":"غير جاهز")+"\n";
    if(r.missing.length)t+="النواقص: "+r.missing.map(function(x){return x.label}).join("، ")+"\n";
    if(d)t+="يوم العمليات: "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+" — "+(c.dayRole==="reserve"?"احتياط":"أساسي")+"\n";
    else t+="يوم العمليات: لم يحدد بعد\n";
    return t+"──────────────\n";
  }

  function residentCasesText(selected){
    const list=activePatientCases().slice();
    let t="📋 حالات المقيمين\n\n";

    if(selected&&selected!=="all"&&selected!=="consultant"&&selected!=="unassigned"){
      const cases=list.filter(function(c){return !c.consultantPrepared&&c.followUpBy===selected});
      t+="━━━━━━━━ "+selected+" — "+cases.length+" حالة ━━━━━━━━\n";
      cases.forEach(function(c,i){t+=caseBlock(c,i)});
      if(!cases.length)t+="لا توجد حالات تحت متابعة هذا المقيم.";
      return t.trim();
    }

    if(selected==="consultant"){
      const consultant=list.filter(function(c){return c.consultantPrepared});
      t+="━━━━━━━━ تجهيز الاستشاري — "+consultant.length+" حالة ━━━━━━━━\n";
      consultant.forEach(function(c,i){
        t+=caseBlock(c,i);
        t+="المقيم: مساعد فقط\n";
      });
      if(!consultant.length)t+="لا توجد حالات تجهيز استشاري.";
      return t.trim();
    }

    if(selected==="unassigned"){
      const unassigned=list.filter(function(c){return !c.consultantPrepared&&!c.followUpBy});
      t+="━━━━━━━━ حالات غير موزعة — "+unassigned.length+" ━━━━━━━━\n";
      unassigned.forEach(function(c,i){t+=caseBlock(c,i)});
      if(!unassigned.length)t+="لا توجد حالات غير موزعة.";
      return t.trim();
    }

    activeResidents().forEach(function(r){
      const cases=list.filter(function(c){return !c.consultantPrepared&&c.followUpBy===r.name});
      if(!cases.length)return;
      t+="━━━━━━━━ "+r.name+" — "+cases.length+" حالة ━━━━━━━━\n";
      cases.forEach(function(c,i){t+=caseBlock(c,i)});
      t+="\n";
    });

    const consultant=list.filter(function(c){return c.consultantPrepared});
    if(consultant.length){
      t+="━━━━━━━━ تجهيز الاستشاري — "+consultant.length+" حالة ━━━━━━━━\n";
      consultant.forEach(function(c,i){t+=caseBlock(c,i)+"المقيم: مساعد فقط\n"});
      t+="\n";
    }

    const unassigned=list.filter(function(c){return !c.consultantPrepared&&!c.followUpBy});
    if(unassigned.length){
      t+="━━━━━━━━ حالات غير موزعة — "+unassigned.length+" ━━━━━━━━\n";
      unassigned.forEach(function(c,i){t+=caseBlock(c,i)});
    }

    return t.trim();
  }

  function selectedValue(){
    const s=document.getElementById("residentShareSelect");
    return s?s.value:"all";
  }

  window.updateResidentCasesReport=function(){
    const box=document.getElementById("residentCasesReport");
    if(box)box.value=residentCasesText(selectedValue());
  };

  window.shareResidentCases=function(){
    const sel=selectedValue();
    const title=sel==="all"?"حالات المقيمين":("حالات "+sel);
    return shareText(residentCasesText(sel),title);
  };

  const oldRenderReports=window.renderReports;
  window.renderReports=function(){
    oldRenderReports();
    const select=document.getElementById("residentShareSelect");
    if(select){
      const current=select.value||"all";
      select.innerHTML='<option value="all">كل المقيمين</option>'+
        activeResidents().map(function(r){return '<option value="'+esc(r.name)+'">'+esc(r.name)+'</option>'}).join("")+
        '<option value="consultant">تجهيز الاستشاري</option><option value="unassigned">حالات غير موزعة</option>';
      if(Array.from(select.options).some(function(o){return o.value===current}))select.value=current;
    }
    updateResidentCasesReport();
  };
})();