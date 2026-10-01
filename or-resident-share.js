// Group active cases by resident for WhatsApp/group sharing.
(function(){
  function residentCasesText(){
    const list=activePatientCases().slice();
    const residents=activeResidents().map(function(r){return r.name});
    let t="📋 حالات المقيمين\n\n";

    residents.forEach(function(name){
      const cases=list.filter(function(c){return !c.consultantPrepared&&c.followUpBy===name});
      if(!cases.length)return;
      t+="━━━━━━━━ "+name+" — "+cases.length+" حالة ━━━━━━━━\n";
      cases.forEach(function(c,i){
        const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
        t+=(i+1)+". "+(c.patientName||"—")+"\n";
        t+="MRN: "+(c.mrn||"—")+"\n";
        t+="العملية: "+(c.procedure||"—")+"\n";
        t+="الجاهزية: "+(r.key==="ready"?"جاهز":"غير جاهز")+"\n";
        if(r.missing.length)t+="النواقص: "+r.missing.map(function(x){return x.label}).join("، ")+"\n";
        if(d)t+="يوم العمليات: "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+" — "+(c.dayRole==="reserve"?"احتياط":"أساسي")+"\n";
        else t+="يوم العمليات: لم يحدد بعد\n";
        t+="──────────────\n";
      });
      t+="\n";
    });

    const consultant=list.filter(function(c){return c.consultantPrepared});
    if(consultant.length){
      t+="━━━━━━━━ تجهيز الاستشاري — "+consultant.length+" حالة ━━━━━━━━\n";
      consultant.forEach(function(c,i){
        const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
        t+=(i+1)+". "+(c.patientName||"—")+"\n";
        t+="MRN: "+(c.mrn||"—")+"\n";
        t+="العملية: "+(c.procedure||"—")+"\n";
        t+="المقيم: مساعد فقط\n";
        if(r.missing.length)t+="النواقص: "+r.missing.map(function(x){return x.label}).join("، ")+"\n";
        if(d)t+="يوم العمليات: "+gregDate(d.date)+" — "+dayKindLabel(d.kind,d)+"\n";
        t+="──────────────\n";
      });
      t+="\n";
    }

    const unassigned=list.filter(function(c){return !c.consultantPrepared&&!c.followUpBy});
    if(unassigned.length){
      t+="━━━━━━━━ حالات غير موزعة — "+unassigned.length+" ━━━━━━━━\n";
      unassigned.forEach(function(c,i){
        const r=readiness(c);
        t+=(i+1)+". "+(c.patientName||"—")+"\n";
        t+="MRN: "+(c.mrn||"—")+"\n";
        t+="العملية: "+(c.procedure||"—")+"\n";
        t+="الجاهزية: "+(r.key==="ready"?"جاهز":"غير جاهز")+"\n";
        if(r.missing.length)t+="النواقص: "+r.missing.map(function(x){return x.label}).join("، ")+"\n";
        t+="──────────────\n";
      });
    }

    if(!residents.some(function(n){return list.some(function(c){return c.followUpBy===n&&!c.consultantPrepared})})&&!consultant.length&&!unassigned.length){
      t+="لا توجد حالات نشطة.";
    }
    return t.trim();
  }

  function splitText(text,maxLen){
    const lines=String(text||"").split("\n"),parts=[];
    let cur="";
    function push(){if(cur.trim())parts.push(cur.trim());cur=""}
    lines.forEach(function(line){
      const test=cur?cur+"\n"+line:line;
      if(test.length>maxLen&&cur){push();cur=line}
      else cur=test;
    });
    push();
    return parts;
  }

  window.buildResidentCasesText=residentCasesText;

  window.shareResidentCases=async function(){
    const parts=splitText(residentCasesText(),2800);
    if(parts.length<=1){
      return shareText(parts[0],"حالات المقيمين");
    }
    for(let i=0;i<parts.length;i++){
      try{
        await navigator.clipboard.writeText("الجزء "+(i+1)+" من "+parts.length+"\n\n"+parts[i]);
        if(i===0)toastMsg("التقرير طويل. تم نسخ الجزء 1؛ استخدم زر النسخ للأجزاء من المعاينة.");
      }catch(e){}
    }
    alert("التقرير طويل ومقسم إلى "+parts.length+" أجزاء. استخدم زر «نسخ» ثم أرسل الأجزاء إلى القروب بالترتيب.");
  };

  const oldRenderReports=window.renderReports;
  window.renderReports=function(){
    oldRenderReports();
    const box=document.getElementById("residentCasesReport");
    if(box)box.value=residentCasesText();
  };
})();