const SUPABASE_URL='https://fccvnotgsmxirhztveai.supabase.co';
const SUPABASE_KEY='sb_publishable__bDEEO_UuUc2AZmCNMhQHg_qzjmoSnL';
const H={'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'};
let db={providers:[],staff:[],cases:[]};

function money(n){return (Number(n)||0).toFixed(3)+' د.ك'}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1700)}
function byProvider(id){return db.providers.find(p=>p.id===id)||{name:'غير محدد',services:[],feeType:'percent',feeValue:0}}
function paw(c){return Number(c.pawapp_amount||0)}
function due(c){return Number(c.provider_amount||0)}
function rem(c){return Math.max(0,due(c)-Number(c.providerPaid||0))}
function clientPaidAmt(c){const x=Number(c.clientPaidAmount||0);return x>0?x:(c.client_paid?Number(c.total_amount||0):0)}
function clientRem(c){return Math.max(0,Number(c.total_amount||0)-clientPaidAmt(c))}
function planLabel(c){if(c.client_payment_plan==='installment')return 'أقساط'+(c.installments_count?' ('+c.installments_count+')':'');if(c.client_payment_plan==='later')return 'لاحقًا';return 'دفع كامل'}
function nextInstallment(c){
 const s=(c.schedule||[]).slice().sort((a,b)=>a.installment_no-b.installment_no);
 let paid=clientPaidAmt(c);
 for(const x of s){
   const a=Number(x.amount||0);
   if(paid>=a-0.0001){paid-=a;continue}
   return {...x,remaining_amount:Math.max(0,a-paid)};
 }
 return null;
}
function st(c){if(clientRem(c)>0.0001)return ['العميل لم يكمل السداد','unpaid'];if(rem(c)<=0.0001)return ['مسدد للمقدم','paid'];if(Number(c.providerPaid||0)>0)return ['مسدد جزئي','partial'];return ['مستحق للمقدم','pending']}

async function api(path,opts={}){
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{...opts,headers:{...H,...(opts.headers||{})}});
 if(!r.ok){throw new Error(await r.text())}
 if(r.status===204)return null;
 const txt=await r.text();return txt?JSON.parse(txt):null;
}

async function loadData(){
 try{
  const [employees,providers,services,cases,settlements,clientPayments,installmentSchedule]=await Promise.all([
   api('employees?select=*&order=name.asc'),
   api('providers?select=*&order=created_at.asc'),
   api('services?select=*&order=created_at.asc'),
   api('cases?select=*&order=created_at.asc'),
   api('settlements?select=*&order=created_at.asc'),
   api('client_payments?select=*&order=created_at.asc'),
   api('installment_schedule?select=*&order=due_date.asc')
  ]);
  db.staff=employees||[];
  db.providers=(providers||[]).map(p=>({
   ...p,
   type:p.provider_type,
   feeType:p.default_fee_type||'percent',
   feeValue:Number(p.default_fee_value||0),
   services:(services||[]).filter(s=>s.provider_id===p.id).map(s=>s.name)
  }));
  db.cases=(cases||[]).map(c=>({
   ...c,
   providerId:c.provider_id,
   service:c.service_name,
   amount:Number(c.total_amount||0),
   staff:(employees||[]).find(e=>e.id===c.employee_id)?.name||'',
   providerPaid:(settlements||[]).filter(s=>Number(s.case_id)===Number(c.id)).reduce((a,s)=>a+Number(s.amount||0),0),
   clientPaidAmount:(clientPayments||[]).filter(s=>Number(s.case_id)===Number(c.id)).reduce((a,s)=>a+Number(s.amount||0),0),
   schedule:(installmentSchedule||[]).filter(s=>Number(s.case_id)===Number(c.id))
  }));
  renderAll();
 }catch(e){console.error(e);alert('تعذر تحميل البيانات المشتركة. جربي تحديث الصفحة.')}
}

function showPage(id){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 document.getElementById(id).classList.add('active');
 document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.getAttribute('data-p')===id));
 window.scrollTo(0,0);
}
function openNewCase(){showPage('newcase');fillProviders();fillStaff();document.getElementById('cDate').value=new Date().toISOString().slice(0,10)}

