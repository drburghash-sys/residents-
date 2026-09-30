// Fix: robust PDF generation + complete WhatsApp sharing in numbered parts.
(function(){
  let whatsappParts=[];

  function installWhatsModal(){
    if(document.getElementById("whatsPartsModal"))return;
    const m=document.createElement("div");
    m.id="whatsPartsModal";m.className="modal";
    m.innerHTML='<div class="sheet">'+
      '<div class="row"><h2 style="margin:0">مشاركة واتساب كاملة</h2><button class="btn secondary" onclick="closeModal(\'whatsPartsModal\')">إغلاق</button></div>'+
      '<div class="note info">التقرير طويل، لذلك قُسّم تلقائيًا إلى أجزاء حتى يصل كاملًا بدون قص. أرسل الأجزاء بالترتيب إلى نفس القروب.</div>'+
      '<div id="whatsPartsList" class="miniList"></div>'+
      '</div>';
    document.body.appendChild(m);
    m.addEventListener("click",function(e){if(e.target.id==="whatsPartsModal")closeModal("whatsPartsModal")});
  }

  function splitLongText(text,maxLen){
    const lines=String(text||"").split("\n");
    const parts=[];
    let cur="";
    function push(){
      if(cur.trim())parts.push(cur.trim());
      cur="";
    }
    lines.forEach(function(line){
      if(line.length>maxLen){
        if(cur)push();
        for(let i=0;i<line.length;i+=maxLen)parts.push(line.slice(i,i+maxLen));
        return;
      }
      const candidate=cur?cur+"\n"+line:line;
      if(candidate.length>maxLen){push();cur=line}
      else cur=candidate;
    });
    push();
    return parts;
  }

  function rtlSafe(text){
    return String(text||"").split("\n").map(function(line){return line?"\u200F"+line:line}).join("\n");
  }

  window.shareWhatsPart=async function(index){
    const raw=whatsappParts[index]||"";
    if(!raw)return;
    const text=rtlSafe(raw);
    const btn=document.querySelector('[data-wa-part="'+index+'"]');
    try{
      if(navigator.share){
        await navigator.share({title:"حالات الجراحة العامة",text:text});
        if(btn){btn.textContent="✓ تم إرسال الجزء "+(index+1);btn.className="btn ok"}
      }else{
        await navigator.clipboard.writeText(text);
        if(btn){btn.textContent="✓ تم نسخ الجزء "+(index+1);btn.className="btn ok"}
        toastMsg("تم نسخ الجزء "+(index+1));
      }
    }catch(e){
      if(e&&e.name==="AbortError")return;
      try{await navigator.clipboard.writeText(text);toastMsg("تعذرت المشاركة؛ تم نسخ الجزء "+(index+1))}
      catch(_){prompt("انسخ الجزء "+(index+1)+":",text)}
    }
  };

  window.shareReadinessReport=async function(){
    const report=buildReadinessReport();
    whatsappParts=splitLongText(report,2800);
    if(whatsappParts.length<=1){
      await shareWhatsPart(0);
      return;
    }
    const list=document.getElementById("whatsPartsList");
    list.innerHTML=whatsappParts.map(function(p,i){
      const preview=p.split("\n").slice(0,2).join(" — ");
      return '<div class="mini"><div class="row"><div><b>الجزء '+(i+1)+' من '+whatsappParts.length+'</b><div class="sub">'+esc(preview.slice(0,120))+'</div></div>'+
        '<button class="btn dark" data-wa-part="'+i+'" onclick="shareWhatsPart('+i+')">مشاركة الجزء '+(i+1)+'</button></div></div>';
    }).join("");
    openModal("whatsPartsModal");
  };

  async function loadJsPdf(){
    if(window.jspdf&&window.jspdf.jsPDF)return window.jspdf.jsPDF;
    await new Promise(function(resolve,reject){
      const old=document.getElementById("jspdfLoader");
      if(old){
        if(window.jspdf&&window.jspdf.jsPDF){resolve();return}
        old.addEventListener("load",resolve,{once:true});
        old.addEventListener("error",reject,{once:true});
        return;
      }
      const sc=document.createElement("script");
      sc.id="jspdfLoader";
      sc.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc);
    });
    if(!(window.jspdf&&window.jspdf.jsPDF))throw new Error("jsPDF unavailable");
    return window.jspdf.jsPDF;
  }

  function makeCanvas(){
    const c=document.createElement("canvas");
    c.width=1240;c.height=1754;
    const x=c.getContext("2d");
    x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
    x.direction="rtl";x.textAlign="right";x.textBaseline="top";
    return {canvas:c,ctx:x};
  }

  function wrapLine(ctx,text,maxWidth){
    const raw=String(text==null?"":text);
    if(!raw)return [""];
    const words=raw.split(/\s+/);
    const lines=[];let line="";
    words.forEach(function(w){
      const t=line?line+" "+w:w;
      if(line&&ctx.measureText(t).width>maxWidth){lines.push(line);line=w}
      else line=t;
    });
    if(line)lines.push(line);
    return lines.length?lines:[""];
  }

  function buildPdfPages(){
    const W=1240,H=1754,M=75,MAX=W-M*2;
    const pages=[];let page=makeCanvas(),ctx=page.ctx,y=70;
    pages.push(page.canvas);

    function newPage(){
      page=makeCanvas();ctx=page.ctx;y=70;pages.push(page.canvas);
    }
    function need(h){if(y+h>H-85)newPage()}
    function line(text,size,weight,color,indent){
      size=size||26;weight=weight||"400";color=color||"#111";indent=indent||0;
      ctx.font=weight+" "+size+"px Arial, Tahoma, sans-serif";
      ctx.fillStyle=color;
      const lines=wrapLine(ctx,text,MAX-indent);
      const lh=Math.round(size*1.48);
      need(lines.length*lh+8);
      lines.forEach(function(t){ctx.fillText(t,W-M-indent,y);y+=lh});
      y+=4;
    }
    function rule(){need(18);ctx.strokeStyle="#d4dde1";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(M,y+5);ctx.lineTo(W-M,y+5);ctx.stroke();y+=18}
    function section(text){
      need(60);ctx.fillStyle="#eaf4f7";ctx.fillRect(M,y,W-M*2,52);
      ctx.font="700 29px Arial, Tahoma, sans-serif";ctx.fillStyle="#0b5266";ctx.fillText(text,W-M-14,y+7);y+=67;
    }

    ctx.font="700 42px Arial, Tahoma, sans-serif";ctx.fillStyle="#0b5266";
    ctx.fillText("حالات الجراحة العامة ونواقص التجهيز",W-M,y);y+=62;
    line(new Date().toLocaleDateString("ar-SA-u-ca-gregory"),23,"400","#555");
    rule();

    const cases=activePatientCases().slice().sort(function(a,b){
      const pa={day:1,elective:2,inpatient:3,minor:4}[a.pathway]||9;
      const pb={day:1,elective:2,inpatient:3,minor:4}[b.pathway]||9;
      return pa-pb||String(a.patientName||"").localeCompare(String(b.patientName||""));
    });
    let last="";
    cases.forEach(function(c){
      if(c.pathway!==last){section(pathLabel(c.pathway));last=c.pathway}
      const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
      need(220);
      line(c.patientName||"—",31,"700","#111");
      line("MRN: "+(c.mrn||"—"),24,"400","#222");
      line("العملية: "+(c.procedure||"—"),24,"400","#222");
      line("المتابعة بواسطة: "+(c.followUpBy||"متاحة"),24,"400",c.consultantPrepared?"#6c4e8a":"#222");
      if(c.consultantPrepared)line("تجهيز الاستشاري - المقيم مساعد فقط",24,"700","#6c4e8a");
      if(d)line("يوم العمليات: "+gregDate(d.date)+" - "+dayKindLabel(d.kind,d)+" - "+(c.dayRole==="reserve"?"احتياط":"أساسي"),23,"400","#222");
      else line("الموقع: Patient Pool",23,"400","#555");
      if(r.key==="ready")line("النواقص: لا يوجد - مكتمل التجهيز",24,"700","#16825b");
      else line("النواقص: "+r.missing.map(function(x){return x.label}).join("، "),24,"700","#9a5b00");
      rule();
    });
    if(!cases.length)line("لا توجد حالات نشطة.",30,"700","#555");

    section("توزيع أيام العمليات - "+monthTitle(document.getElementById("scheduleMonth").value||defaultMonth()));
    const ym=document.getElementById("scheduleMonth").value||defaultMonth();
    const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
    if(days.length){
      days.forEach(function(d){
        line(gregDate(d.date)+" - "+dayKindLabel(d.kind,d),25,"700","#0b5266");
        line("المقيمون: "+(d.residents.length?d.residents.join(" + "):"غير محدد"),23,"400","#222");
        rule();
      });
    }else line("لا توجد أيام عمليات مسجلة لهذا الشهر.",26,"400","#555");

    const balances=activeResidents().filter(function(r){return Number(r.compensation||0)>0});
    if(balances.length){
      section("رصيد التعويض");
      balances.forEach(function(r){line(r.name+": +"+Number(r.compensation||0)+" يوم",24,"700","#8b5800")});
    }

    pages.forEach(function(cv,i){
      const c=cv.getContext("2d");
      c.direction="rtl";c.textAlign="right";c.font="20px Arial, Tahoma, sans-serif";c.fillStyle="#777";
      c.fillText("صفحة "+(i+1)+" من "+pages.length,W-M,H-55);
    });
    return pages;
  }

  window.shareCasesPdf=async function(){
    const btn=document.getElementById("casesPdfBtn");
    if(btn){btn.disabled=true;btn.textContent="جاري إنشاء PDF..."}
    try{
      const jsPDF=await loadJsPdf();
      const pages=buildPdfPages();
      const pdf=new jsPDF({orientation:"portrait",unit:"pt",format:"a4",compress:true});
      pages.forEach(function(cv,i){
        if(i>0)pdf.addPage("a4","portrait");
        const img=cv.toDataURL("image/jpeg",0.91);
        pdf.addImage(img,"JPEG",0,0,595.28,841.89,undefined,"FAST");
      });
      const blob=pdf.output("blob");
      if(!blob||blob.size<10000)throw new Error("PDF too small");
      const filename="Surgery_Cases_Readiness_"+new Date().toISOString().slice(0,10)+".pdf";
      const file=new File([blob],filename,{type:"application/pdf"});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"حالات الجراحة العامة ونواقص التجهيز"});
        toastMsg("تم تجهيز PDF وإرساله للمشاركة");
      }else{
        const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
        toastMsg("تم إنشاء PDF وحفظه في التنزيلات");
      }
    }catch(e){
      console.error(e);
      alert("تعذر إنشاء PDF. افتح التطبيق مع اتصال بالإنترنت ثم حاول مرة أخرى.");
    }finally{
      if(btn){btn.disabled=false;btn.textContent="PDF الحالات والنواقص"}
    }
  };

  installWhatsModal();
})();