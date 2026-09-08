const SEATING_SHAPE_ROWS=10;
const SEATING_SHAPE_COLUMNS=16;
let seatingShapePaintState=null;

function seatingTemplateCopy(template){
  if(template==='pairs')return{help:'Přednastaví řady s lavicemi po dvou a mezerami mezi jednotlivými lavicemi. Výsledný tvar můžete libovolně dokreslit nebo ubrat.'};
  if(template==='islands')return{help:'Přednastaví několik skupinových stolů. Každé modré políčko představuje jedno skutečné místo pro žáka.'};
  if(template==='u')return{help:'Přednastaví místa do tvaru U. Jednotlivá místa můžete následně přidat nebo odebrat.'};
  if(template==='custom')return{help:'Vlastní tvar odpovídá přímo vaší učebně. Modrá políčka jsou skutečná místa, prázdná políčka jsou mezery nebo uličky.'};
  return{help:'Přednastaví rovné řady. Výchozí obrazec je pouze rychlý začátek; každou řadu můžete upravit zvlášť.'};
}
function seatingShapeKey(row,column){return`${row}:${column}`}
function seatingShapePresetCells(template='rows'){
  const cells=[];
  const add=(row,column)=>cells.push({row,column});
  if(template==='pairs'){
    for(let row=0;row<5;row++)for(const column of [1,2,4,5,7,8])add(row,column);
    return cells;
  }
  if(template==='islands'){
    for(const rowStart of [0,4,8])for(const columnStart of [2,7])for(let row=rowStart;row<Math.min(SEATING_SHAPE_ROWS,rowStart+2);row++)for(let column=columnStart;column<columnStart+2;column++)add(row,column);
    return cells;
  }
  if(template==='u'){
    for(let column=2;column<=11;column++)add(0,column);
    for(let row=1;row<=6;row++){add(row,2);add(row,11)}
    return cells;
  }
  for(let row=0;row<5;row++)for(let column=2;column<8;column++)add(row,column);
  return cells;
}
function seatingShapeCurrentCells(plan){
  const cells=(plan?.seats||[]).filter(seat=>seat.row>=0&&seat.row<SEATING_SHAPE_ROWS&&seat.column>=0&&seat.column<SEATING_SHAPE_COLUMNS).map(seat=>({row:seat.row,column:seat.column}));
  return cells.length?cells:seatingShapePresetCells(['pairs','islands','u'].includes(plan?.template)?plan.template:'rows');
}
function seatingShapeGridHtml(cells){
  const active=new Set(cells.map(cell=>seatingShapeKey(cell.row,cell.column))),buttons=[];
  for(let row=0;row<SEATING_SHAPE_ROWS;row++)for(let column=0;column<SEATING_SHAPE_COLUMNS;column++){
    const on=active.has(seatingShapeKey(row,column));
    buttons.push(`<button type="button" class="seating-shape-cell ${on?'active':''}" data-seating-shape-cell data-row="${row}" data-column="${column}" aria-pressed="${on?'true':'false'}" title="Řada ${row+1}, pozice ${column+1}"><span></span></button>`);
  }
  return buttons.join('');
}
function seatingShapeReadCells(){return $$('[data-seating-shape-cell].active').map(cell=>({row:Number(cell.dataset.row),column:Number(cell.dataset.column)}))}
function seatingShapeUpdateSummary({markCustom=false}={}){
  const cells=seatingShapeReadCells(),count=cells.length,note=$('#seatingCapacityNote'),counter=$('#seatingShapeCount'),select=$('#seatingTemplate');
  if(counter)counter.textContent=`${count} ${count===1?'místo':count>=2&&count<=4?'místa':'míst'}`;
  if(note)note.textContent=count?`Aktuálně označeno ${count} míst. Každé modré políčko = jedno místo pro žáka.`:'Zatím není označeno žádné místo.';
  if(markCustom&&select){select.value='custom';const help=$('#seatingTemplateHelp');if(help)help.textContent=seatingTemplateCopy('custom').help}
}
function seatingShapeSetCell(cell,active,{markCustom=true}={}){if(!cell)return;cell.classList.toggle('active',active);cell.setAttribute('aria-pressed',active?'true':'false');seatingShapeUpdateSummary({markCustom})}
function seatingShapeSetGrid(cells,{markCustom=false}={}){const active=new Set(cells.map(cell=>seatingShapeKey(cell.row,cell.column)));$$('[data-seating-shape-cell]').forEach(cell=>{const on=active.has(seatingShapeKey(Number(cell.dataset.row),Number(cell.dataset.column)));cell.classList.toggle('active',on);cell.setAttribute('aria-pressed',on?'true':'false')});seatingShapeUpdateSummary({markCustom})}
function updateSeatingTemplateCopy(){const select=$('#seatingTemplate');if(!select)return;const copy=seatingTemplateCopy(select.value),help=$('#seatingTemplateHelp');if(help)help.textContent=copy.help;if(select.value!=='custom')seatingShapeSetGrid(seatingShapePresetCells(select.value),{markCustom:false})}
function bindSeatingTemplateLocal(){const select=$('#seatingTemplate');if(!select)return;select.addEventListener('change',updateSeatingTemplateCopy);seatingShapeUpdateSummary()}