function renderDashboard(){
 let sales=0,p=0,d=0,paid=0;
 let clientDue=0,clientPaid=0,clientRemain=0;
 db.cases.forEach(c=>{sales+=c.amount;p+=paw(c);d+=due(c);paid+=Number(c.providerPaid||0);clientDue+=Number(c.total_amount||0);clientPaid+=clientPaidAmt(c);clientRemain+=clientRem(c)});
 document.getElementById('kSales').textContent=money(sales);
 document.getElementById('kPaw').textContent=money(p);
 document.getElementById('kDue').textContent=money(d);
 document.getElementById('kPaid').textContent=money(paid);
 document.getElementById('kRemain').textContent=money(Math.max(0,d-paid));
 document.getElementById('kClientDue').textContent=money(clientDue);
 document.getElementById('kClientPaid').textContent=money(clientPaid);
 document.getElementById('kClientRemain').textContent=money(clientRemain);
 let upcoming=[];
 db.cases.forEach(c=>{const n=nextInstallment(c);if(n)upcoming.push({client:c.client_name,date:n.due_date,amount:n.remaining_amount,caseId:c.id})});
 upcoming.sort((a,b)=>a.date.localeCompare(b.date));
 document.getElementById('upcomingInstallments').innerHTML=upcoming.slice(0,6).map(x=>'<div class="card provider"><h3>'+esc(x.client)+'</h3><p>PAW-'+String(x.caseId).padStart(4,'0')+'</p><div class="miniGrid"><div class="mini"><span>المبلغ</span><b>'+money(x.amount)+'</b></div><div class="mini"><span>الاستحقاق</span><b>'+x.date+'</b></div><div class="mini"><span>الحالة</span><b>قادم</b></div></div></div>').join('')||'<div class="card">ما في أقساط قادمة.</div>';
 const pf=document.getElementById('dashboardProviderFilter')?.value||'all';
 let ph='';
 db.providers.forEach(pr=>{
  if(pf!=='all'&&pr.id!==pf)return;
  const cs=db.cases.filter(x=>x.providerId===pr.id); if(!cs.length)return;
  let du=0,rm=0;cs.forEach(x=>{du+=due(x);rm+=rem(x)});
  ph+=`<div class="card provider"><h3>${esc(pr.name)}</h3><div class="miniGrid"><div class="mini"><span>العمليات</span><b>${cs.length}</b></div><div class="mini"><span>مستحق له</span><b>${money(du)}</b></div><div class="mini"><span>متبقي علينا</span><b class="${rm>0?'red':'green'}">${money(rm)}</b></div></div><div class="actions"><button class="btn soft" onclick="providerCases('${pr.id}')">التفاصيل</button><button class="btn soft" onclick="exportProviderReport('${pr.id}')">تقرير</button></div></div>`;
 });
 document.getElementById('dashboardProviders').innerHTML=ph||'<div class="card">ما في عمليات مسجلة للحين.</div>';
 let h='';
 db.cases.slice().reverse().slice(0,6).forEach(c=>{
  const pr=byProvider(c.providerId),s=st(c);
  h+=`<tr><td>PAW-${String(c.id).padStart(4,'0')}</td><td>${esc(c.client_name)}</td><td>${esc(pr.name)}</td><td>${esc(c.service)}</td><td>${money(c.amount)}</td><td>${money(paw(c))}</td><td>${esc(c.staff)}</td><td><span class="status ${s[1]}">${s[0]}</span></td></tr>`;
 });
 document.getElementById('recent').innerHTML=h||'<tr><td colspan="8">لا توجد عمليات</td></tr>';
}

function renderProviders(){
 const q=(document.getElementById('providerSearch').value||'').toLowerCase();let h='';
 db.providers.filter(p=>!q||p.name.toLowerCase().includes(q)).forEach(p=>{
  const cs=db.cases.filter(c=>c.providerId===p.id);let sales=0,r=0;cs.forEach(c=>{sales+=c.amount;r+=rem(c)});
  const typ=p.type==='freelancer'?'Freelancer':(p.category==='veterinary'?'Company - Veterinary':'Company - Services');
  const feeTxt=p.feeType==='fixed'?money(p.feeValue)+' ثابت':p.feeValue+'%';
  h+=`<div class="card provider"><h3>${esc(p.name)}</h3><p>${typ} • ${feeTxt}</p><p>${esc(p.services.join('، '))}</p><div class="miniGrid"><div class="mini"><span>العمليات</span><b>${cs.length}</b></div><div class="mini"><span>الإجمالي</span><b>${money(sales)}</b></div><div class="mini"><span>متبقي</span><b>${money(r)}</b></div></div><div class="actions"><button class="btn soft" onclick="providerCases('${p.id}')">العمليات</button><button class="btn soft" onclick="exportProviderReport('${p.id}')">تقرير</button><button class="btn danger" onclick="deleteProvider('${p.id}')">حذف</button></div></div>`;
 });
 document.getElementById('providerList').innerHTML=h||'<div class="card">لا توجد نتائج</div>';
}

