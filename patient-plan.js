/* Shared snapshot codec and safe patient-facing rendering. No patient identity is shared. */
(function(){
'use strict';
const labels={blood:'تحاليل الدم',virology:'تحاليل الفيروسات',cxr:'أشعة الصدر',ecg:'تخطيط القلب',consult:'الاستشارات المطلوبة',anesthesia:'عيادة التخدير',documents:'استكمال وتوقيع الأوراق'};
const templates={
 blood:['المختبر','تُجرى قبل موعد التخدير بأسبوع.'],
 virology:['المختبر','تُجرى قبل موعد التخدير بأسبوع.'],
 cxr:['أشعة العيادات، الدور الأرضي','تُجرى قبل موعد التخدير.'],
 ecg:['عيادة القلب','لا توجد متطلبات.'],
 consult:['الاستقبال','لا توجد متطلبات.'],
 anesthesia:['الاستقبال',''],
 documents:['الاستقبال','بعد موعد التخدير.']
};
function defaults(checklist,previous=[]){
 const required=k=>!!(checklist[k]&&checklist[k].required);
 const keys=Object.keys(labels).filter(required);
 const saved=Array.isArray(previous)?previous:[];
 const order=saved.map(r=>r.key||Object.keys(labels).find(k=>labels[k]===r.title)).filter((k,i,a)=>keys.includes(k)&&a.indexOf(k)===i);
 keys.forEach(k=>{if(!order.includes(k))order.push(k);});
 const prerequisites=[];
 if(required('consult'))prerequisites.push('استكمال مواعيد الاستشارات قبل موعد التخدير.');
 const labs=[required('blood')?'تحاليل الدم':'',required('virology')?'تحاليل الفيروسات':''].filter(Boolean);
 if(labs.length)prerequisites.push('إجراء '+labs.join(' و')+' قبل موعد التخدير بأسبوع.');
 if(required('cxr'))prerequisites.push('إجراء أشعة الصدر قبل موعد التخدير.');
 if(required('ecg'))prerequisites.push('إجراء تخطيط القلب قبل موعد التخدير.');
 return order.map(k=>({key:k,title:labels[k],place:templates[k][0],requirements:k==='anesthesia'?(prerequisites.join('\n')||'لا توجد متطلبات إضافية محددة للمريض.'):templates[k][1]}));
}
function clean(rows){if(!Array.isArray(rows)||rows.length>20)throw Error('عدد المواعيد غير صالح');return rows.map(r=>{if(!r||typeof r!=='object')throw Error('موعد غير صالح');const o={};for(const [k,n] of Object.entries({key:40,title:100,place:160,requirements:800})){o[k]=String(r[k]||'').slice(0,n);}if(!o.title.trim())throw Error('أدخل اسم كل موعد أو احذف السطر الفارغ');return o;});}
async function encode(rows){const bytes=new TextEncoder().encode(JSON.stringify({v:1,rows:clean(rows)}));let data=bytes,prefix='b';if(typeof CompressionStream!=='undefined'){data=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());prefix='z';}return prefix+btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function decode(hash){if(hash.length>18000)throw Error('الرابط طويل أو غير صالح');const raw=hash.slice(1).replace(/-/g,'+').replace(/_/g,'/');let bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));if(hash[0]==='z'){if(typeof DecompressionStream==='undefined')throw Error('يرجى فتح الرابط بمتصفح حديث');bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}else if(hash[0]!=='b')throw Error('رابط غير صالح');if(bytes.length>80000)throw Error('بيانات غير صالحة');const p=JSON.parse(new TextDecoder().decode(bytes));if(p.v!==1)throw Error('إصدار غير صالح');p.rows=clean(p.rows);return p;}
function render(container,rows){container.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='لا توجد مواعيد مدرجة. راجع الفريق المعالج لتأكيد المطلوب.';container.append(p);return;}rows.forEach((r,i)=>{const card=document.createElement('article');card.className='plan-step';const title=document.createElement('h3');title.textContent=(i+1).toLocaleString('ar-SA')+' — '+r.title;card.append(title);for(const text of ['مكان التسجيل: '+(r.place||'راجع الجهة المعالجة'),'المتطلبات: '+(r.requirements||'لم تُحدد؛ استفسر من الفريق المعالج قبل الموعد')]){const p=document.createElement('p');p.textContent=text;card.append(p);}container.append(card);});}
window.PatientPlan={defaults,clean,encode,decode,render};
})();
