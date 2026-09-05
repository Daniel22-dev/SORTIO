(async()=>{
  const card=document.getElementById('pollCard');const id=new URL(location.href).searchParams.get('id')||'';
  const safeText=value=>String(value??'');
  const showError=msg=>{const h=document.createElement('h1');h.textContent='Hlasování není dostupné';const p=document.createElement('p');p.className='error';p.textContent=msg;card.replaceChildren(h,p)};
  if(!/^[A-Za-z0-9._:-]{8,120}$/.test(id)){showError('QR kód neobsahuje platné hlasování.');return}
  try{
    const cfgRes=await fetch('../config/deployment.json',{cache:'no-store',credentials:'same-origin'});const cfg=cfgRes.ok?await cfgRes.json():{};if(!cfg.apiBaseUrl)throw new Error('Školní server není připojen.');
    const base=new URL(cfg.apiBaseUrl,location.href);const endpoint=name=>new URL(`sortio/polls/${encodeURIComponent(id)}${name}`,base);
    const metaRes=await fetch(endpoint(''),{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});if(!metaRes.ok)throw new Error('Hlasování už neexistuje nebo vypršelo.');const poll=await metaRes.json();
    const h=document.createElement('h1');h.textContent=safeText(poll.question||'Hlasování');card.replaceChildren(h);
    if(poll.status!=='open'){const p=document.createElement('p');p.textContent='Toto hlasování je ukončené.';card.append(p);return}
    const list=document.createElement('div');list.className='options';for(const option of Array.isArray(poll.options)?poll.options.slice(0,5):[]){const button=document.createElement('button');button.type='button';button.textContent=safeText(option.label);button.addEventListener('click',async()=>{for(const b of list.querySelectorAll('button'))b.disabled=true;try{const res=await fetch(endpoint('/votes'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({optionId:String(option.id||'')})});if(!res.ok)throw new Error();const success=document.createElement('div');success.className='success';const mark=document.createElement('b');mark.textContent='✓';const title=document.createElement('h1');title.textContent='Hlas odeslán';const note=document.createElement('p');note.textContent='Výsledek uvidíte na projekci.';success.append(mark,title,note);card.replaceChildren(success)}catch(_){for(const b of list.querySelectorAll('button'))b.disabled=false;const p=document.createElement('p');p.className='error';p.textContent='Hlas se nepodařilo odeslat. Zkuste to znovu.';list.append(p)}});list.append(button)}card.append(list);
  }catch(error){showError(error?.message||'Hlasování se nepodařilo načíst.')}
})();
