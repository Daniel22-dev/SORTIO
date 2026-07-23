const MODULES=[
{id:'core',name:'Jádro aplikace',status:'ready',package:'Balíček 1'},
{id:'storage',name:'Lokální datová vrstva',status:'ready',package:'Balíček 1'},
{id:'classes',name:'Třídy a import z IS',status:'ready',package:'Balíček 2'},
{id:'draw',name:'Losování',status:'ready',package:'Balíček 2'},
{id:'groups',name:'Chytré skupiny a pravidla',status:'ready',package:'Balíček 3'},
{id:'roles',name:'Role, témata a úkoly',status:'ready',package:'Balíček 3'},
{id:'seating',name:'Zasedací pořádek',status:'ready',package:'Balíček 3'},
{id:'projection',name:'Bezpečný projekční režim',status:'ready',package:'Balíček 4'},
{id:'tools',name:'Třídní nástroje',status:'ready',package:'Balíček 4'},
{id:'history',name:'Spravedlivé zapojování',status:'ready',package:'Balíček 4'},
{id:'exports',name:'PDF a tisk',status:'ready',package:'Balíček 4'},
{id:'resilience',name:'Odolnost dat a bezpečné zálohy',status:'ready',package:'Balíček 5'},
{id:'diagnostics',name:'Produkční diagnostika',status:'ready',package:'Balíček 5'},
{id:'accessibility',name:'Přístupnost a klávesové ovládání',status:'ready',package:'Balíček 5'},
{id:'qa',name:'Interní testovací centrum',status:'ready',package:'Balíček 5'}
];
function renderRoadmap(){const root=$('#roadmapGrid');if(!root)return;root.innerHTML=MODULES.map(item=>`<article class="roadmap-card ${item.status}"><span>${item.package}</span><h3>${item.name}</h3><small>${item.status==='ready'?'Aktivní':'Další etapa'}</small></article>`).join('')}