function renderCases(){
 const q=(document.getElementById('caseSearch').value||'').toLowerCase();
 const sf=document.getElementById('caseStatusFilter')?.value||'all';
 const pf=document.getElementById('caseProviderFilter')?.value||'all';
 let h='';
 db.cases.slice().reverse().forEach(c=>{
  const pr=byProvider(c.providerId),hay=['PAW-'+String(c.id).padStart(4,'0'),c.client_name,c.client_phone,c.staff,pr.name,c.service].join(' ').toLowerCase(),s=st(c);
  if(q&&!hay.includes(q))return;if(sf!=='all'&&s[1]!==sf)return;if(pf!=='all'&&c.providerId!==pf)return;
  const ni=nextInstallment(c);h+=`<tr><td>PAW-${String(c.id).padStart(4,'0')}</td><td>${c.service_date}</td><td>${esc(c.client_name)}</td><td>${planLabel(c)}${c.client_payment_note?'<br><span class="hint">'+esc(c.client_payment_note)+'</span>':''}</td><td>${money(clientPaidAmt(c))}</td><td>${money(clientRem(c))}</td><td>${ni?money(ni.remaining_amount)+'<br><span class="hint">'+ni.due_date+'</span>':'—'}</td><td>${esc(pr.name)}</td><td>${esc(c.service)}</td><td>${money(c.amount)}</td><td>${money(paw(c))}</td><td>${money(due(c))}</td><td>${money(c.providerPaid||0)}</td><td>${money(rem(c))}</td><td>${esc(c.staff)}</td><td><span class="status ${s[1]}">${s[0]}</span></td><td><button class="btn soft" style="padding:7px" onclick="openClientPayment('${c.id}')">دفعة عميل</button></td><td><button class="btn soft" style="padding:7px" onclick="openSettlement('${c.id}')">دفعة للمقدم</button></td></tr>`;
 });
 document.getElementById('caseRows').innerHTML=h||'<tr><td colspan="13">لا توجد عمليات</td></tr>';
}

function fillProviders(){
 const s=document.getElementById('cProvider');s.innerHTML='<option value="">اختاري مقدم الخدمة</option>';db.providers.forEach(p=>s.innerHTML+=`<option value="${p.id}">${esc(p.name)}</option>`);providerChanged();
 const f=document.getElementById('caseProviderFilter');if(f){const keep=f.value;f.innerHTML='<option value="all">كل مقدمي الخدمة</option>';db.providers.forEach(p=>f.innerHTML+=`<option value="${p.id}">${esc(p.name)}</option>`);if([...f.options].some(o=>o.value===keep))f.value=keep}
 const d=document.getElementById('dashboardProviderFilter');if(d){const keep=d.value;d.innerHTML='<option value="all">كل مقدمي الخدمة</option>';db.providers.forEach(p=>d.innerHTML+=`<option value="${p.id}">${esc(p.name)}</option>`);if([...d.options].some(o=>o.value===keep))d.value=keep}
}
function fillStaff(){const s=document.getElementById('cStaff');if(!s)return;s.innerHTML='<option value="">اختاري الموظف المسؤول</option>';db.staff.forEach(e=>s.innerHTML+=`<option value="${e.id}">${esc(e.name)}</option>`)}
function renderStaff(){let h='';db.staff.forEach(e=>h+=`<div class="card provider"><h3>${esc(e.name)}</h3><p>موظف PawApp / مسؤول عن تسجيل الطلبات</p><div class="actions"><button class="btn danger" onclick="deleteStaff('${e.id}')">حذف</button></div></div>`);document.getElementById('staffList').innerHTML=h||'<div class="card">ما في موظفين مسجلين.</div>'}

