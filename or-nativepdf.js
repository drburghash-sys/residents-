// System-print PDF flow: render a real printable HTML report and let Android/Chrome create the PDF.
(function(){
  function h(v){return esc(v==null?"":v)}

  function buildPrintHtml(){
    const ym=document.getElementById("scheduleMonth").value||defaultMonth();
    const cases=activePatientCases().slice().sort(function(a,b){
      const pa={day:1,elective:2,inpatient:3,minor:4}[a.pathway]||9;
      const pb={day:1,elective:2,inpatient:3,minor:4}[b.pathway]||9;
      return pa-pb||String(a.patientName||"").localeCompare(String(b.patientName||""));
    });
    const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
    const dsu=cases.filter(function(c){return c.pathway==="day"}).length;
    const elective=cases.filter(function(c){return c.pathway==="elective"}).length;
    const ready=cases.filter(function(c){return readiness(c).key==="ready"}).length;
    const total=cases.length;

    let body='';
    let lastPath='';
    cases.forEach(function(c){
      if(c.pathway!==lastPath){
        body+='<h2 class="section">'+h(pathLabel(c.pathway))+'</h2>';
        lastPath=c.pathway;
      }
      const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
      body+='<div class="case">'+
        '<div class="patient">'+h(c.patientName||"—")+'</div>'+
        '<div><b>MRN:</b> '+h(c.mrn||"—")+'</div>'+
        '<div><b>العملية:</b> '+h(c.procedure||"—")+'</div>'+
        '<div><b>المتابعة بواسطة:</b> '+h(c.followUpBy||"متاحة")+'</div>'+
        (c.consultantPrepared?'<div class="consultant">تجهيز الاستشاري — المقيم مساعد فقط</div>':'')+
        (d?'<div><b>يوم العمليات:</b> '+h(gregDate(d.date))+' — '+h(dayKindLabel(d.kind,d))+' — '+(c.dayRole==="reserve"?"احتياط":"أساسي")+'</div>':'<div><b>الموقع:</b> Patient Pool</div>')+
        '<div class="'+(r.key==="ready"?"ok":"missing")+'"><b>النواقص:</b> '+(r.key==="ready"?"لا يوجد — مكتمل التجهيز":h(r.missing.map(function(x){return x.label}).join("، ")))+'</div>'+
      '</div>';
    });
    if(!cases.length)body='<div class="empty">لا توجد حالات نشطة.</div>';

    let daysHtml='';
    if(days.length){
      daysHtml='<table><thead><tr><th>التاريخ</th><th>النوع</th><th>المقيمون</th></tr></thead><tbody>'+
        days.map(function(d){
          return '<tr><td>'+h(gregDate(d.date))+'</td><td>'+h(dayKindLabel(d.kind,d))+'</td><td>'+h(d.residents.length?d.residents.join(" + "):"غير محدد")+'</td></tr>';
        }).join("")+
      '</tbody></table>';
    }else{
      daysHtml='<div class="empty">لا توجد أيام عمليات مسجلة لهذا الشهر.</div>';
    }

    const balances=activeResidents().filter(function(r){return Number(r.compensation||0)>0});
    let compHtml='';
    if(balances.length){
      compHtml='<h2 class="section">رصيد التعويض</h2><div class="comp">'+
        balances.map(function(r){return '<div>'+h(r.name)+': <b>+'+Number(r.compensation||0)+'</b> يوم</div>'}).join("")+
      '</div>';
    }

    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'+
      '<meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>حالات الجراحة العامة ونواقص التجهيز</title>'+
      '<style>'+
      '@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#111;background:#fff;margin:0;line-height:1.6}'+
      '.toolbar{position:sticky;top:0;z-index:5;background:#0b5266;color:#fff;padding:10px;display:flex;gap:8px;align-items:center;justify-content:space-between}'+
      '.toolbar button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.toolbar .print{background:#fff;color:#0b5266}.toolbar .close{background:#ffffff22;color:#fff;border:1px solid #ffffff55}'+
      '.page{max-width:820px;margin:0 auto;padding:22px}.title{font-size:26px;font-weight:800;color:#0b5266;margin:0}.date{color:#666;margin-top:4px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.sum{border:1px solid #d8e2e6;border-radius:12px;padding:10px;text-align:center}.sum b{display:block;font-size:22px;color:#0b5266}.sum span{font-size:12px;color:#666}'+
      '.section{font-size:18px;color:#0b5266;background:#eaf4f7;padding:7px 10px;border-radius:8px;margin:18px 0 8px}.case{border:1px solid #d8e2e6;border-radius:10px;padding:10px 12px;margin:8px 0;break-inside:avoid}.patient{font-size:18px;font-weight:800}.missing{color:#8a5300;font-weight:700}.ok{color:#137653;font-weight:700}.consultant{color:#6c4e8a;font-weight:800}.empty{padding:24px;text-align:center;color:#666}'+
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #bbb;padding:8px;text-align:right}th{background:#f2f6f7}.comp{border:1px solid #ead7ab;background:#fff8e8;border-radius:10px;padding:10px}'+
      '@media(max-width:650px){.summary{grid-template-columns:repeat(2,1fr)}.page{padding:14px}.title{font-size:21px}}'+
      '@media print{.toolbar{display:none}.page{max-width:none;padding:0}.case{break-inside:avoid}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'+
      '</style></head><body>'+
      '<div class="toolbar"><div>معاينة التقرير قبل حفظ PDF</div><div><button class="print" onclick="window.print()">طباعة / حفظ PDF</button> <button class="close" onclick="window.close()">إغلاق</button></div></div>'+
      '<main class="page">'+
      '<h1 class="title">حالات الجراحة العامة ونواقص التجهيز</h1>'+
      '<div class="date">'+h(new Date().toLocaleDateString("ar-SA-u-ca-gregory"))+'</div>'+
      '<div class="summary">'+
        '<div class="sum"><b>'+dsu+'</b><span>DSU</span></div>'+
        '<div class="sum"><b>'+elective+'</b><span>Elective</span></div>'+
        '<div class="sum"><b>'+ready+'</b><span>جاهز</span></div>'+
        '<div class="sum"><b>'+total+'</b><span>الإجمالي</span></div>'+
      '</div>'+
      body+
      '<h2 class="section">توزيع أيام العمليات — '+h(monthTitle(ym))+'</h2>'+
      daysHtml+
      compHtml+
      '</main></body></html>';
  }

  window.shareCasesPdf=function(){
    let w=null;
    try{
      w=window.open("","_blank");
      if(!w){
        alert("تعذر فتح معاينة PDF. اسمح للنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى.");
        return;
      }
      w.document.open();
      w.document.write(buildPrintHtml());
      w.document.close();
      toastMsg("فتحت معاينة التقرير. اضغط «طباعة / حفظ PDF».");
    }catch(e){
      console.error("Print preview failed",e);
      if(w)w.close();
      alert("تعذر فتح معاينة التقرير على هذا الجهاز.");
    }
  };
})();