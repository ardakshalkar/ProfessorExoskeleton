/**
 * Course mode: the term plan as the page, and the agent as a press on it.
 *
 * SINCE 2026-10-16 THE PANE DRAWS COURSE MODE ITSELF, in React, from
 * `/api/course` (client/course/), and no longer frames this page. This page is
 * the same course mode as one HTML document — kept for a tab opened on
 * `/view/course` by itself, for `test/planning-page.mjs`, and as the reference
 * the React view was checked against. Both are fed by `server/course-data.js`
 * and share their words, icons and stylesheet (`shared/`), so a change to
 * what course mode says is made once.
 *
 * The design argued for in `COURSE-MODE.md` and built first as
 * `prototype/proto.html`, served here for real. One grid for the whole term —
 * Lecture, Graded work, Outcomes — so the columns line up from week 1 to week
 * 16, opened over the harness rather than squeezed into its 300px column.
 *
 * WHY IT IS DRAWN HERE AND NOT BY THE WIDGET
 * ------------------------------------------
 * `course-outline.tmpl` is one column wide by construction: it is the document
 * ChatGPT and Claude Desktop draw beside a reply, and it is what `ainar page`
 * publishes. A three-column term table is neither of those things. So the pane
 * draws this one itself, the way it draws the Checklist — from the same
 * `course_outline` payload, with the same material links — and the shared
 * widget keeps its own shape.
 *
 * WHAT IT COMPUTES
 * ----------------
 * This runs on the host, before the page exists, which is the side of the wall
 * where figures may be made. The page that arrives in the browser counts
 * nothing. What is decided here is presentation of facts the payload already
 * holds: which week a hole is urgent in (`when`, against `current_week`), runs
 * of unplanned weeks, which outcomes a week teaches against which it assesses.
 * Every gap is the payload's own `weeks[].gaps`, with the model's sentence on
 * its title.
 *
 * WHAT A PRESS DOES
 * -----------------
 * Two messages up to the harness, the two every pane document already sends:
 * `ask` (a prompt into the open session) and `view` (a material over the
 * harness, accepted only if it is this app's own `/file` route). A hole is a
 * verb: pressing "Draft deck" asks for the deck, naming the week, the module
 * and the meetings, so the model starts with the record rather than a search.
 * Nothing here approves or decides; accepting a draft is the professor
 * changing `approval: draft` in its record. The one write is Planning's: a
 * bar dragged to another week sends a third message, `dates`, carrying the
 * two dates the professor settled in its form (`PLAN_SCRIPT`), and the pane
 * writes them (`server/plan-writes.js`).
 */

import { LIGHT, DARK, STYLE } from "../shared/course-style.js";
import {
  conceptsOf,
  datesPrompt,
  GAP,
  hasBrief,
  ICONS,
  kindOf,
  laneOf,
  LANES,
  MEETING_ICON,
  pct,
  promptFor,
  RESOURCE_ICON,
  RESOURCE_WORD,
  REVISIT_BELOW,
  runOffset,
  shortDate,
  tierOf,
  titleOf,
  weightPct,
  WORK_ICON,
  WORK_WORD,
} from "../shared/course-words.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// ------------------------------------------------------------------- icons

/**
 * Line icons on a 24-unit grid in the Lucide idiom, drawn inline: the frame has
 * no network and needs none. Stroked in `currentColor`, so a chip's tone —
 * red on a hole, green on a deck, blue on a draft — colours its icon too.
 */
const SPRITE =
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>\n` +
  Object.entries(ICONS).map(([name, inner]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${inner}</symbol>`).join("\n") +
  "\n</defs></svg>";

const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${esc(name)}"/></svg>`;

// ------------------------------------------------------------------- style

/**
 * Presses, out to the harness: the two messages every pane document sends,
 * and the four a status line's buttons send to open the pane's own windows
 * (`grade`, `scans`, `upload`, `defence-desk`, `publish`). `parent === window` means the page was opened in a
 * tab by itself, with nobody listening, so it takes no clicks at all. A
 * modified click keeps the tab a link always opened.
 *
 * And the sticky column heads sit under the strip by its MEASURED height,
 * because the strip wraps on a narrow frame.
 *
 * The page opens on this week. Once is not enough: the frame is sandboxed
 * with an opaque origin and may be given its size only after this runs, so
 * a scroll made at parse time is lost and the page sits on week 1. It is
 * made again on load, on resize and whenever the page reflows, until the
 * professor scrolls themselves.
 *
 * Teaching steps between weeks in the page, with no round trip, and says
 * which week it stepped to (`teaching-week`): course mode keeps it, so
 * leaving Teaching and coming back returns to that week, not this one.
 */
const SCRIPT = `<script>(function(){
var strip=document.querySelector('.strip'),ro=window.ResizeObserver?new ResizeObserver(function(){measure();}):null;
function measure(){if(strip)document.documentElement.style.setProperty('--strip-h',strip.offsetHeight+'px');}
measure();if(ro&&strip)ro.observe(strip);
var now=document.querySelector('.wkhead.now,.band.now'),moved=false;
function toNow(){if(now&&!moved&&innerHeight>0)now.scrollIntoView({block:'start'});}
['wheel','keydown','mousedown','touchstart'].forEach(function(k){addEventListener(k,function(){moved=true;},{once:true,passive:true});});
toNow();addEventListener('load',toNow);addEventListener('resize',toNow);if(window.requestAnimationFrame)requestAnimationFrame(toNow);
if(window.ResizeObserver)new ResizeObserver(toNow).observe(document.body);
document.addEventListener('click',function(e){
  var g=e.target.closest&&e.target.closest('[data-goto]');if(!g)return;
  var n=g.getAttribute('data-goto');
  document.querySelectorAll('.trio-wrap').forEach(function(s){s.hidden=s.getAttribute('data-week')!==n;});
  window.scrollTo(0,0);
  if(parent!==window)parent.postMessage({source:'professor-pane',kind:'teaching-week',week:Number(n)},'*');
});
if(parent===window)return;
addEventListener('message',function(e){var d=e.data;
  if(e.source!==parent||!d||d.source!=='professor-pane'||d.kind!=='swap'||typeof d.html!=='string')return;
  var next=new DOMParser().parseFromString(d.html,'text/html'),x=scrollX,y=scrollY,body=document.body;
  // The running scripts stay, and so do Planning's two forms, which those
  // scripts hold: each new copy is replaced by the live one.
  function kept(n){return n.nodeType===1&&n.tagName==='SCRIPT'&&!n.type;}
  var forms=[].slice.call(document.querySelectorAll('.planform'));forms.forEach(function(x){x.remove();});
  [].slice.call(body.childNodes).forEach(function(n){if(!kept(n))body.removeChild(n);});
  var first=body.firstChild;
  [].slice.call(next.body.childNodes).forEach(function(n){if(!kept(n))body.insertBefore(document.adoptNode(n),first);});
  [].slice.call(document.querySelectorAll('.planform')).forEach(function(x,i){if(forms[i])x.replaceWith(forms[i]);});
  var s=next.querySelector('head style'),o=document.querySelector('head style');if(s&&o&&s.textContent!==o.textContent)o.textContent=s.textContent;
  moved=true;if(ro&&strip)ro.unobserve(strip);strip=document.querySelector('.strip');measure();if(ro&&strip)ro.observe(strip);
  scrollTo(x,y);
  document.dispatchEvent(new Event('pp-swapped'));
  parent.postMessage({source:'professor-pane',kind:'swapped'},'*');});
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-ask]');
  if(b){e.preventDefault();parent.postMessage({source:'professor-pane',kind:'ask',prompt:b.getAttribute('data-ask')},'*');return;}
  var w=e.target.closest&&e.target.closest('[data-grade],[data-scans],[data-upload],[data-desk],[data-publish]');
  if(w){e.preventDefault();var m={source:'professor-pane'};
    if(w.hasAttribute('data-grade')){m.kind='grade';m.assessment=w.getAttribute('data-grade');m.label=w.getAttribute('data-label')||'';}
    else if(w.hasAttribute('data-scans')){m.kind='scans';m.assessment=w.getAttribute('data-scans');}
    else if(w.hasAttribute('data-upload')){m.kind='upload';m.assessment=w.getAttribute('data-upload');m.label=w.getAttribute('data-label')||'';}
    else if(w.hasAttribute('data-desk')){m.kind='defence-desk';m.assessment=w.getAttribute('data-desk');m.student=w.getAttribute('data-student');}
    else{m.kind='publish';m.assessment=w.getAttribute('data-publish');m.label=w.getAttribute('data-label')||'';m.target=w.getAttribute('data-target')||'';}
    parent.postMessage(m,'*');return;}
  var a=e.target.closest&&e.target.closest('a[data-view]');if(!a)return;
  if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  e.preventDefault();
  parent.postMessage({source:'professor-pane',kind:'view',url:a.getAttribute('href'),label:a.getAttribute('data-view'),format:a.getAttribute('data-format'),papers:a.getAttribute('data-papers')},'*');
});})();<\/script>`;

