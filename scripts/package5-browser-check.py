from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'src/styles.css').read_text()
body=(ROOT/'src/body.html').read_text().replace('__APP_VERSION__','1.0.2')
js='\n;\n'.join(path.read_text() for path in sorted((ROOT/'src/js').glob('*.js')))
legacy={'schema':'sortio-data-v4','version':4,'selectedClassId':'legacy','classes':[{'id':'legacy','name':'Původní třída','schoolYear':'2025/2026','students':[{'id':f's{i}','firstName':f'Test{i+1}','lastName':'Student','present':True,'archived':False} for i in range(12)]}],'aliases':{}}
legacy_json=json.dumps(json.dumps(legacy,ensure_ascii=False))
storage=f"""(function(){{const m=new Map([['sortio.data.v4',{legacy_json}]]);const s={{get length(){{return m.size}},key:i=>[...m.keys()][i]||null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear()}};Object.defineProperty(window,'localStorage',{{configurable:true,value:s}});Object.defineProperty(window,'sessionStorage',{{configurable:true,value:s}});Object.defineProperty(navigator,'serviceWorker',{{configurable:true,value:{{register:async()=>({{}})}}}});window.confirm=()=>true;}})();"""
html=f"<!doctype html><html data-theme='dark'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='manifest' href='data:application/json,{{}}'><style>{css}</style><script>{storage}</script></head><body>{body}<script>{js}</script></body></html>"
errors=[]
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for label,viewport in [('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]:
    page=browser.new_page(viewport=viewport)
    page.on('pageerror',lambda exc:errors.append(f'{label}:page:{exc}'))
    page.on('console',lambda msg: errors.append(f'{label}:console:{msg.type}:{msg.text}') if msg.type=='error' and 'Failed to load resource' not in msg.text and '[SORTIO/data-primary-corrupt]' not in msg.text else None)
    page.set_content(html,wait_until='load')
    page.wait_for_timeout(300)
    assert page.evaluate("document.documentElement.dataset.appReady")=='true'
    assert page.evaluate("JSON.parse(localStorage.getItem('sortio.data.v5')).schema")=='sortio-data-v5'
    page.evaluate("SORTIO.data.aliases.browserTest='ano'; saveData({render:false,event:'browser-test'})")
    assert page.evaluate("!!localStorage.getItem('sortio.data.v5.last-good')")
    page.click('[data-route="settings"]')
    page.wait_for_selector('#productionHealth')
    page.click('#createDemoClass')
    page.wait_for_timeout(120)
    assert page.evaluate("SORTIO.data.classes.some(x=>x.demo)")
    page.click('[data-route="settings"]')
    page.click('#runProductionChecks')
    page.wait_for_function("SORTIO.productionChecks && SORTIO.productionChecks.checks.length===8",timeout=15000)
    failed=page.evaluate("SORTIO.productionChecks.checks.filter(x=>x.state!=='pass').map(x=>x.id+':'+x.detail)")
    assert not failed,failed
    report=page.evaluate("diagnosticReport()")
    report_text=json.dumps(report,ensure_ascii=False)
    assert 'Nováková' not in report_text and '@' not in report_text
    page.keyboard.press('?')
    page.wait_for_selector('#keyboardDialog[open]')
    page.keyboard.press('Escape')
    page.evaluate("localStorage.setItem('sortio.data.v5','{broken json')")
    recovered=page.evaluate("loadData()")
    assert recovered['schema']=='sortio-data-v5' and len(recovered['classes'])>=1
    payload=page.evaluate("buildBackupPayload()")
    assert payload['schema']=='sortio-backup-v4' and payload['integrity']['checksum']
    page.evaluate("localStorage.setItem('sortio.data.v5.pre-import',JSON.stringify(SORTIO.data)); SORTIO.data.classes=[]; restoreRecoverySnapshot()")
    assert page.evaluate("SORTIO.data.classes.length")>=1
    page.screenshot(path=str(ROOT/'qa-results'/f'package5-{label}.png'),full_page=True)
    page.close()
  browser.close()
if errors:
  print('\n'.join(errors));sys.exit(1)
print('[browser5] Migrace v4->v5, poslední bezpečný stav, demo, 8 produkčních kontrol, diagnostika, klávesy a obnova prošly.')