function seatingUiRender(){
  const root=$('#seatingWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Zasedací pořádek','Nejprve importujte nebo vytvořte třídu.');return}
  const plan=classItem.seatingPlan,students=classStudents(classItem),usable=plan.seats.filter(seat=>!seat.blocked).length,capacity=seatingCapacity(plan.template,plan.rows,plan.columns,plan.seats),copy=seatingTemplateCopy(plan.template),shapeCells=seatingShapeCurrentCells(plan),shapeCount=shapeCells.length;
  root.innerHTML=`<div class="seating-layout"><aside class="seating-controls"><div class="assignment-heading"><span>UČEBNA</span><h2>Tvar zasedacího plánu</h2><p>Tabule je v náhledu vždy nahoře. Místo počítání řad a lavic jednoduše označte skutečný tvar učebny.</p></div><label>Rychlý výchozí tvar<select id="seatingTemplate"><option value="rows" ${plan.template==='rows'?'selected':''}>Souvislé řady</option><option value="pairs" ${plan.template==='pairs'?'selected':''}>Dvojmístné lavice s uličkami</option><option value="islands" ${plan.template==='islands'?'selected':''}>Skupinové stoly (ostrůvky)</option><option value="u" ${plan.template==='u'?'selected':''}>Uspořádání do U</option><option value="custom" ${plan.template==='custom'?'selected':''}>Vlastní tvar</option></select></label><p class="seating-template-help" id="seatingTemplateHelp">${escapeHtml(copy.help)}</p><div class="seating-shape-editor"><div class="seating-shape-head"><span>TVAR UČEBNY</span><b id="seatingShapeCount">${shapeCount} míst</b></div><div class="seating-shape-front">TABULE</div><div class="seating-shape-grid" style="--shape-columns:${SEATING_SHAPE_COLUMNS}" aria-label="Editor tvaru učebny">${seatingShapeGridHtml(shapeCells)}</div><small>Kliknutím nebo tažením přes políčka místa přidáváte či odebíráte. Každou řadu lze vytvořit jinak dlouhou.</small></div><div class="seating-capacity-note" id="seatingCapacityNote">Aktuálně označeno ${shapeCount} míst. Každé modré políčko = jedno místo pro žáka.</div><div class="seating-shape-actions"><button class="small-button" data-action="clear-seating-shape">Vyčistit mřížku</button><button class="small-button wide-button" data-action="apply-seating-layout">Použít tvar učebny</button></div><div class="seating-stats"><div><b>${students.filter(s=>s.present).length}</b><span>přítomných</span></div><div><b>${capacity}</b><span>míst</span></div><div><b>${usable}</b><span>použitelných</span></div><div><b>${plan.seats.filter(s=>s.locked).length}</b><span>uzamčeno</span></div></div><div class="seating-action-stack"><button class="primary-button compact" data-action="assign-seating">Rozsadit třídu</button><button class="secondary-button compact" data-action="rotate-seating">Rotovat místa</button><button class="small-button" data-action="clear-seating">Vymazat obsazení</button></div><div class="seating-output-actions"><button class="small-button projection-launch" data-action="project-seating">Promítnout</button><button class="small-button" data-action="download-seating-pdf">Exportovat PDF · A4 naležato</button></div><div class="front-preference-list"><span>POTŘEBUJE SEDĚT VPŘEDU</span>${students.map(student=>`<label><input type="checkbox" data-action="front-preference" data-id="${student.id}" ${student.frontPreference?'checked':''}><span>${escapeHtml(student.displayName)}</span></label>`).join('')}</div><div class="rotation-note"><span>↔</span><p>Pravidla <b>„od sebe“</b> ze skupin se použijí také při rozsazení sousedních míst. Ruční přesun zůstane zachován v projekci i v exportovaném PDF.</p></div></aside><section class="seating-stage"><div class="board"><span>TABULE · PŘEDNÍ ČÁST</span></div>${plan.seats.length?renderSeatMap(plan,classItem):`<article class="empty-groups compact-empty"><span>PRÁZDNÁ UČEBNA</span><h2>Nakreslete tvar učebny</h2><p>V mřížce vlevo označte skutečná místa a potvrďte tvar učebny.</p><button class="primary-button" data-action="apply-seating-layout">Vytvořit zasedací plán</button></article>`}<div class="seating-drag-help">Obsazené místo můžete přetáhnout na jiné volné nebo obsazené místo. Uzamčená místa zůstávají pevná.</div><div class="seating-legend"><span><i class="seat-dot occupied"></i>obsazeno</span><span><i class="seat-dot locked"></i>uzamčeno</span><span><i class="seat-dot blocked"></i>mimo provoz</span></div></section></div>`;
  bindSeatingTemplateLocal();
}
function renderSeatMap(plan,classItem){if(plan.template==='islands'){const islands=[...new Set(plan.seats.map(seat=>seat.island))];return`<div class="seat-map islands-map">${islands.map(island=>`<div class="seat-island"><b>Ostrůvek ${island+1}</b><div>${plan.seats.filter(seat=>seat.island===island).map(seat=>seatControl(seat,classItem)).join('')}</div></div>`).join('')}</div>`}const columns=plan.template==='pairs'?plan.columns*2:plan.template==='custom'?Math.max(...plan.seats.map(seat=>seat.column),0)+1:plan.columns;return`<div class="seat-map template-${plan.template}" style="--seat-columns:${columns}">${plan.seats.map(seat=>seatControl(seat,classItem)).join('')}</div>`}
function seatControl(seat,classItem){const student=classItem.students.find(item=>item.id===seat.studentId);const options=classStudents(classItem,{presentOnly:true}).map(item=>`<option value="${item.id}" ${item.id===seat.studentId?'selected':''}>${escapeHtml(item.displayName)}</option>`).join('');const draggable=Boolean(student&&!seat.blocked&&!seat.locked);return`<article class="seat ${seat.blocked?'blocked':''} ${seat.locked?'locked':''} ${student&&!student.present?'absent':''}" data-seat-id="${seat.id}" data-student-id="${student?.id||''}" ${draggable?'draggable="true"':''} style="--seat-row:${seat.row+1};--seat-column:${seat.column+1}"><header><span>${escapeHtml(seat.label)}</span><button data-action="toggle-seat-lock" data-id="${seat.id}" title="Uzamknout místo">${seat.locked?'▣':'▢'}</button></header><div><b>${escapeHtml(student?.displayName||'Volné místo')}${student&&!student.present?' · nepřítomen':''}</b><small>${student?.frontPreference?'preferuje přední část':seat.blocked?'místo je vypnuté':draggable?'lze přetáhnout':'kliknutím přiřaďte'}</small></div><select data-action="seat-student" data-id="${seat.id}" ${seat.blocked||seat.locked?'disabled':''}><option value="">Volné místo</option>${options}</select><button class="seat-block-button" data-action="toggle-seat-block" data-id="${seat.id}">${seat.blocked?'Zapnout místo':'Mimo provoz'}</button></article>`}
function clearSeatingDragHighlight(){$$('.seat.drag-over').forEach(seat=>seat.classList.remove('drag-over'))}
function seatingShapePointerDown(event){const cell=event.target.closest('[data-seating-shape-cell]');if(!cell||!cell.closest('#seatingWorkspace'))return;seatingShapePaintState=!cell.classList.contains('active');seatingShapeSetCell(cell,seatingShapePaintState);event.preventDefault()}
function seatingShapePointerMove(event){if(seatingShapePaintState===null)return;const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('[data-seating-shape-cell]');if(!cell||!cell.closest('#seatingWorkspace'))return;seatingShapeSetCell(cell,seatingShapePaintState)}
function seatingShapePointerEnd(){seatingShapePaintState=null}
function seatingUiBind(){
  if(globalThis.__SORTIO_SEATING_UI_BOUND__)return;globalThis.__SORTIO_SEATING_UI_BOUND__=true;
  document.addEventListener('change',event=>{const action=event.target.dataset.action;if(action==='front-preference')updateStudent(getSelectedClass().id,event.target.dataset.id,{frontPreference:event.target.checked});if(action==='seat-student'){if(!setSeatStudent(event.target.dataset.id,event.target.value))toast('Toto místo je uzamčené nebo nedostupné.','info');seatingUiRender()}});
  document.addEventListener('pointerdown',seatingShapePointerDown);document.addEventListener('pointermove',seatingShapePointerMove);document.addEventListener('pointerup',seatingShapePointerEnd);document.addEventListener('pointercancel',seatingShapePointerEnd);
  document.addEventListener('keydown',event=>{const cell=event.target.closest?.('[data-seating-shape-cell]');if(!cell||!cell.closest('#seatingWorkspace')||!['Enter',' '].includes(event.key))return;event.preventDefault();seatingShapeSetCell(cell,!cell.classList.contains('active'))});
  document.addEventListener('dragstart',event=>{const seat=event.target.closest('.seat[draggable="true"]');if(!seat||!seat.closest('#seatingWorkspace')||event.target.closest('select,button,input')){if(seat)event.preventDefault();return}App.ui.seatingDragStudentId=seat.dataset.studentId||'';App.ui.seatingDragSeatId=seat.dataset.seatId||'';seat.classList.add('dragging');if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',App.ui.seatingDragStudentId)}});
  document.addEventListener('dragover',event=>{const seat=event.target.closest('.seat');if(!seat||!seat.closest('#seatingWorkspace')||!App.ui.seatingDragStudentId)return;const model=getSelectedClass()?.seatingPlan?.seats.find(item=>item.id===seat.dataset.seatId);if(!model||model.blocked||model.locked)return;event.preventDefault();clearSeatingDragHighlight();seat.classList.add('drag-over');if(event.dataTransfer)event.dataTransfer.dropEffect='move'});
  document.addEventListener('drop',event=>{const seat=event.target.closest('.seat');if(!seat||!seat.closest('#seatingWorkspace')||!App.ui.seatingDragStudentId)return;event.preventDefault();const moved=setSeatStudent(seat.dataset.seatId,App.ui.seatingDragStudentId);App.ui.seatingDragStudentId='';App.ui.seatingDragSeatId='';clearSeatingDragHighlight();if(moved){seatingUiRender();toast('Student byl přesunut.','success')}else toast('Na toto místo nelze studenta přesunout.','info')});
  document.addEventListener('dragend',event=>{event.target.closest('.seat')?.classList.remove('dragging');App.ui.seatingDragStudentId='';App.ui.seatingDragSeatId='';clearSeatingDragHighlight()});
  document.addEventListener('click',event=>{const shapeCell=event.target.closest('[data-seating-shape-cell]');if(shapeCell){event.preventDefault();return}const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='project-seating'){openProjection('seating');return}if(action==='download-seating-pdf'){downloadSeatingPdf().catch(error=>toast(error.message,'error'));return}if(action==='clear-seating-shape'){seatingShapeSetGrid([],{markCustom:true});return}if(!['apply-seating-layout','assign-seating','rotate-seating','clear-seating','toggle-seat-block','toggle-seat-lock'].includes(action))return;try{if(action==='apply-seating-layout'){configureSeatingShape(seatingShapeReadCells(),{preserve:true});toast('Tvar učebny byl uložen.','success')}if(action==='assign-seating'){assignSeating();toast('Zasedací pořádek byl vytvořen.','success')}if(action==='rotate-seating'){if(!rotateSeating())throw new Error('Pro rotaci nejsou alespoň dva obsazení studenti.');toast('Místa byla rotována.','success')}if(action==='clear-seating')clearSeatingAssignments();if(action==='toggle-seat-block')toggleSeatBlocked(button.dataset.id);if(action==='toggle-seat-lock'){if(!toggleSeatLock(button.dataset.id))throw new Error('Uzamknout lze pouze obsazené místo.')}seatingUiRender()}catch(error){toast(error.message,'error')}});
}

;globalThis.__SORTIO_SEATING_UI__={render:seatingUiRender,bind:seatingUiBind};
