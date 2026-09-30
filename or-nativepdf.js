// Direct-download PDF flow using pdf-lib. No preview, no share sheet.
(function(){
  async function loadPdfLib(){
    if(window.PDFLib&&window.PDFLib.PDFDocument)return window.PDFLib;
    await new Promise(function(resolve,reject){
      let sc=document.getElementById("pdfLibLoader");
      if(sc){
        if(window.PDFLib&&window.PDFLib.PDFDocument){resolve();return}
        sc.addEventListener("load",resolve,{once:true});
        sc.addEventListener("error",reject,{once:true});
        return;
      }
      sc=document.createElement("script");
      sc.id="pdfLibLoader";
      sc.src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      sc.onload=resolve;
      sc.onerror=reject;
      document.head.appendChild(sc);
    });
    if(!(window.PDFLib&&window.PDFLib.PDFDocument))throw new Error("pdf-lib unavailable");
    return window.PDFLib;
  }

  function makeCanvas(){
    const c=document.createElement("canvas");
    c.width=1240;c.height=1754;
    const x=c.getContext("2d");
    x.fillStyle="#ffffff";x.fillRect(0,0,c.width,c.height);
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

  function buildPages(){
    const W=1240,H=1754,M=75,MAX=W-M*2;
    const pages=[];let page=makeCanvas(),ctx=page.ctx,y=70;
    pages.push(page.canvas);

    function newPage(){page=makeCanvas();ctx=page.ctx;y=70;pages.push(page.canvas)}
    function need(h){if(y+h>H-90)newPage()}
    function line(text,size,weight,color,indent){
      size=size||26;weight=weight||"400";color=color||"#111";indent=indent||0;
      ctx.font=weight+" "+size+"px Arial, Tahoma, sans-serif";
      ctx.fillStyle=color;ctx.direction="rtl";ctx.textAlign="right";
      const lines=wrapLine(ctx,text,MAX-indent),lh=Math.round(size*1.5);
      need(lines.length*lh+8);
      lines.forEach(function(t){ctx.fillText(t,W-M-indent,y);y+=lh});
      y+=4;
    }
    function rule(){
      need(18);ctx.strokeStyle="#d5dfe3";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(M,y+5);ctx.lineTo(W-M,y+5);ctx.stroke();y+=18;
    }
    function section(text){
      need(68);ctx.fillStyle="#eaf4f7";ctx.fillRect(M,y,W-M*2,54);
      ctx.font="700 29px Arial, Tahoma, sans-serif";ctx.fillStyle="#0b5266";
      ctx.direction="rtl";ctx.textAlign="right";ctx.fillText(text,W-M-14,y+8);y+=70;
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
      need(235);
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

    const ym=document.getElementById("scheduleMonth").value||defaultMonth();
    section("توزيع أيام العمليات - "+monthTitle(ym));
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
      c.direction="rtl";c.textAlign="right";c.textBaseline="top";
      c.font="20px Arial, Tahoma, sans-serif";c.fillStyle="#777";
      c.fillText("صفحة "+(i+1)+" من "+pages.length,W-M,H-55);
    });
    return pages;
  }

  function nonBlank(canvas){
    const ctx=canvas.getContext("2d");
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let hits=0;
    for(let i=0;i<data.length;i+=3200){
      if(data[i]<245||data[i+1]<245||data[i+2]<245){
        hits++;
        if(hits>15)return true;
      }
    }
    return false;
  }

  function dataUrlBytes(url){
    const b64=(url.split(",")[1]||"");
    const bin=atob(b64);
    const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
    return out;
  }

  function forceDownload(blob,filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=filename;
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},15000);
  }

  window.shareCasesPdf=async function(){
    const btn=document.getElementById("casesPdfBtn");
    if(btn){btn.disabled=true;btn.textContent="جاري تجهيز التحميل..."}
    try{
      const pages=buildPages();
      if(!pages.length||!nonBlank(pages[0]))throw new Error("Rendered report is blank");

      const PDFLib=await loadPdfLib();
      const pdfDoc=await PDFLib.PDFDocument.create();
      pdfDoc.setTitle("Surgery Cases Readiness");
      pdfDoc.setSubject("General Surgery active cases and readiness");
      pdfDoc.setCreator("Surgery OR Days PWA");

      for(const cv of pages){
        const jpgBytes=dataUrlBytes(cv.toDataURL("image/jpeg",0.93));
        const jpg=await pdfDoc.embedJpg(jpgBytes);
        const p=pdfDoc.addPage([595.28,841.89]);
        p.drawImage(jpg,{x:0,y:0,width:595.28,height:841.89});
      }

      const bytes=await pdfDoc.save({useObjectStreams:false,addDefaultPage:false,objectsPerTick:20});
      if(!bytes||bytes.length<12000)throw new Error("PDF too small");
      const blob=new Blob([bytes],{type:"application/pdf"});
      const filename="Surgery_Cases_Readiness_"+new Date().toISOString().slice(0,10)+".pdf";
      forceDownload(blob,filename);
      toastMsg("تم تحميل PDF إلى مجلد التنزيلات");
    }catch(e){
      console.error("PDF download failed",e);
      alert("تعذر تحميل PDF. تأكد من وجود اتصال بالإنترنت ثم حاول مرة أخرى.");
    }finally{
      if(btn){btn.disabled=false;btn.textContent="تحميل PDF الحالات والنواقص"}
    }
  };

  const btn=document.getElementById("casesPdfBtn");
  if(btn)btn.textContent="تحميل PDF الحالات والنواقص";
})();