/**
 * Planning's hands: drag a bar to another week, or one of its ends, and
 * settle the day in a small form before anything is written.
 *
 * A drop moves by whole weeks — seven days per week crossed — so a quiz due
 * Friday at 23:59 is still due Friday at 23:59, three weeks later. That is
 * asked, never written: the form opens brief, the week it lands on lit and
 * the two dates in words, and the professor saves or cancels; "Change
 * dates" opens the inputs when the week is not the whole story. Saving is
 * one `dates` message up to the pane, which writes the record and swaps the
 * newer page into this one in place (`swap` in `SCRIPT`), scroll and all.
 *
 * The guardrails are drawn here and enforced again by the writes
 * (`planLocks`): work with results has no handle and no date button, a week
 * already taught takes no drop, and work that opened in one moves only by
 * its due end. The page keeps each date's own offset, so it
 * does no time-zone arithmetic: what the input shows is the record's wall
 * time, and what goes back is that wall time with the same offset.
 *
 * A topic moves the same way, with its meetings: a module's `week` is one
 * number but each of its meetings carries its own date, so the form lists
 * every meeting shifted by the same whole weeks, and warns about one left
 * outside the topic's week (it would show as misdated). When the week it
 * lands on holds exactly one topic, the two swap by default, the other's
 * meetings shifted back; saving sends one `topic` message with both moves.
 *
 * Work with no dates comes from the tray and opens the form with the due
 * date at the end of the week it was dropped on. Nothing listens in a tab
 * opened by itself, so there the page draws the bars and takes no drags.
 */
const PLAN_SCRIPT = `<script>(function(){
var form=document.querySelector('.planform'),island=document.getElementById('plan-items');
if(!form||!island||parent===window)return;
var items,table,OFF,rows,topics,taughtBefore;
function read(){island=document.getElementById('plan-items');items=island?JSON.parse(island.textContent):{};
  table=document.querySelector('table.plan');OFF=(table&&table.getAttribute('data-offset'))||'+00:00';
  rows=[].slice.call(document.querySelectorAll('tr[data-week]')).map(function(r){return{n:+r.getAttribute('data-week'),from:r.getAttribute('data-from'),to:r.getAttribute('data-to'),taught:r.hasAttribute('data-taught')};});
  topics=JSON.parse((document.getElementById('plan-topics')||{}).textContent||'{}');
  taughtBefore=null;for(var i=0;i<rows.length;i++){if(rows[i].taught)taughtBefore='9999';else{if(taughtBefore)taughtBefore=rows[i].from;break;}}}
read();
document.addEventListener('pp-swapped',function(){read();close();tclose();});
function wasTaught(v){return!!(taughtBefore&&v&&v.slice(0,10)<taughtBefore);}
var toast=null,toastT=0;
function say(text){if(!toast||!toast.isConnected){toast=document.createElement('div');toast.className='plantoast';toast.setAttribute('role','status');document.body.appendChild(toast);}
  toast.textContent=text;toast.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toast.hidden=true;},2800);}
var mark=null;
function target(r){if(mark)mark.classList.remove('target');mark=r;if(r)r.classList.add('target');}
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function when(v){return v?DAY[new Date(v.slice(0,10)+'T12:00:00Z').getUTCDay()]+' '+nice(v.slice(0,10))+', '+v.slice(11,16):'';}
function rowOf(n){for(var i=0;i<rows.length;i++)if(rows[i].n===n)return rows[i];return null;}
function weekOf(d){for(var i=0;i<rows.length;i++)if(d>=rows[i].from&&d<=rows[i].to)return rows[i].n;return null;}
function nice(d){var p=d.split('-');return MON[+p[1]-1]+' '+(+p[2]);}
function addDays(d,n){var p=d.split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+n)).toISOString().slice(0,10);}
function local(s){return s?String(s).slice(0,16):'';}
function offOf(s){var m=/(Z|[+-][0-9][0-9]:[0-9][0-9])$/.exec(s||'');return m?(m[1]==='Z'?'+00:00':m[1]):OFF;}
function shift(v,n){return v?addDays(v.slice(0,10),n)+v.slice(10):v;}
var f={title:form.querySelector('.pf-title'),week:form.querySelector('.pf-week'),opens:form.querySelector('.pf-opens'),due:form.querySelector('.pf-due'),
  opensWk:form.querySelector('.pf-opens-wk'),dueWk:form.querySelector('.pf-due-wk'),error:form.querySelector('.pf-error'),save:form.querySelector('.pf-save'),sum:form.querySelector('.pf-sum')};
function hint(input,out){var v=input.value;if(!v){out.textContent=input===f.opens?'no opening date':'';out.classList.remove('off');return;}
  var w=weekOf(v.slice(0,10));out.textContent=w?'week '+w+' \\u00b7 '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(v.slice(0,10)+'T12:00:00Z').getUTCDay()]:'outside the term';out.classList.toggle('off',!w);}
var orig={opens:'',due:''};
// A date that changes may not leave or enter a week already taught.
function frozen(was,now){return was!==now&&(wasTaught(was)||wasTaught(now));}
function check(){hint(f.opens,f.opensWk);hint(f.due,f.dueWk);
  var bad=!f.due.value?'It needs a due date.':f.opens.value&&f.opens.value>f.due.value?'It would open after it is due.':
    frozen(orig.opens,f.opens.value)?'Its opening would move into or out of a week already taught.':
    frozen(orig.due,f.due.value)?'Its due date would move into or out of a week already taught.':'';
  f.error.textContent=bad;f.error.hidden=!bad;f.save.disabled=!!bad;
  f.sum.textContent=(f.opens.value?'Opens '+when(f.opens.value)+' \\u00b7 ':'')+'due '+when(f.due.value);}
f.opens.addEventListener('input',check);f.due.addEventListener('input',check);
// Brief after a drop: where it lands, Save or Cancel. Full from the due
// line's button, or from "Change dates".
function open(id,opens,due,week,x,y,from){var it=items[id];if(!it)return;
  form.setAttribute('data-id',id);f.title.textContent=it.title||id;orig={opens:local(it.opens_at),due:local(it.due_at)};
  var r=week?rowOf(week):null,brief=from!==undefined;
  f.week.textContent=!r?'':(brief&&from?'Week '+from+' \\u2192 week '+r.n:'Week '+r.n)+' \\u00b7 '+nice(r.from)+' \\u2013 '+nice(r.to);
  form.classList.toggle('brief',brief);
  f.opens.value=opens||'';f.due.value=due||'';f.save.textContent=brief?'Save':'Save dates';check();
  form.hidden=false;var w=form.offsetWidth,h=form.offsetHeight;
  form.style.left=Math.max(12,Math.min(x+14,innerWidth-w-12))+'px';form.style.top=Math.max(12,Math.min(y+14,innerHeight-h-12))+'px';
  if(brief)f.save.focus();else(due?f.due:f.opens).focus();}
form.querySelector('.pf-more').addEventListener('click',function(){form.classList.remove('brief');f.save.textContent='Save dates';f.due.focus();});
function close(){form.hidden=true;form.removeAttribute('data-id');target(null);}
form.querySelector('.pf-cancel').addEventListener('click',close);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!form.hidden){e.stopPropagation();close();}});
f.save.addEventListener('click',function(){var id=form.getAttribute('data-id'),it=items[id];if(!it||f.save.disabled)return;
  parent.postMessage({source:'professor-pane',kind:'dates',assessment:id,
    opens_at:f.opens.value?f.opens.value+':00'+offOf(it.opens_at||it.due_at):'',due_at:f.due.value+':00'+offOf(it.due_at)},'*');
  f.save.disabled=true;f.save.textContent='Saving\\u2026';});
document.addEventListener('mousedown',function(e){
  if(!form.hidden&&!form.contains(e.target)&&!(e.target.closest&&e.target.closest('[data-edit]')))close();},true);
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-edit]');if(!b)return;
  e.preventDefault();var id=b.getAttribute('data-edit'),it=items[id];if(!it)return;var r=b.getBoundingClientRect();
  open(id,local(it.opens_at),local(it.due_at),it.due_at?weekOf(it.due_at.slice(0,10)):null,r.left,r.bottom);});
var grip=null,drag=null,over=null;
document.addEventListener('mousedown',function(e){grip=e.target.closest&&e.target.closest('[data-edge]');},true);
function lift(id,on){document.querySelectorAll('[data-a="'+id+'"],[data-m="'+id+'"]').forEach(function(s){s.classList.toggle('lifted',on);});}
function end(){if(over)over.classList.remove('drop');over=null;if(drag)lift(drag.id,false);drag=null;}
document.addEventListener('dragstart',function(e){
  var t=e.target.closest&&e.target.closest('[data-m][draggable="true"]');
  if(t&&topics[t.getAttribute('data-m')]){var m=t.getAttribute('data-m');close();tclose();
    drag={topic:true,id:m,from:+t.getAttribute('data-wk')};
    e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',m);}catch(x){}
    setTimeout(function(){if(drag)lift(m,true);},0);return;}
  var el=e.target.closest&&e.target.closest('[data-a][draggable="true"]');if(!el||!items[el.getAttribute('data-a')])return;
  var id=el.getAttribute('data-a'),edge=grip&&el.contains(grip)?grip.getAttribute('data-edge'):'both';
  // Opened in a week already taught: the bar stays, its due end moves.
  if(items[id].hold==='opens'&&edge!=='due'){e.preventDefault();say('It opened in a week already taught \\u2014 drag its due end instead.');return;}
  close();tclose();
  drag={id:id,edge:edge,from:+el.getAttribute('data-wk')||null};
  e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',id);}catch(x){}
  setTimeout(function(){if(drag)lift(id,true);},0);});
// A week already taught takes no drop: no preventDefault, so the cursor
// says so, and the row is not lit.
function rowAt(e){var r=e.target.closest&&e.target.closest('tr[data-week]');return r&&!r.hasAttribute('data-taught')?r:null;}
var refused=false;
document.addEventListener('dragover',function(e){if(!drag)return;var r=rowAt(e);
  refused=!r&&!!(e.target.closest&&e.target.closest('tr[data-taught]'));
  if(!r){if(over){over.classList.remove('drop');over=null;}return;}
  e.preventDefault();e.dataTransfer.dropEffect='move';if(over!==r){if(over)over.classList.remove('drop');over=r;r.classList.add('drop');}});
document.addEventListener('dragleave',function(e){if(over&&!(e.relatedTarget&&over.contains(e.relatedTarget))){over.classList.remove('drop');over=null;}});
document.addEventListener('drop',function(e){if(!drag)return;var r=rowAt(e);if(!r)return;
  e.preventDefault();var d=drag,to=+r.getAttribute('data-week'),it=items[d.id],row=rowOf(to);end();
  if(d.topic){if(to!==d.from){target(r);topen(d.id,to,e.clientX,e.clientY);}return;}
  var opens=local(it.opens_at),due=local(it.due_at);
  if(!it.due_at){opens='';due=row.to+'T23:59';}
  else if(d.from!==null){if(to===d.from)return;var n=(to-d.from)*7;if(d.edge!=='due')opens=shift(opens,n);if(d.edge!=='opens')due=shift(due,n);}
  target(r);open(d.id,opens,due,to,e.clientX,e.clientY,d.from);});
// Let go over a taught week: nothing dropped, and the page says why.
document.addEventListener('dragend',function(){if(drag&&refused)say('That week is already taught; nothing moves into it.');refused=false;end();});
var tf=document.querySelector('.topicform');
var g={title:tf.querySelector('.tf-title'),week:tf.querySelector('.tf-week'),list:tf.querySelector('.tf-meetings'),swap:tf.querySelector('.tf-swap'),
  swapOn:tf.querySelector('.tf-swap-on'),other:tf.querySelector('.tf-other'),error:tf.querySelector('.tf-error'),save:tf.querySelector('.tf-save'),sum:tf.querySelector('.tf-sum')};
var plan=null;
function cap(s){s=String(s||'meeting').replace(/_/g,' ');return s.charAt(0).toUpperCase()+s.slice(1);}
function rows_(box,mid,from,to){box.innerHTML='';var t=topics[mid];
  t.meetings.forEach(function(x){var l=document.createElement('label'),s=document.createElement('span'),i=document.createElement('input'),h=document.createElement('small');
    s.textContent=cap(x.type)+(x.group?' \\u00b7 '+x.group:'');s.title=x.activity;i.type='datetime-local';i.setAttribute('data-act',x.activity);i.setAttribute('data-want',to);
    i.value=x.scheduled_at?shift(local(x.scheduled_at),(to-from)*7):'';i.addEventListener('input',tcheck);l.appendChild(s);l.appendChild(i);l.appendChild(h);box.appendChild(l);});
  if(!t.meetings.length){var p=document.createElement('small');p.textContent='No meetings to move.';box.appendChild(p);}}
function tcheck(){var bad='';tf.querySelectorAll('input[data-act]').forEach(function(i){var h=i.nextSibling;
    if(i.closest('.tf-other[hidden]'))return;if(!i.value){h.textContent='no date';h.classList.remove('off');return;}
    var w=weekOf(i.value.slice(0,10)),want=+i.getAttribute('data-want');
    h.textContent=w?'week '+w+' \\u00b7 '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(i.value.slice(0,10)+'T12:00:00Z').getUTCDay()]+(w!==want?' \\u2014 not this topic\\u2019s week':''):'outside the term';
    h.classList.toggle('off',w!==want);if(w!==want)bad='A meeting would fall outside its topic\\u2019s week, and show as misdated.';});
  g.error.textContent=bad;g.error.hidden=!bad;}
function topen(mid,to,x,y){var t=topics[mid];if(!t)return;var r=rowOf(to);
  plan={id:mid,from:t.week,to:to,other:null};
  g.title.textContent=t.title;g.week.textContent='Week '+t.week+' \\u2192 week '+to+' \\u00b7 '+nice(r.from)+' \\u2013 '+nice(r.to);
  rows_(g.list,mid,t.week,to);
  var there=Object.keys(topics).filter(function(k){return k!==mid&&topics[k].week===to;});
  if(there.length===1){plan.other=there[0];g.swap.hidden=false;g.swapOn.checked=true;
    g.swap.querySelector('span').textContent='Swap with \\u201c'+topics[there[0]].title+'\\u201d \\u2014 it moves to week '+t.week+' with its meetings';
    rows_(g.other,there[0],to,t.week);g.other.hidden=false;}
  else{g.swap.hidden=true;g.swapOn.checked=false;g.other.hidden=true;g.other.innerHTML='';
    if(there.length>1){g.swap.hidden=false;g.swapOn.disabled=true;g.swap.querySelector('span').textContent='Week '+to+' already has '+there.length+' topics; this one joins them.';}}
  g.swapOn.disabled=there.length!==1;g.save.disabled=false;g.save.textContent='Save';
  var k=t.meetings.length;g.sum.textContent=k?'Its '+(k===1?'meeting moves':k+' meetings move')+' with it, same days and times.':'It has no meetings to move.';
  tf.querySelector('.tf-more').style.display=k?'':'none';
  tf.classList.add('brief');tcheck();
  tf.hidden=false;var w=tf.offsetWidth,h=tf.offsetHeight;
  tf.style.left=Math.max(12,Math.min(x+14,innerWidth-w-12))+'px';tf.style.top=Math.max(12,Math.min(y+14,innerHeight-h-12))+'px';
  g.save.focus();}
tf.querySelector('.tf-more').addEventListener('click',function(){tf.classList.remove('brief');var first=tf.querySelector('input[data-act]');if(first)first.focus();});
function tclose(){tf.hidden=true;plan=null;target(null);}
g.swapOn.addEventListener('change',function(){g.other.hidden=!g.swapOn.checked;tcheck();});
tf.querySelector('.tf-cancel').addEventListener('click',tclose);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!tf.hidden){e.stopPropagation();tclose();}});
document.addEventListener('mousedown',function(e){if(!tf.hidden&&!tf.contains(e.target))tclose();},true);
function stamps(box,mid){var out=[];box.querySelectorAll('input[data-act]').forEach(function(i){if(!i.value)return;
  var x=topics[mid].meetings.filter(function(m){return m.activity===i.getAttribute('data-act');})[0];
  out.push({activity:x.activity,scheduled_at:i.value+':00'+offOf(x.scheduled_at)});});return out;}
g.save.addEventListener('click',function(){if(!plan||g.save.disabled)return;
  var moves=[{module:plan.id,week:plan.to,meetings:stamps(g.list,plan.id)}];
  if(plan.other&&g.swapOn.checked)moves.push({module:plan.other,week:plan.from,meetings:stamps(g.other,plan.other)});
  parent.postMessage({source:'professor-pane',kind:'topic',moves:moves},'*');
  g.save.disabled=true;g.save.textContent='Moving\\u2026';});
})();<\/script>`;

