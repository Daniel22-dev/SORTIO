import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
function expect(name,condition,detail=''){checks.push({name,ok:Boolean(condition),detail});if(!condition)process.exitCode=1}

const board=read('src/js/87-lesson-board.js');
const media=read('src/js/88-media-library.js')+'\n'+read('src/lazy/media-library.js');
const live=read('src/js/89-live-poll.js');
const importParser=read('src/js/45-import-parser.js');
const body=read('src/body.html');
const css=read('src/styles.css');
const poll=read('src/poll/poll.js');
const headers=JSON.parse(read('src/config/security-headers.json'));
const api=read('docs/SORTIO-LIVE-POLL-API.md');

for(const type of ['timer','visual-timer','stopwatch','clock','traffic','draw','dice','score','text','work','image','agenda','poll','qr'])expect(`widget catalog: ${type}`,board.includes(`type:'${type}'`));
expect('event countdown removed from addable catalog',!board.split('const LESSON_WIDGET_CATALOG')[1].split(']);')[0].includes("type:'event'"));
expect('workspace follows selected class',board.includes('lessonBoardScopeKey')&&board.includes("getSelectedClass()?.id||'__general__'")&&board.includes('Plocha se automaticky přepíná s aktivní třídou'));
expect('board fullscreen exists',board.includes("action==='board-fullscreen'")&&board.includes('root.requestFullscreen()')&&css.includes('#toolsWorkspace:fullscreen'));
expect('widget layout engine exists',board.includes('lessonBoardPointerDown')&&board.includes('data-board-resize')&&board.includes('widget-spotlight'));
expect('inner widget scale is independent',board.includes('widget-scale-up')&&board.includes('widget-scale-down')&&board.includes('lessonBoardContentWheel')&&css.includes('--content-scale'));
expect('inner scale has mouse drag handle',board.includes('data-board-scale-resize')&&board.includes("kind:scaleResize?'scale'")&&css.includes('.widget-content-scale-handle'));
expect('timer uses minute/second steppers',board.includes('data-board-timer-unit="minutes"')&&board.includes('data-board-timer-unit="seconds"')&&!board.includes('−1 min')&&!board.includes('+10 s'));
expect('timer has compact start control',board.includes('timer-start-compact')&&!board.includes('class="timer-start-big'));
expect('timer sound cues available',forAll(['bell','piano','guitar','xylophone','trumpet','drum','none'],v=>board.includes(`'${v}'`))&&board.includes('Jemné trojité cinknutí'));
expect('visual timer uses draggable 60 minute dial',board.includes('lessonBoardVisualPointerDown')&&board.includes('lessonBoardVisualDialMinutes')&&board.includes('60 min')&&css.includes('.visual-timer-dial'));
expect('clock has no alarm/sound UI',!board.includes('alarmTime')&&!board.includes('alarmSound'));
expect('traffic light has no labels',board.includes('traffic-housing')&&!board.includes('data-board-traffic-label')&&!board.includes('Ticho')&&!board.includes('Šeptem'));
expect('dice uses visible objects and animations',board.includes('real-die')&&board.includes('real-coin')&&css.includes('sortio-dice-tumble')&&css.includes('sortio-coin-flip'));
expect('projection uses lesson board',board.includes('lessonBoardProjectionHtml'));
expect('image background attribution visible',board.includes('lessonBoardBackgroundCredit')&&css.includes('.board-background-credit'));
expect('Wikimedia search only',media.includes('commons.wikimedia.org/w/api.php')&&media.includes('sanitizeLessonImageUrl'));
expect('backgrounds are ranked for wide aesthetic use',media.includes('MEDIA_LIBRARY_BACKGROUND_BAD_TITLE')&&media.includes('MEDIA_LIBRARY_BACKGROUND_GOOD_TITLE')&&media.includes("iiprop:'url|size|mime|mediatype|extmetadata'"));
expect('backgrounds render without cropping',board.includes('lesson-board-background-backdrop')&&board.includes('lesson-board-background-image')&&css.includes('object-fit:contain!important'));
expect('media library is lazy-loaded and precached',read('src/js/88-media-library.js').includes('./lazy/media-library.js')&&read('src/sw.js').includes('./lazy/media-library.js'));
expect('Wikimedia returns 50 and pagination',media.includes("gsrlimit:'50'")&&media.includes('gsroffset')&&media.includes('Načíst dalších 50 obrázků'));
const mediaDialog=body.split('<dialog id="mediaLibraryDialog"')[1]?.split('</dialog>')[0]||'';
expect('no image upload control',!mediaDialog.match(/<input[^>]+type=["']file["'][^>]*>/i));
expect('media dialog is labelled',body.includes('aria-labelledby="mediaLibraryTitle"'));
expect('no sound-level widget',!board.includes("type:'sound'")&&!body.toLowerCase().includes('měřič hluku'));
expect('microphone remains disabled',String(headers?.profiles?.github?.permissionsPolicy||headers?.headers?.['Permissions-Policy']||JSON.stringify(headers)).includes('microphone=()'));
expect('Wikimedia explicitly allowed by CSP',JSON.stringify(headers).includes('https://commons.wikimedia.org')&&JSON.stringify(headers).includes('https://upload.wikimedia.org'));
expect('given-name diacritics dictionary exists',importParser.includes('IMPORT_GIVEN_NAMES')&&importParser.includes("'Tomáš'")&&importParser.includes("'Jiří'")&&importParser.includes("'Štěpán'"));
expect('live poll create/sync/close implemented',live.includes("livePollEndpoint('sortio/polls')")&&live.includes('/results?token=')&&live.includes('/close?token='));
expect('poll is anonymous by contract',live.includes('anonymous:true')&&api.toLowerCase().includes('žádné jméno'));
expect('public voter page posts votes',poll.includes('/votes')||poll.includes('votes'));
expect('server API contract documents close endpoint',api.includes('/close?token={teacherToken}'));
expect('no microphone permission in runtime code',!`${board}\n${media}\n${live}`.includes('getUserMedia'));
expect('draw pen color persists immediately without rerender',board.includes('function lessonBoardSetDrawColor')&&board.includes("lessonBoardPersist('lesson_draw_color',{render:false})")&&board.includes("target.matches('[data-board-field=\"color\"]')"));
expect('draw clear is immediate without native confirm',board.includes("if(action==='draw-clear'){d.strokes=[];lessonBoardPersist('lesson_draw_clear');return true}")&&!board.includes("confirm('Smazat obsah této tabule?')"));

function forAll(values,fn){return values.every(fn)}
const failed=checks.filter(c=>!c.ok);
for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'} ${c.name}${c.detail?` — ${c.detail}`:''}`);
console.log(`\nLesson board regressions: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
