// Undo mistaken operation completion + configurable weekly OR days + move OR day dates.
(function(){
  const WEEKDAYS=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

  function ensureSettings(){
    state.settings=state.settings||{};
    if(state.settings.dsuWeekday==null)state.settings.dsuWeekday=0;
    if(state.settings.electiveWeekday==null)state.settings.electiveWeekday=4;
  }

  function dayMatchesKind(c,d){
    if(d.kind==="dsu")return c.pathway==="day";
    if(d.kind==="elective")return c.pathway==="elective";
    return c.pathway!=="emergency";
  }

  window.generateStandardDays=function(ym){
    ensureSettings();
    if(!/^\d{4}-\d{2}$/.test(ym))return 0;
    const parts=ym.split("-"),y=Number(parts[0]),m=Number(parts[1]),last=new Date(y,m,0).getDate();
    const dsuDay=Number(state.settings.dsuWeekday),electiveDay=Number(state.settings.electiveWeekday);
    let added=0;
    for(let n=1;n<=last;n++){
      const dt=new Date(y,m-1,n,12,0,0),dow=dt.getDay();
      let kinds=[];
      if(dow===dsuDay)kinds.push("dsu");
      if(dow===electiveDay)kinds.push("elective");
      if(!kinds.length)continue;
      const date=ym+"-"+String(n).padStart(2,"0");
      kinds.forEach(function(kind){
        if(dayByDateKind(date,kind))return;
        state.orDays.push({
          id:uid("OR"),date:date,kind:kind,label:"",residents:[],status:"open",notes:"",
          createdAt:nowIso(),generatedStandard:true
        });
        added++;
      });
    }
    if(added)state.events.push(eventObj("generate_days","","","إنشاء "+added+" يوم عمليات أساسي لشهر "+ym+
      " — DSU "+WEEKDAYS[dsuDay]+" / Elective "+WEEKDAYS[electiveDay]));
    return added;
  };

  window.createStandardDays=function(){
    const ym=document.getElementById("scheduleMonth").value;
    const n=generateStandardDays(ym);
    renderAll();
    toastMsg(n?"تم إنشاء "+n+" يوم عمليات":"الأيام الأساسية موجودة مسبقًا");
  };

  function isEmptyUnusedStandardDay(d){
    return (d.kind==="dsu"||d.kind==="elective") &&
      d.status!=="completed" &&
      (!d.residents||!d.residents.length) &&
      dayCases(d.id,true).length===0;
  }

  window.saveWeeklyDaySettings=function(){
    ensureSettings();
    const dsu=Number(document.getElementById("dsuWeekdaySelect").value);
    const elective=Number(document.getElementById("electiveWeekdaySelect").value);
    if(!Number.isInteger(dsu)||dsu<0||dsu>6||!Number.isInteger(elective)||elective<0||elective>6){
      alert("اختر أيامًا صحيحة.");return;
    }
    state.settings.dsuWeekday=dsu;
    state.settings.electiveWeekday=elective;
    const ym=document.getElementById("scheduleMonth").value;

    let removed=0,preserved=0;
    state.orDays=state.orDays.filter(function(d){
      if(ymFromDate(d.date)!==ym||!(d.kind==="dsu"||d.kind==="elective"))return true;
      if(isEmptyUnusedStandardDay(d)){removed++;return false}
      preserved++;return true;
    });

    const added=generateStandardDays(ym);
    logEvent("weekly_days_changed",null,"","تغيير الأيام الأساسية: DSU "+WEEKDAYS[dsu]+" / Elective "+WEEKDAYS[elective]);
    persist();renderAll();

    let msg="تم الحفظ: DSU "+WEEKDAYS[dsu]+"، Elective "+WEEKDAYS[elective]+".";
    if(removed||added)msg+=" تم تحديث الأيام الفارغة للشهر (حذف "+removed+" / إضافة "+added+").";
    if(preserved)msg+=" الأيام التي عليها مقيمون أو حالات لم تُنقل تلقائيًا؛ افتح اليوم واضغط «تغيير التاريخ» إذا أردت نقلها.";
    toastMsg(msg);
  };

  function syncWeeklyControls(){
    ensureSettings();
    const a=document.getElementById("dsuWeekdaySelect"),b=document.getElementById("electiveWeekdaySelect");
    if(a)a.value=String(state.settings.dsuWeekday);
    if(b)b.value=String(state.settings.electiveWeekday);
    const s=document.getElementById("weeklyDaysSummary");
    if(s)s.textContent="الحالي: DSU يوم "+WEEKDAYS[Number(state.settings.dsuWeekday)]+" — Elective يوم "+WEEKDAYS[Number(state.settings.electiveWeekday)];
  }

  function installMoveDayUi(){
    const dayModal=document.getElementById("dayModal");
    if(dayModal&&!document.getElementById("moveDayBtn")){
      const actions=dayModal.querySelector(".actions");
      if(actions){
        const b=document.createElement("button");
        b.id="moveDayBtn";b.className="btn violet";b.textContent="📅 تغيير التاريخ";
        b.onclick=function(){openMoveDay(currentDayId)};
        actions.appendChild(b);
      }
    }
    if(document.getElementById("moveDayModal"))return;
    const m=document.createElement("div");
    m.id="moveDayModal";m.className="modal";
    m.innerHTML='<div class="sheet">'+
      '<div class="row"><h2 style="margin:0">تغيير تاريخ يوم العمليات</h2><button class="btn secondary" onclick="closeModal(\'moveDayModal\')">إغلاق</button></div>'+
      '<input id="moveDayId" type="hidden">'+
      '<div id="moveDayInfo" class="note info"></div>'+
      '<div class="field"><label>التاريخ الجديد</label><input id="moveDayDate" type="date"></div>'+
      '<div class="note">سيبقى نفس المقيم/المقيمين ونفس الحالات مرتبطة باليوم؛ الذي يتغير هو التاريخ فقط.</div>'+
      '<div class="footer-actions"><button class="btn dark" onclick="saveMoveDay()">حفظ التاريخ الجديد</button></div>'+
      '</div>';
    document.body.appendChild(m);
    m.addEventListener("click",function(e){if(e.target.id==="moveDayModal")closeModal("moveDayModal")});
  }

  window.openMoveDay=function(id){
    const d=getDay(id);if(!d)return;
    document.getElementById("moveDayId").value=d.id;
    document.getElementById("moveDayDate").value=d.date;
    document.getElementById("moveDayInfo").innerHTML='<b>'+esc(gregDate(d.date))+'</b> — '+esc(dayKindLabel(d.kind,d))+
      '<br>المقيمون: '+esc(d.residents&&d.residents.length?d.residents.join(" + "):"غير محدد")+
      ' · الحالات المرتبطة: '+dayCases(d.id,true).length;
    openModal("moveDayModal");
  };

  window.saveMoveDay=function(){
    const id=document.getElementById("moveDayId").value,d=getDay(id);if(!d)return;
    const next=document.getElementById("moveDayDate").value;
    if(!next){alert("حدد التاريخ الجديد.");return}
    if(next===d.date){closeModal("moveDayModal");return}
    const duplicate=state.orDays.find(function(x){return x.id!==d.id&&x.date===next&&x.kind===d.kind});
    if(duplicate){
      alert("يوجد بالفعل يوم "+dayKindLabel(d.kind,d)+" في هذا التاريخ. اختر تاريخًا آخر.");return;
    }
    const old=d.date;
    d.originalDate=d.originalDate||old;
    d.date=next;d.movedManually=true;d.updatedAt=nowIso();
    logEvent("or_day_moved",null,d.residents.join(" + "),"تغيير يوم "+dayKindLabel(d.kind,d)+" من "+old+" إلى "+next);
    closeModal("moveDayModal");
    const month=ymFromDate(next);
    if(document.getElementById("scheduleMonth"))document.getElementById("scheduleMonth").value=month;
    persist();renderAll();toastMsg("تم تغيير تاريخ يوم العمليات");
    if(document.getElementById("dayModal").classList.contains("show"))renderDayModal();
  };

  function canUndoCompletion(c){
    return !!(c&&c.completedAt&&c.pathway!=="emergency"&&(c.orDayId||c.followUpBy||c.preparedBy));
  }
  window.canUndoCompletion=canUndoCompletion;

  window.undoCompletedOperation=function(id){
    const c=getCase(id);if(!canUndoCompletion(c))return;
    const d=c.orDayId?getDay(c.orDayId):null;
    let extra="";
    if(d&&d.status==="completed")extra="\nيوم العمليات المرتبط بهذه الحالة مغلق؛ ستعود الحالة إلى Patient Pool مع بقاء المقيم المسؤول.";
    if(!confirm("إلغاء تسجيل «تمت العملية» للمريض "+(c.patientName||"—")+"؟\nسيتم حذفها من التقرير الشهري وإعادتها إلى الحالات النشطة."+extra))return;

    c.history=Array.isArray(c.history)?c.history:[];
    c.history.push({
      type:"undo_operation",
      at:nowIso(),
      previous:{
        completedAt:c.completedAt||"",
        performedBy:c.performedBy||"",
        actualProcedure:c.actualProcedure||"",
        assistedBy:c.assistedBy||"",
        operationPoints:Number(c.operationPoints||0),
        orHours:Number(c.orHours||0),
        emergencyOptimization:c.emergencyOptimization||""
      }
    });

    if(d&&d.status==="completed")c.orDayId="";
    delete c.completedAt;
    c.archived=false;
    c.ownerState="pool";
    c.performedBy="";
    c.assistedBy="";
    delete c.actualProcedure;
    delete c.operationPoints;
    c.orHours=0;
    c.emergencyOptimization="";
    c.updatedAt=nowIso();

    logEvent("operation_undo",c,c.followUpBy||c.preparedBy||"","إلغاء تسجيل العملية المكتملة وإعادة الحالة للنشاط");
    persist();renderAll();
    const r=readiness(c);
    toastMsg("تم الإرجاع. حالة المريض الآن: "+r.label);
  };

  window.undoSelectedCompletedOperation=function(){
    const sel=document.getElementById("undoCompletedSelect");
    if(sel&&sel.value)undoCompletedOperation(sel.value);
  };

  function installUndoMonthlyCard(){
    if(document.getElementById("undoCompletedCard"))return;
    const sec=document.getElementById("monthlySection");
    if(!sec)return;
    const first=sec.querySelector(".card");
    const card=document.createElement("div");
    card.className="card";card.id="undoCompletedCard";
    card.innerHTML='<div class="name">تصحيح «تمت العملية» المسجلة بالخطأ</div>'+
      '<div class="sub">يعيد الحالة إلى الحالات النشطة ويزيلها من التقرير الشهري مع الاحتفاظ بسجل التراجع.</div>'+
      '<div class="grid" style="margin-top:10px"><div class="field"><label>العملية</label><select id="undoCompletedSelect"></select></div>'+
      '<div class="field" style="align-self:end"><button id="undoCompletedBtn" class="btn warn" onclick="undoSelectedCompletedOperation()">↩️ إلغاء تمت وإرجاع الحالة</button></div></div>';
    first.insertAdjacentElement("afterend",card);
  }

  function renderUndoCompletedSelector(){
    const sel=document.getElementById("undoCompletedSelect"),btn=document.getElementById("undoCompletedBtn");
    if(!sel)return;
    const ym=document.getElementById("monthlyMonth").value||defaultMonth();
    const list=state.cases.filter(function(c){return canUndoCompletion(c)&&String(c.completedAt).slice(0,7)===ym})
      .sort(function(a,b){return String(b.completedAt).localeCompare(String(a.completedAt))});
    sel.innerHTML=list.length?list.map(function(c){
      return '<option value="'+esc(c.id)+'">'+esc(c.patientName||"—")+' — '+esc(c.actualProcedure||c.procedure||"—")+' — '+new Date(c.completedAt).toLocaleDateString("en-GB")+'</option>';
    }).join(""):'<option value="">لا توجد عمليات قابلة للتراجع في هذا الشهر</option>';
    if(btn)btn.disabled=!list.length;
  }

  const oldPatientCardHtml=window.patientCardHtml;
  window.patientCardHtml=function(c){
    let html=oldPatientCardHtml(c);
    if(canUndoCompletion(c)){
      const b='<button class="btn warn" onclick="undoCompletedOperation(\''+c.id+'\')">↩️ إلغاء تمت وإرجاع الحالة</button>';
      html=html.replace('<div class="actions">','<div class="actions">'+b);
    }
    return html;
  };

  const oldRenderSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    oldRenderSchedule();
    syncWeeklyControls();
  };

  const oldRenderMonthlyReport=window.renderMonthlyReport;
  window.renderMonthlyReport=function(){
    oldRenderMonthlyReport();
    renderUndoCompletedSelector();
  };

  ensureSettings();
  installMoveDayUi();
  installUndoMonthlyCard();
  syncWeeklyControls();
  renderAll();
})();