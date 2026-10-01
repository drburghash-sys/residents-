// Clear guidance when adding cases to an OR day.
(function(){
  function matchesDayType(c,d){
    if(d.kind==="dsu")return c.pathway==="day";
    if(d.kind==="elective")return c.pathway==="elective";
    return c.pathway!=="emergency";
  }

  function setSaveEnabled(enabled){
    const modal=document.getElementById("linkCaseModal");
    if(!modal)return;
    const btn=modal.querySelector(".footer-actions .btn");
    if(btn)btn.disabled=!enabled;
  }

  window.goToPatientPoolForFollowup=function(){
    closeModal("linkCaseModal");
    showTab("patients");
    const chip=document.querySelector('#patientFilters .chip[data-f="pool"]');
    if(chip)setPatientFilter(chip);
    setTimeout(function(){
      const el=document.getElementById("patientsSection");
      if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
    },50);
  };

  window.openLinkCase=function(){
    linkingCaseId="";
    const d=getDay(currentDayId);if(!d)return;

    if(!d.residents.length){
      alert("لم يتم تحديد مقيم لهذا اليوم بعد. اختر مقيم/مقيمي يوم العمليات أولًا.");
      openDayAssignments(d.id);
      return;
    }

    const pool=poolCases().filter(function(c){return matchesDayType(c,d)});
    const residents=d.residents.slice();
    const followed=pool.filter(function(c){
      return !c.consultantPrepared&&residents.indexOf(c.followUpBy)>=0;
    });
    const followedReady=followed.filter(function(c){return readiness(c).key==="ready"});
    const followedNotReady=followed.filter(function(c){return readiness(c).key!=="ready"});
    const consultantReady=pool.filter(function(c){return c.consultantPrepared&&readiness(c).key==="ready"});
    const list=compatiblePoolForDay(d);

    const info=document.getElementById("linkCaseDayInfo");
    info.innerHTML=
      '<b>'+esc(gregDate(d.date))+' — '+esc(dayKindLabel(d.kind,d))+'</b><br>'+
      'مقيمو اليوم: <b>'+esc(residents.join(" + "))+'</b><br>'+
      'حالات تحت متابعتهم: <b>'+followed.length+'</b> · جاهزة: <b>'+followedReady.length+'</b> · غير جاهزة: <b>'+followedNotReady.length+'</b>'+
      (consultantReady.length?' · تجهيز الاستشاري الجاهز: <b>'+consultantReady.length+'</b>':'')+
      (!list.length?'<div style="margin-top:8px;padding:9px;border-radius:10px;background:#fff4df;color:#805000"><b>المقيم موجود، لكن لا توجد حالة جاهزة تحت متابعته.</b><br>من صفحة المرضى: يختار المقيم الحالة للمتابعة أولًا، ثم يُكمل نواقصها. بعد أن تصبح جاهزة ستظهر هنا تلقائيًا.<br><button class="btn secondary" style="margin-top:7px" onclick="goToPatientPoolForFollowup()">اذهب إلى Patient Pool</button></div>':'');

    const sel=document.getElementById("linkCaseSelect");
    sel.disabled=!list.length;
    sel.onchange=syncLinkCaseOwner;
    sel.innerHTML=list.length?list.map(function(c){
      const owner=c.consultantPrepared?"الاستشاري":(c.followUpBy||"غير محدد");
      return '<option value="'+esc(c.id)+'">'+esc(c.mrn||"—")+' — '+esc(c.patientName||"—")+' — '+esc(c.procedure||"")+' — متابعة '+esc(owner)+'</option>';
    }).join(""):'<option value="">لا توجد حالات مؤهلة حاليًا</option>';

    document.getElementById("linkRole").value="main";
    if(list.length)syncLinkCaseOwner();
    else{
      const p=document.getElementById("linkPreparedBy");
      p.innerHTML='<option value="">—</option>';p.disabled=true;
    }
    setSaveEnabled(!!list.length);
    openModal("linkCaseModal");
  };
})();