function openStaff(){document.getElementById('staffModal').classList.add('show')}
async function saveStaff(){
 const n=document.getElementById('staffName').value.trim();if(!n){alert('اكتبي اسم الموظف');return}
 try{await api('employees',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({name:n})});document.getElementById('staffName').value='';closeModal('staffModal');await loadData();toast('تمت إضافة الموظف')}catch(e){alert('تعذر إضافة الموظف، يمكن الاسم موجود من قبل.')}
}
async function deleteStaff(id){if(db.cases.some(c=>c.employee_id===id)){alert('ما نقدر نحذف الموظف لأن عنده عمليات مسجلة.');return}if(confirm('حذف الموظف؟')){await api('employees?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await loadData()}}

function providerChanged(){
 const p=byProvider(document.getElementById('cProvider').value),s=document.getElementById('cService');
 s.innerHTML='<option value="">اختاري الخدمة</option>';p.services.forEach(x=>s.innerHTML+=`<option>${esc(x)}</option>`);
 document.getElementById('cFeeType').value=p.feeType||'percent';
 document.getElementById('cCommission').value=p.feeValue||0;toggleCasePricing();
}
function toggleCasePricing(){
 const t=document.getElementById('cFeeType').value;
 document.getElementById('cAmountLabel').textContent=t==='fixed'?'سعر مقدم الخدمة قبل رسوم PawApp (د.ك) *':'إجمالي ما يدفعه العميل (د.ك) *';
 document.getElementById('cCommissionLabel').textContent=t==='fixed'?'رسوم PawApp الثابتة (د.ك) *':'نسبة PawApp % *';
 calcCase();
}
function toggleProviderPricing(){const t=document.getElementById('pFeeType').value;document.getElementById('pCommissionLabel').textContent=t==='fixed'?'رسوم PawApp الافتراضية الثابتة (د.ك)':'نسبة PawApp الافتراضية %'}
function calcCase(){
 const base=Number(document.getElementById('cAmount').value||0),v=Number(document.getElementById('cCommission').value||0),t=document.getElementById('cFeeType').value;
 let total,pw,du;if(t==='fixed'){du=base;pw=v;total=base+pw}else{total=base;pw=total*v/100;du=total-pw}
 document.getElementById('calcTotal').textContent=money(total);document.getElementById('calcPaw').textContent=money(pw);document.getElementById('calcDue').textContent=money(du);document.getElementById('calcRemain').textContent=money(du);
}

function togglePaymentPlan(){
 const on=document.getElementById('cPaymentPlan').value==='installment';
 document.getElementById('installmentsWrap').style.display=on?'flex':'none';
 document.getElementById('installmentScheduleWrap').style.display=on?'flex':'none';
 const paidSel=document.getElementById('cClientPaid');
 if(on){paidSel.value='unpaid';paidSel.disabled=true;buildInstallmentRows()}else{paidSel.disabled=false;document.getElementById('installmentRows').innerHTML=''}
}
function buildInstallmentRows(){
 const n=Math.max(0,Number(document.getElementById('cInstallments').value||0));
 const wrap=document.getElementById('installmentRows'); if(!wrap)return;
 const old=[...wrap.querySelectorAll('.installmentRow')].map(r=>({amount:r.querySelector('.instAmount')?.value||'',date:r.querySelector('.instDate')?.value||''}));
 wrap.innerHTML='';
 for(let i=0;i<n;i++){
   const d=document.createElement('div');d.className='grid2 installmentRow';d.style.marginTop='8px';
   d.innerHTML='<div class="field"><label>القسط '+(i+1)+' - المبلغ</label><input class="instAmount" type="number" min="0" step="0.001" placeholder="0.000" value="'+(old[i]?.amount||'')+'"></div><div class="field"><label>تاريخ الاستحقاق</label><input class="instDate" type="date" value="'+(old[i]?.date||'')+'"></div>';
   wrap.appendChild(d);
 }
}
async function saveCase(){
 const client=document.getElementById('cClient').value.trim(),employeeId=document.getElementById('cStaff').value,providerId=document.getElementById('cProvider').value,service=document.getElementById('cService').value,base=Number(document.getElementById('cAmount').value||0),feeType=document.getElementById('cFeeType').value,feeValue=Number(document.getElementById('cCommission').value||0),paymentPlan=document.getElementById('cPaymentPlan').value,installments=paymentPlan==='installment'?Number(document.getElementById('cInstallments').value||0):null,paymentNote=document.getElementById('cPaymentNote').value.trim();
 if(!client||!employeeId||!providerId||!service||base<=0){alert('كملي اسم العميل، الموظف، مقدم الخدمة، الخدمة والمبلغ.');return}
 const total=feeType==='fixed'?base+feeValue:base,pw=feeType==='fixed'?feeValue:total*feeValue/100,providerAmount=total-pw;
 let schedule=[];
 if(paymentPlan==='installment'){
   const rows=[...document.querySelectorAll('.installmentRow')];
   if(!rows.length){alert('حددي عدد الأقساط وجدولها');return}
   schedule=rows.map((r,i)=>({installment_no:i+1,amount:Number(r.querySelector('.instAmount').value||0),due_date:r.querySelector('.instDate').value}));
   if(schedule.some(x=>x.amount<=0||!x.due_date)){alert('كملي مبلغ وتاريخ كل قسط');return}
   const sum=schedule.reduce((a,x)=>a+x.amount,0);
   if(Math.abs(sum-total)>0.001){alert('مجموع الأقساط لازم يساوي إجمالي العميل '+money(total));return}
 }
 try{
  const inserted=await api('cases',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({service_date:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),client_name:client,client_phone:document.getElementById('cPhone').value.trim(),employee_id:employeeId,provider_id:providerId,service_name:service,fee_type:feeType,fee_value:feeValue,total_amount:total,pawapp_amount:pw,provider_amount:providerAmount,client_paid:false,payment_method:document.getElementById('cPayMethod').value,client_payment_plan:paymentPlan,installments_count:installments||null,client_payment_note:paymentNote||null,notes:document.getElementById('cNotes').value.trim()})});
  if(paymentPlan==='installment' && schedule.length){
    await api('installment_schedule',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(schedule.map(x=>({...x,case_id:inserted[0].id})))});
  }
  if(document.getElementById('cClientPaid').value==='paid' && paymentPlan==='full'){
    await api('client_payments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({case_id:inserted[0].id,amount:total,paid_at:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),method:document.getElementById('cPayMethod').value,note:paymentNote||null})});
    await api('cases?id=eq.'+encodeURIComponent(inserted[0].id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({client_paid:true})});
  }
  ['cClient','cPhone','cAmount','cNotes','cPaymentNote','cInstallments'].forEach(id=>document.getElementById(id).value='');document.getElementById('installmentRows').innerHTML='';document.getElementById('cStaff').value='';document.getElementById('cProvider').value='';
  await loadData();showPage('cases');toast('تم حفظ العميل والعملية');
 }catch(e){console.error(e);alert('تعذر حفظ العملية')}
}

function openProvider(){document.getElementById('providerModal').classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function typeChanged(){document.getElementById('pCatWrap').style.display=document.getElementById('pType').value==='company'?'flex':'none'}
async function saveProvider(){
 const name=document.getElementById('pName').value.trim();if(!name){alert('اكتبي اسم مقدم الخدمة');return}
 const sv=document.getElementById('pServices').value.split(',').map(x=>x.trim()).filter(Boolean);if(!sv.length){alert('أضيفي خدمة واحدة على الأقل');return}
 const ft=document.getElementById('pFeeType').value,fv=Number(document.getElementById('pCommission').value||0);
 try{
  const r=await api('providers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,provider_type:document.getElementById('pType').value,category:document.getElementById('pType').value==='company'?document.getElementById('pCategory').value:null,phone:document.getElementById('pPhone').value.trim(),default_fee_type:ft,default_fee_value:fv})});
  const pid=r[0].id;
  await api('services',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(sv.map(x=>({provider_id:pid,name:x})))});
  ['pName','pPhone','pServices'].forEach(id=>document.getElementById(id).value='');closeModal('providerModal');await loadData();toast('تمت إضافة مقدم الخدمة');
 }catch(e){console.error(e);alert('تعذر إضافة مقدم الخدمة')}
}
async function deleteProvider(id){if(db.cases.some(c=>c.providerId===id)){alert('ما نقدر نحذفه لأن عنده عمليات مسجلة.');return}if(confirm('حذف مقدم الخدمة؟')){await api('providers?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await loadData()}}

function providerCases(id){showPage('cases');document.getElementById('caseSearch').value='';document.getElementById('caseProviderFilter').value=id;renderCases()}
function exportProviderReport(id){
 const p=byProvider(id),rows=db.cases.filter(c=>c.providerId===id);if(!rows.length){alert('ما في عمليات لهذا المقدم');return}
 let csv='Case ID,Date,Client,Phone,Service,Amount KD,PawApp KD,Provider Due KD,Paid to Provider KD,Remaining KD,Staff,Status\n';
 rows.forEach(c=>{const s=st(c);csv+=[c.id,c.service_date,c.client_name,c.client_phone||'',c.service,c.amount.toFixed(3),paw(c).toFixed(3),due(c).toFixed(3),Number(c.providerPaid||0).toFixed(3),rem(c).toFixed(3),c.staff,s[0]].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')+'\n'});
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=('PawApp-'+p.name+'-report.csv').replace(/\s+/g,'-');document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function openClientPayment(id){
 const x=db.cases.find(v=>String(v.id)===String(id));if(!x)return;
 if(clientRem(x)<=0.0001){alert('العميل مسدد بالكامل');return}
 document.getElementById('cpCase').value=id;
 document.getElementById('cpAmount').value=clientRem(x).toFixed(3);
 document.getElementById('cpDate').value=new Date().toISOString().slice(0,10);
 document.getElementById('cpMethod').value=x.payment_method||'KNET';
 document.getElementById('cpNote').value='';
 document.getElementById('cpSummary').textContent='الإجمالي '+money(x.total_amount)+' — المدفوع '+money(clientPaidAmt(x))+' — المتبقي '+money(clientRem(x));
 document.getElementById('clientPayModal').classList.add('show');
}
let clientPaymentSaving=false;
async function saveClientPayment(){
 if(clientPaymentSaving)return;
 const id=document.getElementById('cpCase').value,x=db.cases.find(v=>String(v.id)===String(id)),a=Number(document.getElementById('cpAmount').value||0);
 if(!x||a<=0){alert('أدخلي مبلغ صحيح');return}
 if(a>clientRem(x)+0.0001){alert('المبلغ أكبر من المتبقي على العميل');return}
 try{
  clientPaymentSaving=true;
  await api('client_payments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({case_id:Number(id),amount:a,paid_at:document.getElementById('cpDate').value,method:document.getElementById('cpMethod').value,note:document.getElementById('cpNote').value.trim()||null})});
  const newPaid=clientPaidAmt(x)+a;
  await api('cases?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({client_paid:newPaid>=Number(x.total_amount)-0.0001,payment_method:document.getElementById('cpMethod').value})});
  closeModal('clientPayModal');await loadData();toast('تم تسجيل دفعة العميل');
 }catch(e){console.error(e);alert('تعذر تسجيل دفعة العميل')}finally{clientPaymentSaving=false}
}
function openSettlement(id){
 const c=db.cases.find(x=>String(x.id)===String(id));if(!c)return;
 if(rem(c)<=0.0001){alert('مستحق مقدم الخدمة مسدد بالكامل');return}
 document.getElementById('sCase').value=id;document.getElementById('sAmount').value=rem(c).toFixed(3);document.getElementById('sDate').value=new Date().toISOString().slice(0,10);document.getElementById('settleModal').classList.add('show');
}
async function saveSettlement(){
 const id=document.getElementById('sCase').value,c=db.cases.find(x=>String(x.id)===String(id)),a=Number(document.getElementById('sAmount').value||0);
 if(!c||a<=0){alert('أدخلي مبلغ صحيح');return}if(a>rem(c)+0.0001){alert('المبلغ أكبر من المتبقي للمقدم');return}
 try{await api('settlements',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({case_id:Number(id),amount:a,paid_at:document.getElementById('sDate').value,reference:document.getElementById('sRef').value.trim(),method:document.getElementById('sMethod').value})});document.getElementById('sRef').value='';closeModal('settleModal');await loadData();toast('تم تسجيل الدفعة')}catch(e){alert('تعذر تسجيل الدفعة')}
}

function renderAll(){renderDashboard();renderProviders();renderStaff();renderCases();fillProviders();fillStaff()}
document.getElementById('cDate').value=new Date().toISOString().slice(0,10);
togglePaymentPlan();
loadData();