// ------------------------------------------------------------------ prompts

// -------------------------------------------------------------------- parts

const gapChip = (kind, tier, prompt, title, label) =>
  `<button type="button" class="chip gap ${tier}" data-ask="${esc(prompt)}" title="${esc(title)}">` +
  `${icon(GAP[kind].icon)}${esc(label ?? GAP[kind].verb)}</button>`;

/** A material: a link the harness opens over itself when it can paint it. */
const materialChip = (r) => {
  const deck = r.kind === "slides";
  const cls = `chip${deck ? " deck" : ""}${r.draft ? " draft" : ""}`;
  const label = deck ? "Slides" : r.title;
  const what = RESOURCE_WORD[r.kind] ?? r.kind;
  const body = `${icon(RESOURCE_ICON[r.kind] ?? "file")}${esc(label)}${r.draft ? ' <span class="k">draft</span>' : ""}`;
  const out = [];
  if (r.url) {
    out.push(
      `<a class="${cls}" href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(`${what} · ${r.title}`)}"` +
        (r.viewable ? ` data-view="${esc(r.title)}" data-format="${esc(r.format)}"` : "") + `>${body}</a>`,
    );
  } else {
    out.push(`<span class="${cls}" title="${esc(what)}">${body}</span>`);
  }
  for (const f of (r.formats ?? []).slice(1)) {
    if (!f.url) continue;
    out.push(
      `<a class="chip fmt" href="${esc(f.url)}" target="_blank" rel="noopener"` +
        (f.viewable ? ` data-view="${esc(`${r.title} · ${f.label}`)}" data-format="${esc(f.format)}"` : "") +
        `>${esc(f.label)}</a>`,
    );
  }
  return out.join("");
};

