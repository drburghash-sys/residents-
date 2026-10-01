// Patient page refinements: DSU/Elective filters + prominent operation completion action.
(function(){
  window.renderPatients=function(){
    const active=activePatientCases();
    if($("pDsuCount"))$("pDsuCount").textContent=active.filter(function(c){return c.pathway==="day"}).length;
    if($("pElectiveCount"))$("pElectiveCount").textContent=active.filter(function(c){return c.pathway==="elective"}).length;
    if($("pReadyCount"))$("pReadyCount").textContent=active.filter(function(c){return readiness(c).key==="ready"}).length;
    if($("pTotalCount"))$("pTotalCount").textContent=active.length;

    const q=String($("patientSearch").value||"").trim().toLowerCase();
    let list=state.cases.filter(function(c){
      if(patientFilter==="archive")return c.archived||!!c.completedAt;
      if(c.archived||c.completedAt||c.pathway==="emergency")return false;
      if(patientFilter==="pool")return !c.orDayId;
      if(patientFilter==="linked")return !!c.orDayId;
      if(patientFilter==="ready")return readiness(c).key==="ready";
      if(patientFilter==="notready")return readiness(c).key!=="ready";
      if(patientFilter==="dsu")return c.pathway==="day";
      if(patientFilter==="elective")return c.pathway==="elective";
      return true;
    });

    if(q)list=list.filter(function(c){
      return [c.patientName,c.mrn,c.diagnosis,c.procedure].join(" ").toLowerCase().indexOf(q)>=0;
    });
    list.sort(function(a,b){return String(a.patientName||"").localeCompare(String(b.patientName||""))});
    $("patientsList").innerHTML=list.length?list.map(patientCardHtml).join(""):'<div class="empty">لا توجد حالات في هذا العرض.</div>';
  };

  window.patientCardHtml=function(c){
    const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
    let followText="متاحة",followClass="pool";
    if(c.consultantPrepared){followText="تجهيز الاستشاري — المقيم مساعد فقط";followClass="violet"}
    else if(c.followUpBy){followText=(r.key==="ready"?"جاهزة — ":"تحت المتابعة — ")+c.followUpBy;followClass=r.key==="ready"?"ready":"main"}
    if(c.orDayId)followText="ضمن قائمة "+(d?gregDate(d.date):"")+" — "+(c.consultantPrepared?"الاستشاري / مساعد فقط":(c.followUpBy||"غير محدد"));
    if(c.completedAt){followText="تمت";followClass="done"}

    let actions="";
    if(!c.completedAt&&c.pathway!=="emergency"){
      actions+='<button class="btn secondary" onclick="openCase(\''+c.id+'\')">تعديل التجهيز</button>';
      actions+='<button class="btn '+(c.followUpBy?"warn":"dark")+'" onclick="openClaimCase(\''+c.id+'\')">'+(c.followUpBy?"نقل/تحرير المتابعة":"أخذ للمتابعة")+'</button>';
    }
    if(c.orDayId&&!c.completedAt){
      actions+='<button class="btn ok" style="font-weight:900" onclick="openOperation(\''+c.id+'\')">✅ تمت العملية</button>';
      actions+='<button class="btn dark" onclick="openDay(\''+c.orDayId+'\')">فتح يوم العمليات</button>';
    }

    return '<div class="card caseCard"><div class="row"><div><div class="name">'+esc(c.patientName||"—")+'</div><div class="sub">MRN '+esc(c.mrn||"—")+' · '+esc(pathLabel(c.pathway))+' · '+esc(c.diagnosis||"")+'</div></div><div style="display:flex;gap:5px;flex-wrap:wrap"><span class="badge '+r.key+'">'+esc(r.label)+'</span><span class="badge '+followClass+'">'+esc(followText)+'</span></div></div>'+
      '<div class="caseMeta"><div><b>العملية</b>'+esc(c.procedure||"—")+'</div><div><b>يوم العمليات</b>'+esc(d?gregDate(d.date):"—")+'</div><div><b>المتابعة بواسطة</b>'+esc(c.followUpBy||"—")+'</div><div><b>الوضع</b>'+esc(c.consultantPrepared?"المقيم مساعد فقط":"تدريب مقيم")+'</div></div>'+
      '<div class="missing">'+(r.missing.length?r.missing.map(function(x){return '<span class="miss">'+esc(x.label)+'</span>'}).join(""):'<span class="miss done">التجهيز مكتمل</span>')+'</div>'+
      '<div class="actions">'+actions+'</div></div>';
  };
})();