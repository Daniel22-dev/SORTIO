import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
function expect(name,condition,detail=''){
  checks.push({name,ok:Boolean(condition),detail});
  if(!condition)process.exitCode=1;
}

const board=read('src/js/87-lesson-board.js');
const media=read('src/js/88-media-library.js');
const live=read('src/js/89-live-poll.js');
const body=read('src/body.html');
const css=read('src/styles.css');
const poll=read('src/poll/poll.js');
const headers=JSON.parse(read('src/config/security-headers.json'));
const api=read('docs/SORTIO-LIVE-POLL-API.md');

for(const type of ['timer','visual-timer','stopwatch','clock','traffic','draw','dice','score','text','work','image','event','agenda','poll','qr']){
  expect(`widget catalog: ${type}`,board.includes(`type:'${type}'`));
}
expect('scene engine exists',board.includes('lessonBoardAddScene')&&board.includes('lessonBoardDuplicateScene')&&board.includes('lessonBoardSetScene'));
expect('widget layout engine exists',board.includes('lessonBoardPointerDown')&&board.includes('data-board-resize')&&board.includes('widget-spotlight'));
expect('projection uses lesson board',board.includes('lessonBoardProjectionHtml'));
expect('image background attribution visible',board.includes('lessonBoardBackgroundCredit')&&css.includes('.board-background-credit'));
expect('Wikimedia search only',media.includes('commons.wikimedia.org/w/api.php')&&media.includes('sanitizeLessonImageUrl'));
const mediaDialog=body.split('<dialog id="mediaLibraryDialog"')[1]?.split('</dialog>')[0]||'';
expect('no image upload control',!mediaDialog.match(/<input[^>]+type=["']file["'][^>]*>/i));
expect('media dialog is labelled',body.includes('aria-labelledby="mediaLibraryTitle"'));
expect('no sound-level widget',!board.includes("type:'sound'")&&!body.toLowerCase().includes('měřič hluku'));
expect('microphone remains disabled',String(headers?.profiles?.github?.permissionsPolicy||headers?.headers?.['Permissions-Policy']||JSON.stringify(headers)).includes('microphone=()'));
expect('Wikimedia explicitly allowed by CSP',JSON.stringify(headers).includes('https://commons.wikimedia.org')&&JSON.stringify(headers).includes('https://upload.wikimedia.org'));
expect('live poll create/sync/close implemented',live.includes("livePollEndpoint('sortio/polls')")&&live.includes('/results?token=')&&live.includes('/close?token='));
expect('poll is anonymous by contract',live.includes('anonymous:true')&&api.toLowerCase().includes('žádné jméno'));
expect('public voter page posts votes',poll.includes('/votes')||poll.includes('votes'));
expect('server API contract documents close endpoint',api.includes('/close?token={teacherToken}'));
expect('no microphone permission in runtime code',!`${board}\n${media}\n${live}`.includes('getUserMedia'));

const failed=checks.filter(c=>!c.ok);
for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'} ${c.name}${c.detail?` — ${c.detail}`:''}`);
console.log(`\nLesson board regressions: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