/** A piece of graded work: when, what kind, what, and what it is worth. */
const workChip = (a, when) => {
  const kind = WORK_WORD[a.type] ?? a.type ?? "work";
  const cls = `chip${a.draft ? " draft" : ""}`;
  const body =
    `<span class="k mono">${esc(when)}</span><span class="tag">${icon(WORK_ICON[a.type] ?? "file")}${esc(kind)}</span>` +
    `${esc(a.title)}${a.draft ? ' <span class="k">draft</span>' : ""}<span class="wt">${esc(weightPct(a.weight))}</span>`;
  // The brief document when there is one the harness can paint, else the
  // record's own text as the page the pane serves it as.
  // An exam with versions opens all of them in one overlay — tabs, or side by
  // side — rather than the one its record happens to name.
  const papers = Array.isArray(a.papers) && a.papers.length > 1 ? a.papers : null;
  if (papers) {
    return `<a class="${cls}" href="${esc(papers[0].url)}" target="_blank" rel="noopener" data-view="${esc(a.title)}" ` +
      `data-format="${esc(papers[0].format)}" data-papers="${esc(JSON.stringify(papers))}" ` +
      `title="open the ${papers.length} versions">${body}</a>`;
  }
  const href = a.viewable && a.url ? a.url : a.brief_url;
  if (href) {
    const format = a.viewable && a.url ? a.format : "html";
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" data-view="${esc(a.title)}" ` +
      `data-format="${esc(format)}" title="open the brief">${body}</a>`;
  }
  return `<span class="${cls}">${body}</span>`;
};

/**
 * Where a piece of graded work stands, under its chip: the host's figures
 * (`server/week-status.js`) said as words, each with the press that goes with
 * it. A press opens one of the pane's own windows over course mode — Grade,
 * Scans, Publish, the defence desk — and asks the chat nothing. Absent in the
 * student preview and in Planning, where the host sends no status.
 */
/** A pile's steps: parts.jsx's `ScanSteps`, as a string. */
const scanSteps = (id, label, scans, graded) => {
  const act = scans.act;
  const opensScans = act && act.kind === "scans";
  const steps = scans.steps ?? [];
  const strip = esc(steps.map((step) => `${step.label}: ${step.detail}`).join("\n"));
  const dots = steps.length
    ? `<span class="steps" role="img" aria-label="${strip}" title="${strip}">${steps.map((step) => `<i class="${esc(step.state)}"></i>`).join("")}</span>`
    : "";
  let action = "";
  if (act && act.kind === "ask") {
    action = `<button type="button" class="chip act" data-ask="${esc(act.prompt)}" title="${esc(act.prompt)}">${icon("ask")}${esc(act.label)}</button>`;
  } else if (act && act.kind === "grade" && !graded) {
    action = `<button type="button" class="chip act" data-grade="${id}" data-label="${label}" title="Open the Grade view">${esc(act.label)}</button>`;
  } else if (opensScans) {
    action = `<button type="button" class="chip act" data-scans="${id}" title="Open the pile in Scans, on this step">${esc(act.label)}</button>`;
  }
  return dots +
    `<span class="stat${scans.whose === "you" ? " yours" : ""}">${esc(scans.phrase)}${scans.whose === "assistant" ? " · the assistant's" : ""}</span>` +
    action +
    (opensScans ? "" : `<button type="button" class="chip act" data-scans="${id}" title="Open the pile in Scans">Scans</button>`);
};

const statusLine = (a, status) => {
  const st = status ? status[a.assessment_id] : null;
  if (!st) return "";
  const id = esc(a.assessment_id);
  const label = esc(a.title ?? a.assessment_id);
  const parts = [];
  if (st.grading) {
    parts.push(`<span class="stat">${st.grading.suggested} suggested · ${st.grading.decided} decided</span>` +
      `<button type="button" class="chip act" data-grade="${id}" data-label="${label}" title="Open the Grade view">Grade</button>`);
  }
  if (st.scans && st.scans.none) {
    parts.push(`<span class="stat">no scans yet</span>` +
      `<button type="button" class="chip act" data-upload="${id}" data-label="${label}" title="Upload the scanned papers of ${label}">Upload scans…</button>`);
  } else if (st.scans) {
    parts.push(scanSteps(id, label, st.scans, Boolean(st.grading)));
  }
  if (st.defences) {
    parts.push(`<span class="stat">${st.defences.defended} of ${st.defences.of} defended</span>` +
      (st.defences.student
        ? `<button type="button" class="chip act" data-desk="${id}" data-student="${esc(st.defences.student)}" ` +
          `title="${esc(`The defence desk, on ${st.defences.student}`)}">Open defence desk</button>`
        : ""));
  }
  if (st.canvas) {
    parts.push(`<span class="badge">${st.canvas === "some" ? "not in every Canvas course yet" : "not in Canvas yet"}</span>` +
      `<button type="button" class="chip act" data-publish="${id}" data-target="canvas" data-label="${label}" ` +
      `title="Send its definition to Canvas — reads a plan first">publish…</button>`);
  }
  if (st.repo) {
    parts.push(`<span class="badge">no starter repository yet</span>` +
      `<button type="button" class="chip act" data-publish="${id}" data-target="homework" data-label="${label}" ` +
      `title="Create the starter repository on GitHub — reads a plan first">publish…</button>`);
  }
  return parts.length ? `<span class="status">${parts.join("")}</span>` : "";
};

const askButton = (prompt, label, cls = "chip ask") =>
  `<button type="button" class="${cls}" data-ask="${esc(prompt)}">${icon("ask")}${esc(label)}</button>`;

// ---------------------------------------------------------------- planning

/**
 * Does the term hold together — asked at the start of a term, of the term as
 * a structure. The weights against a whole, one row per week with its topic
 * and the graded work running through it as lanes, and the faults said as
 * sentences with one press each. No rooms, times or decks: those are
 * teaching questions. Built from the outline payload alone, so it carries
 * nothing derived from student work.
 */
