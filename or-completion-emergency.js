// Direct completed-case undo + prominent emergency operation entry.
(function(){
  function canUndoAnyCompleted(c){
    return !!(c&&c.completedAt&&c.pathway!=="emergency"&&!c.legacyStatOnly);
  }

  window.undoCompletedOperation=function(id){
    const c=getCase(id);
    if(!canUndoAnyCompleted(c))return;
    if(!confirm("إلغاء تسجيل «تمت العملية» للمريض "+(c.patientName||"—")+"؟\nستُحذف من التقرير الشهري وتعود إلى Patient Pool مع الاحتفاظ بالتجهيز والمتابعة."))return;

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
        emergencyOptimization:c.emergencyOptimization||"",
        orDayId:c.orDayId||""
      }
    });

    delete c.completedAt;
    c.archived=false;
    c.ownerState="pool";
    c.orDayId="";
    c.performedBy="";
    c.assistedBy="";
    delete c.actualProcedure;
    delete c.operationPoints;
    c.orHours=0;
    c.emergencyOptimization="";
    c.updatedAt=nowIso();

    logEvent("operation_undo",c,c.followUpBy||c.preparedBy||"","إلغاء تسجيل العملية المكتملة وإعادة الحالة إلى Patient Pool");
    persist();
    renderAll();
    toastMsg("تم إرجاع الحالة إلى Patient Pool — "+readiness(c).label);
  };

  function rebuildCompletedCases(){
    const list=document.getElementById("monthlyCaseList");
    if(!list)return;
    const ym=document.getElementById("monthlyMonth").value||defaultMonth();
    const current=state.cases
      .filter(function(c){return c.completedAt&&String(c.completedAt).slice(0,7)===ym})
      .sort(function(a,b){return String(b.completedAt).localeCompare(String(a.completedAt))});

    const legacy=[];
    (state.legacyMonthlyRecovered||[]).filter(function(x){return x.month===ym}).forEach(function(x){
      for(let i=0;i<Number(x.count||1);i++){
        legacy.push({
          legacyStatOnly:true,
          actualProcedure:x.procedure,
          procedure:x.procedure,
          operationPoints:Number(x.points||0),
          pathway:x.pathway
        });
      }
    });

    const html=[];
    current.forEach(function(c){
      const undo=canUndoAnyCompleted(c)
        ?'<button class="btn warn" style="margin-top:8px" onclick="undoCompletedOperation(\''+c.id+'\')">↩️ إلغاء تمت وإرجاع للمخزون</button>'
        :"";
      const opt=c.pathway==="emergency"
        ?' · '+(c.emergencyOptimization==="non_optimized"?"Not Optimized — 4 points":"Optimized — 3 points")
        :"";
      html.push(
        '<div class="mini"><b>'+esc(c.actualProcedure||c.procedure||"—")+'</b>'+
        esc(c.patientName||"—")+' · '+esc(pathLabel(c.pathway))+' · '+Number(c.operationPoints||0)+' points · '+
        new Date(c.completedAt).toLocaleDateString("en-GB")+opt+
        undo+'</div>'
      );
    });
    legacy.forEach(function(c){
      html.push('<div class="mini"><b>'+esc(c.actualProcedure||c.procedure||"—")+'</b>سجل إحصائي قديم مستعاد · '+Number(c.operationPoints||0)+' points</div>');
    });
    list.innerHTML=html.length?html.join(""):'<div class="empty">لا توجد عمليات مكتملة في هذا الشهر.</div>';
  }

  const previousMonthly=window.renderMonthlyReport;
  window.renderMonthlyReport=function(){
    previousMonthly();
    rebuildCompletedCases();
  };

  const previousSaveCase=window.saveCase;
  window.saveCase=function(){
    const pathway=document.getElementById("pathway").value;
    if(pathway==="emergency"){
      if(editingCaseId){
        alert("الحالة الطارئة تُسجل كعملية مكتملة مباشرة من زر «تسجيل عملية طارئة»، ولا تُحوّل حالة نشطة إلى طارئة.");
        return;
      }
      const name=document.getElementById("patientName").value.trim();
      const mrn=document.getElementById("mrn").value.trim();
      const diagnosis=document.getElementById("diagnosis").value.trim();
      const procedure=document.getElementById("procedure").value.trim();
      closeModal("caseModal");
      openEmergencyOperation();
      document.getElementById("emPatient").value=name;
      document.getElementById("emMrn").value=mrn;
      document.getElementById("emDiagnosis").value=diagnosis;
      document.getElementById("emProcedure").value=procedure;
      return;
    }
    return previousSaveCase();
  };

  // Arabic labels and clear point values.
  const note=document.querySelector("#emergencyModal .note.info");
  if(note)note.textContent="الحالة الطارئة لا تدخل في توزيع أيام العمليات؛ تُسجل مباشرة بعد إجراء العملية.";
  const optLabel=document.querySelector('label[for="emOptimization"]');
  const emSel=document.getElementById("emOptimization");
  if(emSel){
    const field=emSel.closest(".field");
    const label=field&&field.querySelector("label");
    if(label)label.textContent="تصنيف الحالة الطارئة";
    emSel.innerHTML='<option value="optimized">Optimized — 3 نقاط</option><option value="non_optimized">Not Optimized — 4 نقاط</option>';
  }

  renderAll();
})();