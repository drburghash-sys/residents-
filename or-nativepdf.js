// Native, dependency-free PDF generator. Builds a real PDF from rendered canvas pages.
(function(){
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
      const test=line?line+" "+w:w;
      if(line&&ctx.measureText(test).width>maxWidth){lines.push(line);line=w}
      else line=test;
    });
    if(line)lines.push(line);
    return lines.length?lines:[""];
  }

  function buildNativePdfPages(){
    const W=1240,H=1754,M=75,MAX=W-M*2;
    const pages=[];
    let page=makeCanvas(),ctx=page.ctx,y=70;
    pages.push(page.canvas);

    function newPage(){
      page=makeCanvas();ctx=page.ctx;y=70;pages.push(page.canvas);
    }
    function need(h){if(y+h>H-90)newPage()}
    function line(text,size,weight,color,indent){
      size=size||26;weight=weight||"400";color=color||"#111111";indent=indent||0;
      ctx.font=weight+" "+size+"px Arial, Tahoma, sans-serif";
      ctx.fillStyle=color;
      ctx.direction="rtl";ctx.textAlign="right";
      const arr=wrapLine(ctx,text,MAX-indent);
      const lh=Math.round(size*1.5);
      need(arr.length*lh+8);
      arr.forEach(function(t){ctx.fillText(t,W-M-indent,y);y+=lh});
      y+=4;
    }
    function rule(){
      need(18);ctx.strokeStyle="#d5dfe3";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(M,y+5);ctx.lineTo(W-M,y+5);ctx.stroke();y+=18;
    }
    function section(text){
      need(68);
      ctx.fillStyle="#eaf4f7";ctx.fillRect(M,y,W-M*2,54);
      ctx.font="700 29px Arial, Tahoma, sans-serif";ctx.fillStyle="#0b5266";
      ctx.direction="rtl";ctx.textAlign="right";ctx.fillText(text,W-M-14,y+8);
      y+=70;
    }

    ctx.font="700 42px Arial, Tahoma, sans-serif";
    ctx.fillStyle="#0b5266";ctx.direction="rtl";ctx.textAlign="right";
    ctx.fillText("حالات الجراحة العامة ونواقص التجهيز",W-M,y);y+=62;
    line(new Date().toLocaleDateString("ar-SA-u-ca-gregory"),23,"400","#555555");
    rule();

    const cases=activePatientCases().slice().sort(function(a,b){
      const pa={day:1,elective:2,inpatient:3,minor:4}[a.pathway]||9;
      const pb={day:1,elective:2,inpatient:3,minor:4}[b.pathway]||9;
      return pa-pb||String(a.patientName||"").localeCompare(String(b.patientName||""));
    });

    let lastPath="";
    cases.forEach(function(c){
      if(c.pathway!==lastPath){section(pathLabel(c.pathway));lastPath=c.pathway}
      const r=readiness(c),d=c.orDayId?getDay(c.orDayId):null;
      need(235);
      line(c.patientName||"—",31,"700","#111111");
      line("MRN: "+(c.mrn||"—"),24,"400","#222222");
      line("العملية: "+(c.procedure||"—"),24,"400","#222222");
      line("المتابعة بواسطة: "+(c.followUpBy||"متاحة"),24,"400",c.consultantPrepared?"#6c4e8a":"#222222");
      if(c.consultantPrepared)line("تجهيز الاستشاري - المقيم مساعد فقط",24,"700","#6c4e8a");
      if(d)line("يوم العمليات: "+gregDate(d.date)+" - "+dayKindLabel(d.kind,d)+" - "+(c.dayRole==="reserve"?"احتياط":"أساسي"),23,"400","#222222");
      else line("الموقع: Patient Pool",23,"400","#555555");
      if(r.key==="ready")line("النواقص: لا يوجد - مكتمل التجهيز",24,"700","#16825b");
      else line("النواقص: "+r.missing.map(function(x){return x.label}).join("، "),24,"700","#9a5b00");
      rule();
    });

    if(!cases.length)line("لا توجد حالات نشطة.",30,"700","#555555");

    const ym=document.getElementById("scheduleMonth").value||defaultMonth();
    section("توزيع أيام العمليات - "+monthTitle(ym));
    const days=state.orDays.filter(function(d){return ymFromDate(d.date)===ym}).sort(function(a,b){return a.date.localeCompare(b.date)});
    if(days.length){
      days.forEach(function(d){
        line(gregDate(d.date)+" - "+dayKindLabel(d.kind,d),25,"700","#0b5266");
        line("المقيمون: "+(d.residents.length?d.residents.join(" + "):"غير محدد"),23,"400","#222222");
        rule();
      });
    }else{
      line("لا توجد أيام عمليات مسجلة لهذا الشهر.",26,"400","#555555");
    }

    const balances=activeResidents().filter(function(r){return Number(r.compensation||0)>0});
    if(balances.length){
      section("رصيد التعويض");
      balances.forEach(function(r){line(r.name+": +"+Number(r.compensation||0)+" يوم",24,"700","#8b5800")});
    }

    pages.forEach(function(cv,i){
      const c=cv.getContext("2d");
      c.direction="rtl";c.textAlign="right";c.textBaseline="top";
      c.font="20px Arial, Tahoma, sans-serif";c.fillStyle="#777777";
      c.fillText("صفحة "+(i+1)+" من "+pages.length,W-M,H-55);
    });
    return pages;
  }

  function ascii(s){return new TextEncoder().encode(s)}
  function joinBytes(parts){
    let len=0;parts.forEach(function(p){len+=p.length});
    const out=new Uint8Array(len);let off=0;
    parts.forEach(function(p){out.set(p,off);off+=p.length});
    return out;
  }
  function jpegBytes(canvas){
    const url=canvas.toDataURL("image/jpeg",0.90);
    const b64=url.split(",")[1]||"";
    const bin=atob(b64);
    const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
    return out;
  }

  function makePdfBlob(canvases){
    const totalObjects=2+canvases.length*3;
    const bodies=new Array(totalObjects+1);
    const pageRefs=[];
    bodies[1]=ascii("<< /Type /Catalog /Pages 2 0 R >>");

    canvases.forEach(function(cv,i){
      const imgObj=3+i*3;
      const contentObj=4+i*3;
      const pageObj=5+i*3;
      pageRefs.push(pageObj+" 0 R");

      const jpg=jpegBytes(cv);
      bodies[imgObj]=joinBytes([
        ascii("<< /Type /XObject /Subtype /Image /Width "+cv.width+" /Height "+cv.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpg.length+" >>\nstream\n"),
        jpg,
        ascii("\nendstream")
      ]);

      const commands="q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
      const cmd=ascii(commands);
      bodies[contentObj]=joinBytes([
        ascii("<< /Length "+cmd.length+" >>\nstream\n"),
        cmd,
        ascii("endstream")
      ]);

      bodies[pageObj]=ascii(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] "+
        "/Resources << /XObject << /Im0 "+imgObj+" 0 R >> >> "+
        "/Contents "+contentObj+" 0 R >>"
      );
    });

    bodies[2]=ascii("<< /Type /Pages /Kids ["+pageRefs.join(" ")+"] /Count "+canvases.length+" >>");

    const header=ascii("%PDF-1.4\n%NativePDF\n");
    const parts=[header];
    const offsets=new Array(totalObjects+1).fill(0);
    let pos=header.length;

    for(let n=1;n<=totalObjects;n++){
      offsets[n]=pos;
      const pre=ascii(n+" 0 obj\n");
      const post=ascii("\nendobj\n");
      parts.push(pre,bodies[n],post);
      pos+=pre.length+bodies[n].length+post.length;
    }

    const xrefPos=pos;
    let xref="xref\n0 "+(totalObjects+1)+"\n";
    xref+="0000000000 65535 f \n";
    for(let n=1;n<=totalObjects;n++){
      xref+=String(offsets[n]).padStart(10,"0")+" 00000 n \n";
    }
    const trailer=
      "trailer\n<< /Size "+(totalObjects+1)+" /Root 1 0 R >>\n"+
      "startxref\n"+xrefPos+"\n%%EOF";
    parts.push(ascii(xref),ascii(trailer));
    return new Blob([joinBytes(parts)],{type:"application/pdf"});
  }

  window.shareCasesPdf=async function(){
    const btn=document.getElementById("casesPdfBtn");
    if(btn){btn.disabled=true;btn.textContent="جاري إنشاء PDF..."}
    try{
      const pages=buildNativePdfPages();
      const blob=makePdfBlob(pages);
      if(!blob||blob.size<12000)throw new Error("PDF output too small: "+(blob?blob.size:0));
      const filename="Surgery_Cases_Readiness_"+new Date().toISOString().slice(0,10)+".pdf";
      const file=new File([blob],filename,{type:"application/pdf"});

      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"حالات الجراحة العامة ونواقص التجهيز"});
        toastMsg("تم إنشاء PDF وفتحت المشاركة");
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(url)},4000);
        toastMsg("تم إنشاء PDF وحفظه في التنزيلات");
      }
    }catch(e){
      console.error("Native PDF error",e);
      alert("تعذر إنشاء PDF على هذا الجهاز. أرسل لي صورة التنبيه إن ظهرت.");
    }finally{
      if(btn){btn.disabled=false;btn.textContent="PDF الحالات والنواقص"}
    }
  };
})();