const planningBody = (data, { student, locks }) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const weekOf = (date) => (date ? weeks.find((w) => date >= w.starts_on && date <= w.ends_on)?.week ?? null : null);
  // Dates move by hand here, except in the student preview, which shows the
  // record and nothing that changes it.
  const editable = !student;
  // The guardrails (`planLocks` in plan-writes.js, which enforces them again):
  // work with results keeps its dates, and a week already taught is history.
  const withResults = new Set(locks?.results ?? []);
  const taught = (n) => n !== null && weeks.find((w) => w.week === n)?.when === "past";
  const offset = runOffset(data);

  // Weights by kind of work, against the model's own total and verdict.
  const groups = [];
  for (const a of data.assessments ?? []) {
    const [name] = kindOf(a.type);
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, weight: 0, count: 0, unweighted: 0 }));
    g.count += 1;
    if (a.weight === null || a.weight === undefined) g.unweighted += 1;
    else g.weight += a.weight;
  }
  const grading = data.grading ?? {};
  const cards =
    groups
      .map((g) => `<div class="wcard"><small>${esc(g.name)}</small><b>${esc(weightPct(g.weight) || "—")}</b>` +
        `<small>${g.count} ${g.count === 1 ? "item" : "items"}${g.unweighted ? ` · ${g.unweighted} with no weight` : ""}</small></div>`)
      .join("") +
    `<div class="wcard ${grading.complete ? "ok" : "bad"}"><small>Total</small><b>${esc(weightPct(grading.total_weight) || "—")}</b>` +
    `<small>${grading.complete ? "weights add up" : "does not add up"}</small></div>`;

  // A span per piece of graded work, the week it opens to the week it is due.
  const spans = (data.assessments ?? []).map((a) => {
    const end = weekOf(a.due_on);
    return { a, lane: laneOf(a.type), start: weekOf(a.opens_on) ?? end, end };
  });
  const lanes = LANES.concat([["other", "Other", "ot"]]).filter((l) => spans.some((s) => s.lane[1] === l[1]));

  // Work with no due date has no bar. It waits in a tray above the table,
  // from which it is dragged onto a week like any bar.
  const undated = [...weeks.flatMap((w) => w.undated ?? []), ...(data.unplaced?.assessments ?? [])]
    .filter((a, i, all) => all.findIndex((b) => b.assessment_id === a.assessment_id) === i);

  // Faults, as sentences. Unplanned runs, quiet runs, undated work, weights.
  const faults = [];
  if (!student) {
    const unplanned = weeks.filter((w) => (w.gaps ?? []).some((g) => g.kind === "module")).map((w) => w.week);
    const runsOf = (list) =>
      list.reduce((all, n) => {
        const last = all[all.length - 1];
        if (last && last[last.length - 1] === n - 1) last.push(n);
        else all.push([n]);
        return all;
      }, []);
    for (const r of runsOf(unplanned)) {
      const span = r.length === 1 ? `Week ${r[0]}` : `Weeks ${r[0]}–${r[r.length - 1]}`;
      faults.push(["flag", "module", `${span} ${r.length === 1 ? "has" : "have"} no topic`,
        `${span} of ${run.id} ${r.length === 1 ? "has" : "have"} no module. Propose what ${r.length === 1 ? "it" : "they"} should teach, ` +
          "given what comes before and what falls due, as draft modules for me to read.",
        r.length === 1 ? `Plan week ${r[0]}` : "Plan these weeks"]);
    }
    const graded = new Set();
    for (const s of spans) if (s.start !== null && s.end !== null) for (let n = s.start; n <= s.end; n += 1) graded.add(n);
    for (const r of runsOf(weeks.map((w) => w.week).filter((n) => !graded.has(n))).filter((r) => r.length >= 2)) {
      const span = `Weeks ${r[0]}–${r[r.length - 1]}`;
      faults.push(["warn", "quiz", `${span}: nothing graded opens, runs or falls due`,
        `${span} of ${run.id} have no graded work opening, running or falling due. Should something be assessed ` +
          "there, given what those weeks teach? Propose it as a draft; change nothing else.",
        "Suggest an assessment"]);
    }
    // Undated work is set here, by hand, rather than asked of the session:
    // the two dates are the professor's and nothing on disk knows them.
    for (const a of undated) faults.push(["flag", "calendar", `${a.title} has no dates`, null, "Set dates", a.assessment_id]);
    if (!grading.complete) {
      faults.push(["flag", "weight", grading.note || "The weights do not add up to 100%",
        `The weights in ${run.id} do not settle the grading policy: ${grading.note || "they do not add up"} ` +
          "Propose a correction and wait.", "Fix the weights"]);
    }
  }
  const faultList = student
    ? ""
    : faults.length
      ? `<ul class="faults">${faults
          .map(([tone, ic, text, prompt, verb, dated]) =>
            `<li class="${tone}">${icon(ic)}<span>${esc(text)}</span>${
              dated
                ? `<button type="button" class="chip ask strong" data-edit="${esc(dated)}">${icon("calendar")}${esc(verb)}</button>`
                : askButton(prompt, verb, "chip ask strong")
            }</li>`)
          .join("")}</ul>`
      : '<p class="calm">Every week has a topic, the graded work is spread, and the weights add up.</p>';

  const rows = weeks
    .map((w) => {
      const title = titleOf(w);
      const n = conceptsOf(w).length;
      const draft = (w.modules ?? []).some((m) => m.draft);
      const lanesHtml = lanes
        .map((l) => {
          const here = spans.filter((s) => s.lane[1] === l[1] && s.start !== null && w.week >= s.start && w.week <= s.end);
          return `<td class="lane">${here
            .map((s) => {
              const first = w.week === s.start;
              const last = w.week === s.end;
              const href = s.a.viewable && s.a.url ? s.a.url : s.a.brief_url;
              const id = esc(s.a.assessment_id);
              // Locked: results recorded, or due in a week already taught.
              // Opened in one but due later: only its due end moves.
              const locked = withResults.has(s.a.assessment_id) || taught(s.end);
              const why = withResults.has(s.a.assessment_id)
                ? "has results — its dates stay"
                : "due in a week already taught";
              const movable = editable && !locked;
              // The title opens the brief; the due line opens the date form.
              // Neither is draggable itself, so a drag always moves the bar.
              const title = !first
                ? ""
                : href
                  ? `<a class="segt" draggable="false" href="${esc(href)}" target="_blank" rel="noopener" data-view="${esc(s.a.title)}" ` +
                    `data-format="${esc(s.a.viewable && s.a.url ? s.a.format : "html")}">${esc(s.a.title)}</a>`
                  : `<span class="segt">${esc(s.a.title)}</span>`;
              const dueWords = `due ${esc(shortDate(s.a.due_on))} · ${esc(weightPct(s.a.weight) || "no weight")}`;
              const due = !last
                ? ""
                : movable
                  ? `<button type="button" class="segd" data-edit="${id}" title="Change the dates">${dueWords}</button>`
                  : `<span class="segd">${dueWords}</span>`;
              // Grips on the ends: the top one moves only the opening, the
              // bottom one only the due date. Work with no opening date, or
              // one outside the term, has no top grip: the bar's top is then
              // its due week, and there is no opening there to move. Nor
              // does one that opened in a week already taught.
              const grips = movable
                ? (first && s.a.opens_on && weekOf(s.a.opens_on) === s.start && !taught(s.start) ? `<span class="grip top" data-edge="opens" title="Drag to move when it opens"></span>` : "") +
                  (last ? `<span class="grip bottom" data-edge="due" title="Drag to move when it is due"></span>` : "")
                : "";
              const cls = `lseg ${kindOf(s.a.type)[1]}${first ? " first" : ""}${last ? " last" : ""}${s.a.draft ? " draft" : ""}${editable && locked ? " locked" : ""}`;
              const tip = `${s.a.title}${s.a.opens_on ? " · opens " + shortDate(s.a.opens_on) : ""} · due ${shortDate(s.a.due_on)}` +
                (!editable ? "" : locked ? ` — ${why}` : taught(s.start) ? " — opened in a week already taught; drag its due end" : " — drag to another week");
              return `<div class="${cls}" data-a="${id}" data-wk="${w.week}"${movable ? ' draggable="true"' : ""} title="${esc(tip)}">` +
                `${grips}${title}${due}</div>`;
            })
            .join("")}</td>`;
        })
        .join("");
      return `<tr class="${w.when === "current" ? "now" : ""}" data-week="${w.week}" data-from="${esc(w.starts_on)}" data-to="${esc(w.ends_on)}"` +
        `${taught(w.week) ? ' data-taught="1" title="Already taught: nothing moves into or out of this week"' : ""}>` +
        `<td class="wkn"><b>${w.week}</b><small>${esc(shortDate(w.starts_on))}</small></td>` +
        `<td class="topic">${
          !title
            ? '<span class="notopic">No topic yet</span>'
            : editable && !taught(w.week)
              // One handle per module, since a week may hold two and each
              // moves on its own.
              ? (w.modules ?? [])
                  .map((m) => `<span class="tchip${m.draft ? " draftword" : ""}" draggable="true" data-m="${esc(m.module_id)}" ` +
                    `data-wk="${w.week}" title="Drag to another week — its meetings move with it">${esc(m.title)}</span>`)
                  .join('<span class="dash"> · </span>') +
                (n ? `<small>${n} ${n === 1 ? "concept" : "concepts"}</small>` : "") + (draft ? "<small>draft</small>" : "")
              : `<span class="${draft ? "draftword" : ""}">${esc(title)}</span>${n ? `<small>${n} ${n === 1 ? "concept" : "concepts"}</small>` : ""}${draft ? "<small>draft</small>" : ""}`
        }</td>${lanesHtml}</tr>`;
    })
    .join("");

  // What the page's script needs to move a piece of work: its two dates as
  // the record holds them. A JSON island rather than attributes on every
  // segment, because a bar is drawn once per week it runs through.
  const items = {};
  for (const a of [...(data.assessments ?? []), ...undated]) {
    items[a.assessment_id] = {
      title: a.title,
      opens_at: a.opens_at ?? null,
      due_at: a.due_at ?? null,
      // Opened in a week already taught: the opening stays, the due end moves.
      ...(taught(weekOf(a.opens_on)) ? { hold: "opens" } : {}),
    };
  }
  // And to move a topic: the week it is on and the meetings that teach it,
  // which are the ones the outline drew under that week for that module.
  const topics = {};
  for (const w of weeks) {
    for (const m of w.modules ?? []) {
      topics[m.module_id] = {
        title: m.title,
        week: w.week,
        meetings: (w.meetings ?? [])
          .filter((x) => x.module_id === m.module_id)
          .map((x) => ({ activity: x.activity_id, type: x.type, group: x.group ?? null, scheduled_at: x.scheduled_at ?? null })),
      };
    }
  }
  const tray = editable && undated.length
    ? `<div class="tray"><b>${icon("calendar")}Not on the calendar</b>${undated
        .map((a) => `<span class="chip traychip" draggable="true" data-a="${esc(a.assessment_id)}" title="Drag onto a week">` +
          `${icon(WORK_ICON[a.type] ?? "file")}${esc(a.title)}</span>`)
        .join("")}<small>Drag one onto a week, then settle the day.</small></div>`
    : "";
  const form = editable
    // Each form has two faces. After a drop it is brief — where it lands and
    // Save or Cancel (`.brief`); "Change dates" opens the inputs, which is
    // also how the due line's button opens it.
    ? `<div class="planform" hidden role="dialog" aria-label="Dates"><b class="pf-title"></b><small class="pf-week"></small>` +
      `<p class="pf-sum"></p>` +
      `<div class="pf-fields"><label><span>Opens</span><input type="datetime-local" class="pf-opens"><small class="pf-opens-wk"></small></label>` +
      `<label><span>Due</span><input type="datetime-local" class="pf-due" required><small class="pf-due-wk"></small></label></div>` +
      `<p class="pf-error" hidden></p><div class="pf-actions"><button type="button" class="primary pf-save">Save</button>` +
      `<button type="button" class="chip pf-cancel">Cancel</button></div>` +
      `<button type="button" class="pf-more">Change dates</button>` +
      `<small class="pf-note">Writes opens_at and due_at into its record. Canvas keeps its own copy until the definition is sent again.</small></div>` +
      `<div class="planform topicform" hidden role="dialog" aria-label="Move topic"><b class="tf-title"></b><small class="tf-week"></small>` +
      `<p class="pf-sum tf-sum"></p>` +
      `<div class="tf-meetings"></div><label class="tf-swap" hidden><input type="checkbox" class="tf-swap-on"><span></span></label>` +
      `<div class="tf-other" hidden></div><p class="pf-error tf-error" hidden></p>` +
      `<div class="pf-actions"><button type="button" class="primary tf-save">Save</button>` +
      `<button type="button" class="chip tf-cancel">Cancel</button></div>` +
      `<button type="button" class="pf-more tf-more">Change meeting times</button>` +
      `<small class="pf-note">Writes the module's week and its meetings' dates. Slides and graded work keep theirs.</small></div>` +
      `<script type="application/json" id="plan-items">${JSON.stringify(items).replace(/</g, "\\u003c")}</script>` +
      `<script type="application/json" id="plan-topics">${JSON.stringify(topics).replace(/</g, "\\u003c")}</script>`
    : "";

  return `<div class="mode"><div class="weights">${cards}</div>${faultList}${tray}` +
    `<table class="plan" data-offset="${esc(offset)}"><thead><tr><th>Week</th><th>Topic</th>${lanes
      .map((l) => `<th class="lanehead ${l[2]}">${esc(l[1])}</th>`)
      .join("")}</tr></thead><tbody>${rows}</tbody></table>` +
    `<p class="foot">Each bar runs from the week a piece of work opens to the week it is due.${
      editable
        ? " Drag a bar to another week to move both dates — the weekday and the time come with it. Drag its top edge to move" +
          " only the opening, its bottom edge to move only the due date, and press the due line to set the day by hand." +
          " Drag a topic to another week and its meetings move with it, or trade places with the topic already there."
        : ""
    } Rooms, times and decks are in Teaching.</p>${form}</div>`;
};

