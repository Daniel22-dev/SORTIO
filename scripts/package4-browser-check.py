from pathlib import Path
import json, sys, re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
css = (ROOT / 'src' / 'styles.css').read_text()
body = (ROOT / 'src' / 'body.html').read_text().replace('__APP_VERSION__','1.0.2')
js = '\n;\n'.join(path.read_text() for path in sorted((ROOT / 'src' / 'js').glob('*.js')))

names = ['Adam Novak', 'Bara Svobodova', 'Cyril Dvorak', 'Dana Vesela', 'Emil Marek', 'Fany Kralova']
legacy = {
    'schema': 'sortio-data-v5',
    'version': 3,
    'selectedClassId': 'class-demo',
    'classes': [{
        'id': 'class-demo',
        'name': 'Testovaci trida',
        'schoolYear': '2026/2027',
        'students': [
            {'id': f's{i}', 'firstName': n.split()[0], 'lastName': n.split()[1], 'present': True, 'archived': False}
            for i, n in enumerate(names)
        ],
        'currentGroups': [
            {'id': 'g1', 'name': 'Skupina 1', 'studentIds': ['s0', 's1', 's2'], 'roleAssignments': {'Mluvci': 's0'}, 'topic': 'Tema A'},
            {'id': 'g2', 'name': 'Skupina 2', 'studentIds': ['s3', 's4', 's5'], 'roleAssignments': {}, 'topic': 'Tema B'},
        ],
        'seatingPlan': {
            'template': 'rows', 'rows': 2, 'columns': 3,
            'seats': [
                {'id': f'seat{i}', 'row': i // 3, 'column': i % 3, 'studentId': f's{i}', 'blocked': False, 'locked': False}
                for i in range(6)
            ],
        },
    }],
    'aliases': {},
}
legacy_json = json.dumps(json.dumps(legacy))
storage_script = f"""(function(){{const m=new Map([['sortio.data.v3',{legacy_json}]]);const s={{get length(){{return m.size}},key:i=>[...m.keys()][i]||null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear()}};Object.defineProperty(window,'localStorage',{{configurable:true,value:s}});Object.defineProperty(window,'sessionStorage',{{configurable:true,value:s}});}})();"""
html = f"<!doctype html><html data-theme='dark'><head><meta charset='utf-8'><style>{css}</style><script>{storage_script}</script></head><body>{body}<script>{js}</script></body></html>"
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for label, viewport in [('desktop', {'width': 1440, 'height': 1000}), ('mobile', {'width': 390, 'height': 844})]:
        page = browser.new_page(viewport=viewport)
        page.on('console', lambda msg: errors.append(f'{label}:console:{msg.type}:{msg.text}') if msg.type == 'error' and 'Failed to load resource' not in msg.text else None)
        page.on('pageerror', lambda exc: errors.append(f'{label}:page:{exc}'))
        page.set_content(html, wait_until='load')
        page.wait_for_timeout(250)
        ready=page.evaluate("() => document.documentElement.dataset.appReady")
        if ready!='true':
            print('NOT READY',label,ready,errors,page.locator('body').inner_text()[:500]); raise AssertionError('app not ready')
        assert page.locator('[data-route="tools"]').count() == 1
        page.click('[data-route="tools"]')
        page.wait_for_selector('#toolsWorkspace .timer-card')
        assert page.locator('#toolsWorkspace .tool-card').count() >= 6
        assert page.evaluate("!!localStorage.getItem('sortio.data.v5')")
        page.click('[data-timer-preset="60"]')
        page.click('[data-action="timer-toggle"]')
        page.wait_for_timeout(450)
        timer = page.locator('[data-timer-display]').first.text_content()
        assert timer in ('01:00', '00:59')
        page.click('[data-quick="dice"]')
        assert page.locator('#quickResult').text_content().strip() in list('123456')
        page.click('[data-action="fair-pick"]')
        page.wait_for_timeout(100)
        assert page.locator('.recent-engagement span').count() == 1
        page.click('#projectionBtn')
        page.wait_for_selector('#projectionDialog[open]')
        page.select_option('#projectionMode', 'groups')
        page.wait_for_timeout(100)
        assert page.locator('#projectionContent .projection-groups article').count() == 2
        sensitive = page.locator('#projectionContent').inner_text()
        assert 'Uroven' not in sensitive and 'od sebe' not in sensitive
        page.click('[data-action="close-projection"]')
        with page.expect_popup() as popup_info:
            page.click('[data-export="cards"]')
        popup = popup_info.value
        popup.wait_for_load_state('domcontentloaded')
        assert 'Kartičky se jmény' in popup.title()
        assert popup.locator('.name-card').count() == 6
        popup.close()
        page.screenshot(path=str(ROOT / 'qa-results' / f'package4-{label}.png'), full_page=True)
        page.close()
    browser.close()

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('[browser] Migrace v3->v5, nastroje, casovac, spravedlivy vyber, projekce, desktop a mobil prosly.')
