function renderDashboard(){
  const classes=getClasses();
  const selected=getSelectedClass();
  const stats=activeRosterStats(selected);
  const mapping={classCount:classes.length,studentCount:totalStudentCount(),drawCount:drawsToday(),activeClass:selected?.name||'—',activePresent:stats.present,activeTotal:stats.all};
  for(const[id,value]of Object.entries(mapping))$$(`[data-stat="${id}"]`).forEach(node=>node.textContent=value);
  const panel=$('#activeClassPanel');
  if(!panel)return;
  if(!selected){
    panel.innerHTML=`<div><span>ZAČÍNÁME</span><h3>Vytvořte první třídu</h3><p>Zkopírujte seznam školních e-mailů z IS. SORTIO z něj připraví jména ke kontrole.</p></div><button class="primary-button compact" data-action="open-import">Importovat z IS</button>`;
    return;
  }
  panel.replaceChildren();
  const info=document.createElement('div'),eyebrow=document.createElement('span'),heading=document.createElement('h3'),meta=document.createElement('p');
  eyebrow.textContent='AKTIVNÍ TŘÍDA';heading.textContent=selected.name;meta.textContent=`${selected.schoolYear||'Školní rok není uveden'} · ${stats.present} přítomných z ${stats.all}`;info.append(eyebrow,heading,meta);
  const actions=document.createElement('div');actions.className='active-class-actions';
  const label=document.createElement('label');label.className='dashboard-class-picker';const labelText=document.createElement('span');labelText.textContent='Změnit třídu';
  const select=document.createElement('select');select.id='dashboardClassSelect';select.setAttribute('aria-label','Zvolit aktivní třídu');
  for(const item of classes){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.selected=item.id===selected.id;select.append(option)}
  label.append(labelText,select);
  const attendance=document.createElement('button');attendance.className='small-button';attendance.dataset.route='classes';attendance.textContent='Docházka';
  const draw=document.createElement('button');draw.className='primary-button compact';draw.dataset.route='draw';draw.textContent='Losovat';
  actions.append(label,attendance,draw);panel.append(info,actions);
}