// ---------------------------------------------------------------- teaching

/**
 * One week between its neighbours — asked during the term. The week in focus
 * is the large card; the one before says what was taught and handed in and
 * how its concepts landed, the one after what has to be ready. Every week of
 * the term is rendered, and the page's script shows one trio at a time, so
 * ‹ › needs no round trip.
 *
 * Private. It carries class figures — a concept's class mean over approved
 * evidence, how much of a piece of work has been handed in, the open signals —
 * which is why it is a mode of its own, behind the pane, and never part of a
 * document a student may be shown.
 */
const teachingBody = (data, evidence, status, focus = null) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const current = data.current_week ?? null;
  const at = (n) => weeks.find((w) => w.week === n) ?? null;
  const concepts = evidence.concepts ?? {};
  const handed = evidence.handed_in ?? {};
  const signals = evidence.signals ?? [];

  // One status line per piece of work in a week: on its due line when it is
  // due in the same week it opens.
  const workLine = (a, verb, date, withHanded, week) => {
    const h = handed[a.assessment_id];
    return `<li>${workChip(a, `${verb} ${shortDate(date)}`)}` +
      (withHanded && h && h.enrolled ? `<small>${h.received} of ${h.enrolled} handed in</small>` : "") +
      (withHanded || !(week?.due ?? []).some((d) => d.assessment_id === a.assessment_id) ? statusLine(a, status) : "") + "</li>";
  };
  const deckNeed = (w) => {
    const meets = w.meetings ?? [];
    if (!meets.length || meets.some((m) => (m.resources ?? []).some((r) => r.kind === "slides"))) return "";
    return `<div class="need">${icon("slides")}<span>No slides yet</span>${askButton(promptFor("deck", w, run), "Draft slides", "chip ask strong")}</div>`;
  };
  const meetingLine = (m) =>
    `<li>${icon(MEETING_ICON[m.type] ?? "lecture")}<span>${esc(shortDate(m.on) || "no date")} · ${esc(m.type)}</span>` +
    `<small>${esc(m.location ?? "")}</small></li>`;

  const side = (w, label) => {
    if (!w) return `<div class="side empty"><small>${esc(label)}</small><p>Outside the run.</p></div>`;
    const taught = current !== null && w.week < current;
    const ev = taught
      ? conceptsOf(w)
          .map((c) => {
            const x = concepts[c.id];
            return `<li>${icon("concept")}<span>${esc(c.title ?? c.id)}</span><small>${
              x && x.class_mean !== null && x.class_mean !== undefined
                ? `class ${esc(pct(x.class_mean))} · ${esc(x.coverage ?? "")}`
                : "not assessed yet"
            }</small></li>`;
          })
          .join("")
      : "";
    return `<div class="side"><small>${esc(label)} · week ${w.week}</small><b>${esc(titleOf(w) || "No topic yet")}</b>` +
      `<ul class="facts">${(w.meetings ?? []).map(meetingLine).join("")}` +
      (w.opens ?? []).map((a) => workLine(a, "opens", a.opens_on, false, w)).join("") +
      (w.due ?? []).map((a) => workLine(a, "due", a.due_on, true)).join("") + ev + "</ul>" +
      deckNeed(w) + `<button type="button" class="link" data-goto="${w.week}">Make this the focus ›</button></div>`;
  };

  const focusCard = (w) => {
    const misdated = (w.gaps ?? []).find((g) => g.kind === "misdated");
    const off = misdated
      ? misdated.ids
          .map((id) => {
            const m = (w.meetings ?? []).find((x) => x.activity_id === id) ?? {};
            const word = m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "A meeting";
            return `<div class="need warn" title="${esc(misdated.note)}">${icon("misdated")}<span>${esc(word)} dated ${esc(shortDate(m.on))}, ${
              m.on < w.starts_on ? `before this week starts (${esc(shortDate(w.starts_on))})` : `after this week ends (${esc(shortDate(w.ends_on))})`
            }</span>${askButton(promptFor("misdated", w, run, id), "Check date", "chip ask strong")}</div>`;
          })
          .join("")
      : "";
    const meetings = (w.meetings ?? [])
      .map((m) => {
        const resources = [...(m.resources ?? [])].sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
        return `<li>${icon(MEETING_ICON[m.type] ?? "lecture")}<span>${esc(shortDate(m.on) || "no date")} · ${esc(
          [m.type, m.location].filter(Boolean).join(" · "),
        )}</span>${resources.map(materialChip).join("")}</li>`;
      })
      .join("");
    const work = [
      ...(w.opens ?? []).map((a) => workLine(a, "opens", a.opens_on, false, w)),
      ...(w.due ?? []).map((a) => workLine(a, "due", a.due_on, true)),
    ].join("");
    // What to repair before building on it: concepts taught in the two weeks
    // before the focus whose class mean sits under the line.
    const revisit = [w.week - 1, w.week - 2]
      .map(at)
      .filter(Boolean)
      .flatMap((p) =>
        conceptsOf(p)
          .map((c) => ({ c, x: concepts[c.id], week: p.week }))
          .filter(({ x }) => x && x.class_mean !== null && x.class_mean !== undefined && x.class_mean < REVISIT_BELOW),
      );
    const module = (w.modules ?? [])[0];
    const prepare =
      `For week ${w.week} of ${run.id}${module ? ` (${module.module_id})` : ""}, what should I teach and what should I revisit first?` +
      (revisit.length ? ` The class is weakest on ${revisit.map((r) => r.c.title ?? r.c.id).join(" and ")}.` : "");
    return `<div class="focus"><small>${w.week === current ? "This week" : `Week ${w.week}`} · ${esc(shortDate(w.starts_on))} – ${esc(shortDate(w.ends_on))}</small>` +
      `<h2>${esc(titleOf(w) || "No topic yet")}</h2>` +
      (conceptsOf(w).length ? `<div class="concepts">${icon("concept")}${conceptsOf(w).map((c) => `<span class="chip concept">${esc(c.title ?? c.id)}</span>`).join("")}</div>` : "") +
      (meetings ? `<ul class="facts big">${meetings}</ul>` : '<p class="calm">No meeting this week.</p>') +
      off + deckNeed(w) +
      (work ? `<ul class="facts">${work}</ul>` : '<p class="calm">Nothing graded opens or falls due this week.</p>') +
      (revisit.length || signals.length
        ? `<div class="revisit"><b>Revisit first</b>${revisit
            .map((r) => `<p>${esc(r.c.title ?? r.c.id)} — class ${esc(pct(r.x.class_mean))} on ${esc(r.x.coverage ?? "")} observed, taught in week ${r.week}</p>`)
            .join("")}${signals.length ? `<p>${signals.length} open signal${signals.length === 1 ? "" : "s"}: ${esc(signals[0].description ?? "")}</p>` : ""}</div>`
        : "") +
      askButton(prepare, "Prepare this week", "primary") + "</div>";
  };

  // The week the professor last stepped to, when course mode kept one;
  // otherwise this week.
  const start = weeks.some((w) => w.week === focus) ? focus : current ?? 1;
  const sections = weeks
    .map((w) => {
      const prev = at(w.week - 1);
      const next = at(w.week + 1);
      const step =
        `<div class="stepper">` +
        (prev ? `<button type="button" class="chip" data-goto="${prev.week}">‹ Week ${prev.week}</button>` : "") +
        `<b>Week ${w.week} of ${weeks.length}</b>` +
        (current !== null && w.week !== current ? `<button type="button" class="chip" data-goto="${current}">Back to this week</button>` : "") +
        (next ? `<button type="button" class="chip" data-goto="${next.week}">Week ${next.week} ›</button>` : "") +
        `<span class="private">Private — class figures from approved evidence only</span></div>`;
      return `<section class="trio-wrap" data-week="${w.week}"${w.week === start ? "" : " hidden"}>${step}` +
        `<div class="trio">${side(prev, "Before")}${focusCard(w)}${side(next, "After")}</div></section>`;
    })
    .join("");
  return `<div class="mode">${sections}</div>`;
};

// ---------------------------------------------------------------- evidence

