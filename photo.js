(()=>{
 let pending=null;
 function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();}
 function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
 async function shrink(file){
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=data});
  const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
  return c.toDataURL('image/jpeg',0.76);
 }
 function renderEstimate(x){
  const items=(x.items||[]).map(i=>`<div class="muted">${esc(i.name)} — ${esc(i.portion)} • ${i.calories} kcal • ${i.protein_g}g protein</div>`).join('');
  photoResult.innerHTML=`<strong>${esc(x.name)}</strong><div style="margin-top:4px">About ${x.calories} kcal • ${x.protein_g}g protein</div>${items}<div class="muted" style="margin-top:7px">Confidence: ${esc(x.confidence)}. ${esc(x.note)}</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="photoAddBtn">Add estimate</button><button class="btn secondary" id="photoCancelBtn">Discard</button></div>`;
  document.getElementById('photoAddBtn').onclick=()=>{
   if(!pending)return;
   state[user].food.push({date:todayISO(),name:pending.name||'Photo meal',calories:+pending.calories||0,protein:+pending.protein_g||0,source:'ai-photo-estimate'});
   save();aiResult.textContent=`Photo meal added: ${pending.name} — ${pending.calories} kcal, ${pending.protein_g}g protein. Photo estimates are approximate.`;
   pending=null;photoResult.innerHTML='<span class="muted">Photo estimate added.</span>';photoPreview.removeAttribute('src');photoPreview.style.display='none';
  };
  document.getElementById('photoCancelBtn').onclick=()=>{pending=null;photoResult.innerHTML='<span class="muted">Photo estimate discarded.</span>';photoPreview.removeAttribute('src');photoPreview.style.display='none';};
 }
 ready(()=>{
  const quick=document.querySelector('#today .card:nth-of-type(3)')||document.querySelector('#today .card');
  const aiCard=[...document.querySelectorAll('#today .card')].find(c=>c.textContent.includes('AI quick log'));
  if(!aiCard)return;
  const box=document.createElement('div');box.style.marginTop='12px';box.style.borderTop='1px solid #e5e7eb';box.style.paddingTop='12px';
  box.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn secondary" id="photoFoodBtn">📷 Take food photo</button><span class="muted">AI estimates the visible portion. You confirm before it is logged.</span></div><input id="photoFoodInput" type="file" accept="image/*" capture="environment" style="display:none"><input id="photoNote" placeholder="Optional: e.g. homemade flour tortilla, no sugar" style="width:100%;margin-top:9px;border:1px solid #d1d5db;border-radius:12px;padding:11px"><img id="photoPreview" alt="Food preview" style="display:none;max-width:100%;max-height:260px;border-radius:14px;margin-top:10px"><div id="photoResult" class="airesult muted">Take a clear photo from above when possible.</div>`;
  aiCard.appendChild(box);
  const btn=document.getElementById('photoFoodBtn'),input=document.getElementById('photoFoodInput');
  window.photoResult=document.getElementById('photoResult');window.photoPreview=document.getElementById('photoPreview');
  btn.onclick=()=>input.click();
  input.onchange=async()=>{
   const file=input.files?.[0];if(!file)return;
   btn.disabled=true;photoResult.textContent='Preparing photo…';
   try{
    const image=await shrink(file);photoPreview.src=image;photoPreview.style.display='block';photoResult.textContent='AI is estimating the meal…';
    const r=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,note:document.getElementById('photoNote').value||''})});
    const x=await r.json();if(!r.ok)throw new Error(x.error||'Photo analysis failed');
    if(!x.is_food)throw new Error('The photo was not recognized as food.');
    pending=x;renderEstimate(x);
   }catch(e){photoResult.textContent=`Could not estimate photo: ${e.message}`;}
   finally{btn.disabled=false;input.value='';}
  };
 });
})();