/**
 * How each week actually went — asked during and after the term, of every
 * week at once, which no other view answers: Progress is keyed by concept and
 * the gradebook by assessment, and "which week went wrong" is a question about
 * weeks. The same spine as All weeks; per week, the work that fell due with
 * the gradebook's own figures for it, the concepts the week's module teaches
 * with their class mean, and the class-level signals about those concepts.
 *
 * Private, like Teaching, and from approved evidence only. Every figure is
 * the host payload's (`gradebook` summary, `class_progress`), printed as it
 * came: grouping under weeks is presentation, and nothing is added up here.
 * Aggregates only — no row of this page is about one student.
 */
const evidenceBody = (data, evidence, status) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const current = data.current_week ?? null;
  const concepts = evidence.concepts ?? {};
  const work = evidence.work ?? {};
  const signals = evidence.signals ?? [];

  // A signal belongs to the first week that teaches one of its concepts.
  const weekOfConcept = new Map();
  for (const w of weeks) for (const c of conceptsOf(w)) if (!weekOfConcept.has(c.id)) weekOfConcept.set(c.id, w.week);
  const signalWeek = (s) => (s.concepts ?? []).map((c) => weekOfConcept.get(c)).find((n) => n !== undefined) ?? null;
  const loose = signals.filter((s) => signalWeek(s) === null);
  const signalLine = (s) =>
    `<li class="${s.severity === "high" ? "flagged" : ""}">${icon("concept")}<span>${esc(s.description)}</span>` +
    (s.severity ? `<small>${esc(s.severity)}</small>` : "") + "</li>";

  // Work in a week still to come has nothing to report yet: the gradebook
  // counts every row with no hand-in as `not_submitted` whatever the date,
  // and "81 not handed in" for a quiz due next week is an accusation.
  const figures = (a, w) => {
    if (w.when === "upcoming") return '<small class="none">not due yet</small>';
    const f = work[a.assessment_id];
    if (!f) return '<small class="none">no approved marks yet</small>';
    const out = [];
    if (f.enrolled !== null && f.submitted !== null) out.push(`${f.submitted} of ${f.enrolled} handed in`);
    if (f.not_submitted) out.push(`${f.not_submitted} not handed in`);
    if (f.graded !== null) out.push(`${f.graded} graded` + (f.partially_graded ? ` · ${f.partially_graded} partly` : ""));
    if (f.mean !== null) out.push(`mean ${f.mean}` + (f.maximum !== null ? ` of ${f.maximum}` : ""));
    if (f.median !== null) out.push(`median ${f.median}`);
    return `<small>${esc(out.join(" · "))}</small>`;
  };
  const measured = (w) =>
    (w.due ?? []).length > 0 ||
    conceptsOf(w).some((c) => concepts[c.id] && concepts[c.id].class_mean !== null && concepts[c.id].class_mean !== undefined) ||
    signals.some((s) => signalWeek(s) === w.week);

  const row = (w) => {
    const due = (w.due ?? [])
      .map((a) => `<li>${workChip(a, `due ${shortDate(a.due_on)}`)}${figures(a, w)}${statusLine(a, status)}</li>`)
      .join("");
    const taught = conceptsOf(w)
      .map((c) => {
        const x = concepts[c.id];
        const has = x && x.class_mean !== null && x.class_mean !== undefined;
        const low = has && x.class_mean < REVISIT_BELOW;
        return `<li class="${low ? "flagged" : ""}">${icon("concept")}<span>${esc(c.title ?? c.id)}</span><small>${
          has ? `class ${esc(pct(x.class_mean))} · ${esc(x.coverage ?? "")} observed${low ? " · revisit" : ""}` : "not assessed yet"
        }</small></li>`;
      })
      .join("");
    const here = signals.filter((s) => signalWeek(s) === w.week).map(signalLine).join("");
    const module = (w.modules ?? [])[0];
    const weak = conceptsOf(w).filter((c) => concepts[c.id] && concepts[c.id].class_mean !== null && concepts[c.id].class_mean < REVISIT_BELOW);
    const ask = weak.length
      ? askButton(
          `In week ${w.week} of ${run.id}${module ? ` (${module.module_id})` : ""}, the class is weakest on ` +
            `${weak.map((c) => c.id).join(", ")}. Read the approved evidence for those concepts and tell me what went wrong ` +
            "and what to revisit. Change nothing.",
          "Why did this week go wrong?",
        )
      : "";
    return `<div class="wkhead ${w.when === "current" ? "now" : w.when === "past" ? "past" : ""}" id="week-${w.week}">` +
      `<b>${w.week < 10 ? "0" + w.week : w.week}</b><span class="k mono">${esc(shortDate(w.starts_on))} – ${esc(shortDate(w.ends_on))}</span>` +
      (titleOf(w) ? `<h3>${esc(titleOf(w))}</h3>` : '<h3 class="none">Unplanned</h3>') +
      (w.when === "current" ? '<span class="pill now">this week</span>' : "") +
      `<span class="askw">${ask}</span></div>` +
      `<div class="cell" data-col="Due that week">${due ? `<ul class="facts">${due}</ul>` : '<span class="dash">—</span>'}</div>` +
      `<div class="cell" data-col="Concepts taught">${taught ? `<ul class="facts">${taught}</ul>` : '<span class="dash">—</span>'}</div>` +
      `<div class="cell" data-col="Signals">${here ? `<ul class="facts">${here}</ul>` : '<span class="dash">—</span>'}</div>`;
  };

  // A run of two or more weeks with nothing due and nothing measured is one band.
  const rows = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j < weeks.length && !measured(weeks[j])) j += 1;
    if (j - i >= 2) {
      const a = weeks[i];
      const z = weeks[j - 1];
      const holds = current !== null && current >= a.week && current <= z.week;
      rows.push(`<div class="band${holds ? " now" : ""}" id="week-${a.week}"><b>${icon("calendar")} Weeks ${a.week}–${z.week}</b>` +
        `<span class="k mono">${esc(shortDate(a.starts_on))} – ${esc(shortDate(z.ends_on))}</span>` +
        `<span class="none">nothing due, nothing measured yet</span></div>`);
      i = j;
    } else {
      rows.push(row(weeks[i]));
      i += 1;
    }
  }

  return `<div class="mode evidence"><div class="stepper"><b>${current ? `Week ${current} of ${weeks.length}` : `${weeks.length} weeks`}</b>` +
    `<span class="private">Private — class figures from approved evidence only</span></div>` +
    (loose.length ? `<div class="side"><small>Open signals not tied to a week</small><ul class="facts">${loose.map(signalLine).join("")}</ul></div>` : "") +
    `<div class="grid"><div class="th">Due that week</div><div class="th">Concepts taught</div><div class="th">Signals</div>${rows.join("")}</div>` +
    `<p class="foot">Hand-ins and marks are the gradebook's, from approved decisions; a concept's class mean is over approved evidence. ` +
    `A concept under ${esc(pct(REVISIT_BELOW))} is marked to revisit.</p></div>`;
};

/** A week nobody has planned and nothing meets in: a candidate for a band. */const isEmpty = (w) => !(w.modules ?? []).length && !(w.meetings ?? []).length;

// ------------------------------------------------------------------ document

/**
 * The page.
 *
 * @param data - a `course_outline` payload, with the pane's material links
 *   and record paths already on it.
 * @param options.dark - the harness's theme, which the page cannot ask for.
 * @param options.student - Preview as student: the record alone, no hole drawn.
 *   What `ainar page` publishes, in this layout.
 */
export const courseModeDocument = (
  data,
  { dark = false, student = false, mode = "term", evidence = null, status = null, focus = null, locks = null } = {},
) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const current = data.current_week ?? null;
  const showGaps = !student;
  const tally = { soon: 0, later: 0, past: 0 };
  const count = (tier) => {
    tally[tier] += 1;
  };

  // ---- the card before week 1: work on no date at all
  const undated = [];
  for (const w of weeks) for (const a of w.undated ?? []) undated.push({ a, w });
  for (const a of data.unplaced?.assessments ?? []) undated.push({ a, w: null });
  let lead = "";
  if (showGaps && undated.length) {
    lead =
      `<div class="lead"><b>${icon("misdated")} ${undated.length} ${undated.length === 1 ? "thing is" : "things are"} not on the calendar yet</b>` +
      undated
        .map(({ a, w }) => {
          count(w ? tierOf(w, current) : "soon");
          return workChip(a, "no date") + statusLine(a, status) +
            gapChip("deadline", w ? tierOf(w, current) : "soon", datesPrompt(a, run),
              `${a.assessment_id} has no dates${w ? `; its module is week ${w.week}` : ""}.`);
        })
        .join("") +
      "</div>";
  }

  // ---- one row per week, a band per run of two or more empty ones
  const rows = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j < weeks.length && isEmpty(weeks[j])) j += 1;
    if (j - i >= 2) {
      rows.push({ band: weeks.slice(i, j) });
      i = j;
    } else {
      rows.push({ week: weeks[i] });
      i += 1;
    }
  }

  const weekRow = (w) => {
    const tier = tierOf(w, current);
    const gaps = showGaps ? w.gaps ?? [] : [];
    const has = (kind) => gaps.find((g) => g.kind === kind);
    const misdated = new Set(has("misdated")?.ids ?? []);
    const module = (w.modules ?? [])[0];
    const title = (w.modules ?? []).map((m) => m.title).join(" · ");

    // Holes that belong to the week as a whole, on its header. The deck sits
    // at the foot of the Lecture column and a date beside its meeting, where
    // their subject is; undated work is in the card before week 1.
    const headGaps = gaps
      .filter((g) => g.kind === "module" || g.kind === "weight")
      .map((g) => {
        count(tier);
        return gapChip(g.kind, tier, promptFor(g.kind, w, run), g.note);
      })
      .join("");

    const head =
      `<div class="wkhead ${w.when === "current" ? "now" : w.when === "past" ? "past" : ""}" id="week-${w.week}">` +
      `<b>${w.week < 10 ? "0" + w.week : w.week}</b><span class="k mono">${esc(shortDate(w.starts_on))} – ${esc(shortDate(w.ends_on))}</span>` +
      (title ? `<h3>${esc(title)}</h3>` : `<h3 class="none">Unplanned</h3>`) +
      (w.when === "current" ? '<span class="pill now">this week</span>' : "") +
      ((w.modules ?? []).some((m) => m.draft) ? '<span class="pill draft">draft</span>' : "") +
      headGaps +
      (module
        ? `<button type="button" class="chip ask askw" data-ask="${esc(
            `For week ${w.week} of ${run.id} (${module.module_id}), what should I teach and what should I revisit first?`,
          )}" title="Ask the assistant to prepare this week">${icon("ask")}Prepare</button>`
        : "") +
      "</div>";

    const concepts = (w.modules ?? []).flatMap((m) => (m.concepts ?? []).map((c) => c.title ?? c.id));
    const conceptRow = concepts.length
      ? `<div class="concepts">${icon("concept")}${concepts.map((c) => `<span class="chip concept">${esc(c)}</span>`).join("")}</div>`
      : "";

    // Lecture: each meeting with its own materials, the deck first.
    const lecture = (w.meetings ?? [])
      .map((m) => {
        const resources = [...(m.resources ?? [])].sort(
          (a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1),
        );
        let off = "";
        if (misdated.has(m.activity_id)) {
          count(tier);
          off = gapChip("misdated", tier, promptFor("misdated", w, run, m.activity_id), has("misdated").note);
        }
        return `<div class="meeting"><span class="chip meet${m.draft ? " draft" : ""}" title="${esc(m.title ?? "")}">` +
          `<span class="k mono">${esc(shortDate(m.on) || "no date")}</span>${icon(MEETING_ICON[m.type] ?? "lecture")}` +
          `${esc([m.type, m.location].filter(Boolean).join(" · "))}</span>${off}${resources.map(materialChip).join("")}</div>`;
      })
      .join("");
    const deckGap = has("deck");
    if (deckGap) count(tier);
    const lectureCell =
      lecture +
      (deckGap ? gapChip("deck", tier, promptFor("deck", w, run), deckGap.note) : "") +
      (lecture ? "" : '<span class="dash">—</span>');

    // Graded work, one column, the type said on the chip.
    const seen = new Set();
    const graded = [];
    for (const [list, verb, field] of [[w.opens, "opens", "opens_on"], [w.due, "due", "due_on"]]) {
      for (const a of list ?? []) {
        const last = verb === "due" || !(w.due ?? []).some((d) => d.assessment_id === a.assessment_id);
        graded.push(workChip(a, `${verb} ${shortDate(a[field])}`) + (student || !last ? "" : statusLine(a, status)));
        if (showGaps && !hasBrief(a) && !seen.has(a.assessment_id)) {
          seen.add(a.assessment_id);
          count(tier);
          graded.push(gapChip("brief", tier, promptFor("brief", w, run, a.assessment_id),
            `${a.assessment_id} has no brief and no description.`));
        }
      }
    }
    // In the student preview there is no card for undated work, so it stays
    // on the week the record places it in.
    if (!showGaps) for (const a of w.undated ?? []) graded.push(workChip(a, "no date"));
    const gradedCell = graded.join("") || '<span class="dash">—</span>';

    // Outcomes: taught by the week's module, assessed by work falling due in it.
    const taught = new Map();
    for (const m of w.modules ?? []) for (const o of m.outcomes ?? []) taught.set(o.id, o.title ?? o.id);
    const assessed = new Set((w.due ?? []).flatMap((a) => a.outcomes ?? []));
    const outcomeIds = [...new Set([...taught.keys(), ...assessed])].sort();
    const titles = new Map((data.outcomes ?? []).map((o) => [o.outcome_id, o.title]));
    const outcomeCell =
      outcomeIds
        .map((id) => {
          const how = taught.has(id) && assessed.has(id) ? "taught · assessed" : assessed.has(id) ? "assessed" : "taught";
          return `<span class="chip lo${assessed.has(id) ? " hit" : ""}" title="${esc(`${taught.get(id) ?? titles.get(id) ?? id} — ${how}`)}">` +
            `${icon("outcome")}${esc(id)}<span class="k">${how}</span></span>`;
        })
        .join("") || '<span class="dash">—</span>';

    return head + conceptRow +
      `<div class="cell" data-col="Lecture">${lectureCell}</div>` +
      `<div class="cell" data-col="Graded work">${gradedCell}</div>` +
      `<div class="cell" data-col="Outcomes">${outcomeCell}</div>`;
  };

  const bandRow = (run_) => {
    const a = run_[0];
    const z = run_[run_.length - 1];
    const span = `Weeks ${a.week}–${z.week}`;
    const work = run_.flatMap((w) => [
      ...(w.opens ?? []).map((x) => workChip(x, `opens ${shortDate(x.opens_on)}`) + (student ? "" : statusLine(x, status))),
      ...(w.due ?? []).map((x) => workChip(x, `due ${shortDate(x.due_on)}`) + (student ? "" : statusLine(x, status))),
    ]);
    let plan = "";
    if (showGaps) {
      const tier = tierOf(a, current);
      for (const w of run_) if ((w.gaps ?? []).some((g) => g.kind === "module")) count(tier);
      plan = `<button type="button" class="chip gap ${tier}" data-ask="${esc(
        `${span} of ${run.id} have no module. Propose what they should teach, given what comes before them ` +
          "and what falls due in them, as draft modules for me to read.",
      )}">${icon("module")}Plan ${esc(span.toLowerCase())}</button>`;
    }
    const holds = current !== null && current >= a.week && current <= z.week;
    return `<div class="band${holds ? " now" : ""}" id="week-${a.week}"><b>${icon("calendar")} ${esc(span)}</b>` +
      `<span class="k mono">${esc(shortDate(a.starts_on))} – ${esc(shortDate(z.ends_on))}</span>` +
      `<span class="none">${showGaps ? `unplanned · ${run_.length} weeks` : "no sessions scheduled"}</span>` +
      work.join("") + plan + "</div>";
  };

  const body = rows.map((r) => (r.band ? bandRow(r.band) : weekRow(r.week))).join("");

  const tallyHtml = showGaps
    ? `<div class="tally" title="${esc(
        Object.entries(data.totals?.gaps ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · "),
      )}"><span class="${tally.soon ? "soon" : "zero"}">${tally.soon} this week or next</span>` +
      `<span class="${tally.later ? "" : "zero"}">${tally.later} later</span>` +
      `<span class="past">${tally.past} in weeks taught</span></div>`
    : "";

  // Which of the three readings this page is. Planning and the term table
  // are structure only; Teaching carries class figures and says so.
  const strip = (note, extra = "") =>
    `<div class="strip"><span class="note">${esc(run.term ?? "")} · ${
      current ? `week ${current} of ${weeks.length}` : `${weeks.length} weeks`
    } · ${esc(note)}</span>${extra}</div>`;
  const studentBanner = student
    ? '<div class="banner"><b>Preview as student.</b> The record alone — no hole, no note about what has not been written yet.</div>'
    : "";
  const structureFoot =
    `<p class="foot">Structure only — nothing here is derived from student work. Accepting a draft is changing ` +
    `<span class="mono">approval: draft</span> in its record; this page points at records and changes none.</p>`;

  let main;
  if (mode === "planning") {
    // The one reading that writes, and only dates: so its foot says so.
    main = strip("does the term hold together") + studentBanner + planningBody(data, { student, locks }) +
      (student
        ? structureFoot
        : `<p class="foot">Structure only — nothing here is derived from student work. Moving a bar changes its ` +
          `<span class="mono">opens_at</span> and <span class="mono">due_at</span> and nothing else; accepting a draft is ` +
          `still changing <span class="mono">approval: draft</span> in its record.</p>` + PLAN_SCRIPT);
  } else if (mode === "teaching") {
    main = strip("this week, between the last and the next") + teachingBody(data, evidence ?? {}, status, focus);
  } else if (mode === "evidence") {
    main = strip("how each week went") + evidenceBody(data, evidence ?? {}, status);
  } else {
    main = strip("press a hole to have the assistant fill it", tallyHtml) + studentBanner + lead +
      `<div class="grid"><div class="th">Lecture</div><div class="th">Graded work</div><div class="th">Outcomes</div>${body}</div>` +
      structureFoot;
  }

  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(`${run.course_id ?? ""} · course mode`)}</title>` +
    `<style>:root{${dark ? DARK : LIGHT}}${STYLE}</style></head><body>` +
    SPRITE + main + SCRIPT + "</body></html>"
  );
};
