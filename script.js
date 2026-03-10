
// ===== STATE =====
let GITA = null;
let lang = localStorage.getItem('gL')||'en';
let bk = JSON.parse(localStorage.getItem('gBK')||'[]');
let dark = localStorage.getItem('gD')==='true';
let curPage = 'home';
let deferredPrompt = null;
// Pagination state for chapter detail
let curChapterIdx = 0;
let curPage_v = 0;
const VERSES_PER_PAGE = 10;

// ===== LOAD DATA =====
async function loadData() {
  // Try fetch first (works on server / GitHub Pages)
  try {
    const res = await fetch('data/gita.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    GITA = await res.json();
    return true;
  } catch(e) {
    console.warn('Fetch failed:', e.message);
  }
  // Fallback: try cache
  if ('caches' in window) {
    try {
      const cache = await caches.open('gita-wisdom-v1');
      const cached = await cache.match('data/gita.json');
      if (cached) { GITA = await cached.json(); return true; }
    } catch(e) {}
  }
  return false;
}

async function init() {
  applyLang(lang);
  applyDark(dark);
  const ok = await loadData();
  if (!ok) {
    document.getElementById('loader').innerHTML = `
      <div style="text-align:center;padding:40px 20px;max-width:400px">
        <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
        <h2 style="font-family:'Cinzel Decorative',serif;color:var(--saffron-deep);margin-bottom:12px">Data Not Found</h2>
        <p style="color:var(--ink-light);line-height:1.7;margin-bottom:20px">The <strong>data/gita.json</strong> file could not be loaded. Please make sure both files are in the same folder and served via a web server (GitHub Pages, localhost, etc.)</p>
        <p style="font-size:0.88rem;color:var(--ink-light)">Run: <code style="background:var(--cream-dark);padding:2px 8px;border-radius:4px">python3 -m http.server</code></p>
      </div>`;
    return;
  }
  // Update stats
  const total = GITA.chapters.reduce((s,c)=>s+c.verses.length,0);
  document.getElementById('total-v').textContent = total;
  renderGrids();
  renderDaily();
  // Hide loader
  setTimeout(()=>{
    document.getElementById('loader').classList.add('hide');
    document.getElementById('app').style.display='';
  }, 600);
  // PWA
  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault(); deferredPrompt=e;
    document.getElementById('ibanner').classList.add('show');
    document.getElementById('ibtn').onclick=()=>{
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(()=>{ document.getElementById('ibanner').classList.remove('show'); deferredPrompt=null; });
    };
  });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

// ===== LANGUAGE =====
function setLang(l){ lang=l; localStorage.setItem('gL',l); applyLang(l); renderGrids(); renderDaily(); if(curPage==='bookmarks') renderBookmarks(); }
function applyLang(l){
  document.querySelectorAll('.en').forEach(e=>e.style.display=l==='en'?'':'none');
  document.querySelectorAll('.hi').forEach(e=>e.style.display=l==='hi'?'':'none');
  document.getElementById('lEN').classList.toggle('on',l==='en');
  document.getElementById('lHI').classList.toggle('on',l==='hi');
  const si=document.getElementById('si'); if(si) si.placeholder=l==='en'?'karma, soul, duty, आत्मा…':'कर्म, आत्मा, धर्म, karma…';
}

// ===== DARK MODE =====
function toggleDark(){ dark=!dark; localStorage.setItem('gD',dark); applyDark(dark); }
function applyDark(on){ document.documentElement.setAttribute('data-theme',on?'dark':'light'); document.getElementById('dbtn').textContent=on?'☀':'🌙'; }

// ===== PAGES =====
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nbtn').forEach(b=>b.classList.remove('on'));
  document.getElementById('page-'+name).classList.add('on');
  document.querySelectorAll(`[data-p="${name}"]`).forEach(b=>b.classList.add('on'));
  curPage=name;
  if(name==='bookmarks') renderBookmarks();
  if(name==='search'){ document.getElementById('sres').innerHTML=''; }
  window.scrollTo({top:0,behavior:'smooth'});
}

// ===== GRIDS =====
function renderGrids(){
  if(!GITA) return;
  const h = GITA.chapters.map(ch=>{
    const n=lang==='en'?ch.name_en:ch.name_hi, na=lang==='en'?ch.name_hi:ch.name_en;
    return `<div class="ccard" onclick="openChapter(${ch.chapter-1})">
      <div class="cnum">Ch.${String(ch.chapter).padStart(2,'0')}</div>
      <div class="cname">${n}</div>
      <div class="cname-hi">${na}</div>
      <div class="cvc">${ch.verses.length} verses</div>
    </div>`;
  }).join('');
  document.getElementById('grid-home').innerHTML=h;
  document.getElementById('grid-chapters').innerHTML=h;
}

// ===== CHAPTER DETAIL =====
function openChapter(idx){
  if(!GITA) return;
  curChapterIdx=idx; curPage_v=0;
  renderChapterDetail();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nbtn').forEach(b=>b.classList.remove('on'));
  document.getElementById('page-detail').classList.add('on');
  curPage='detail';
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderChapterDetail(){
  const ch=GITA.chapters[curChapterIdx];
  const name=lang==='en'?ch.name_en:ch.name_hi, nameAlt=lang==='en'?ch.name_hi:ch.name_en;
  const sub=lang==='en'?ch.subtitle_en:ch.subtitle_hi, sum=lang==='en'?ch.summary_en:ch.summary_hi;
  document.getElementById('ch-hdr').innerHTML=`
    <button class="back-btn" onclick="showPage('chapters')">← ${lang==='en'?'All Chapters':'सभी अध्याय'}</button>
    <div class="ch-lbl">CHAPTER ${ch.chapter} OF 18</div>
    <h2 class="ch-ttl">${name}</h2>
    <div class="ch-hi">${nameAlt}</div>
    <div class="ch-sub">${sub}</div>
    <div class="ch-sum">${sum}</div>`;
  renderVersePage();
}

function renderVersePage(){
  const ch=GITA.chapters[curChapterIdx];
  const total=ch.verses.length, pages=Math.ceil(total/VERSES_PER_PAGE);
  const start=curPage_v*VERSES_PER_PAGE, end=Math.min(start+VERSES_PER_PAGE,total);
  const pageVerses=ch.verses.slice(start,end);

  const pagerHTML=()=>`<div class="vpager">
    <span class="vpager-info">${lang==='en'?'Verses':'श्लोक'} ${start+1}–${end} ${lang==='en'?'of':'में से'} ${total}</span>
    <div class="vpager-btns">
      <button class="pg-btn" onclick="changePage(-1)" ${curPage_v===0?'disabled':''}>← ${lang==='en'?'Prev':'पिछला'}</button>
      ${Array.from({length:pages},(_, i)=>`<button class="pg-btn${i===curPage_v?' active':''}" onclick="goPage(${i})">${i+1}</button>`).join('')}
      <button class="pg-btn" onclick="changePage(1)" ${curPage_v>=pages-1?'disabled':''}>${lang==='en'?'Next':'अगला'} →</button>
    </div>
  </div>`;

  document.getElementById('ch-pager').innerHTML = pages>1 ? pagerHTML() : '';
  document.getElementById('ch-verses').innerHTML = pageVerses.map(v=>{
    const tr=lang==='en'?v.translation_en:v.translation_hi, mn=lang==='en'?v.meaning_en:v.meaning_hi;
    const bkd=bk.includes(`${curChapterIdx}_${v.verse}`);
    return `<div class="vcard">
      <div class="vmeta"><div class="vnum">${v.verse}</div><div class="vref">${lang==='en'?'Ch.':'अ.'} ${ch.chapter} · ${lang==='en'?'V.':'श्लोक'} ${v.verse}</div></div>
      <div class="vsk">${v.sanskrit}</div>
      <div class="vtr">${tr}</div>
      ${mn?`<div class="vmn" id="vm_${v.verse}">${mn}</div>`:''}
      <div class="vact">
        ${mn?`<button class="bsm" onclick="toggleMn(${v.verse})">${lang==='en'?'💡 Meaning':'💡 अर्थ'}</button>`:''}
        <button class="bsm${bkd?' bkd':''}" id="bk_${curChapterIdx}_${v.verse}" onclick="toggleBK(${curChapterIdx},${v.verse})">
          ${bkd?(lang==='en'?'🔖 Saved':'🔖 सहेजा'):(lang==='en'?'🔖 Save':'🔖 सहेजें')}
        </button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('ch-pager-bot').innerHTML = pages>1 ? pagerHTML() : '';
}

function changePage(d){ curPage_v+=d; renderVersePage(); window.scrollTo({top:0,behavior:'smooth'}); }
function goPage(n){ curPage_v=n; renderVersePage(); window.scrollTo({top:0,behavior:'smooth'}); }
function toggleMn(vn){ const e=document.getElementById(`vm_${vn}`); if(e) e.classList.toggle('open'); }

// ===== BOOKMARKS =====
function toggleBK(cidx,vn){
  const key=`${cidx}_${vn}`, idx=bk.indexOf(key), btn=document.getElementById(`bk_${cidx}_${vn}`);
  if(idx===-1){ bk.push(key); if(btn){btn.classList.add('bkd');btn.textContent=lang==='en'?'🔖 Saved':'🔖 सहेजा';} showToast(lang==='en'?'Verse saved!':'श्लोक सहेजा!'); }
  else{ bk.splice(idx,1); if(btn){btn.classList.remove('bkd');btn.textContent=lang==='en'?'🔖 Save':'🔖 सहेजें';} showToast(lang==='en'?'Removed':'हटाया गया'); }
  localStorage.setItem('gBK',JSON.stringify(bk));
}
function renderBookmarks(){
  const c=document.getElementById('bklist');
  if(!GITA||!bk.length){ c.innerHTML=`<div class="bkempty"><div class="ei">🔖</div><p>${lang==='en'?'No bookmarks yet. Explore chapters and save your favourites!':'अभी तक कोई बुकमार्क नहीं। अध्यायों का अन्वेषण करें!'}</p></div>`; return; }
  c.innerHTML='<div class="vlist">'+bk.map(key=>{
    const [ci,vn]=key.split('_').map(Number);
    const ch=GITA.chapters[ci]; if(!ch) return '';
    const v=ch.verses.find(x=>x.verse===vn); if(!v) return '';
    const tr=lang==='en'?v.translation_en:v.translation_hi, mn=lang==='en'?v.meaning_en:v.meaning_hi;
    return `<div class="vcard">
      <div class="rmeta">Ch.${ch.chapter} · ${lang==='en'?ch.name_en:ch.name_hi} · V.${vn}</div>
      <div class="vsk">${v.sanskrit}</div>
      <div class="vtr">${tr}</div>
      ${mn?`<div class="vmn open">${mn}</div>`:''}
      <div class="vact">
        <button class="bsm bkd" onclick="toggleBK(${ci},${vn});renderBookmarks()">${lang==='en'?'🗑 Remove':'🗑 हटाएं'}</button>
        <button class="bsm" onclick="openChapter(${ci})">${lang==='en'?'→ Open':'→ खोलें'}</button>
      </div>
    </div>`;
  }).join('')+'</div>';
}

// ===== DAILY VERSE =====
function renderDaily(){
  if(!GITA) return;
  const all=[]; GITA.chapters.forEach((ch,ci)=>ch.verses.forEach(v=>all.push({ci,v,ch})));
  const p=all[Math.floor(Date.now()/86400000)%all.length];
  document.getElementById('dv-sk').textContent=p.v.sanskrit.split('\n').slice(0,2).join(' ');
  document.getElementById('dv-tr').textContent=lang==='en'?p.v.translation_en:p.v.translation_hi;
  document.getElementById('dv-ref').textContent=`— Ch.${p.ch.chapter}, V.${p.v.verse} · ${lang==='en'?p.ch.name_en:p.ch.name_hi}`;
  document.getElementById('dcard')._ci=p.ci;
}
function openDailyVerse(){ const ci=document.getElementById('dcard')._ci; if(ci!=null) openChapter(ci); }

// ===== SEARCH =====
function liveSearch(q){ if(q.length<2){document.getElementById('sres').innerHTML='';return;} doSearch(q); }
function doSearch(q){
  if(!GITA) return;
  q=q||document.getElementById('si').value; if(!q.trim()) return;
  const ql=q.toLowerCase(), res=[];
  GITA.chapters.forEach((ch,ci)=>ch.verses.forEach(v=>{
    if([v.sanskrit,v.translation_en,v.translation_hi,v.meaning_en||'',v.meaning_hi||''].join(' ').toLowerCase().includes(ql))
      res.push({ci,v,ch});
  }));
  const c=document.getElementById('sres');
  if(!res.length){ c.innerHTML=`<div class="empty">${lang==='en'?`No results for "${q}"`:`"${q}" के लिए कोई परिणाम नहीं`}</div>`; return; }
  c.innerHTML=`<div style="font-size:0.88rem;color:var(--saffron);margin-bottom:12px">${res.length} ${lang==='en'?'results found':'परिणाम मिले'}</div>`+
  res.slice(0,15).map(r=>{
    const tr=lang==='en'?r.v.translation_en:r.v.translation_hi, mn=lang==='en'?r.v.meaning_en:r.v.meaning_hi;
    return `<div class="vcard">
      <div class="rmeta">Ch.${r.ch.chapter} · ${lang==='en'?r.ch.name_en:r.ch.name_hi} · V.${r.v.verse}</div>
      <div class="vsk">${r.v.sanskrit.split('\n')[0]}</div>
      <div class="vtr">${tr}</div>
      ${mn?`<div class="vmn open" style="display:block">${mn}</div>`:''}
      <div class="vact"><button class="bsm" onclick="openChapter(${r.ci})">${lang==='en'?'→ Open Chapter':'→ अध्याय खोलें'}</button></div>
    </div>`;
  }).join('');
}

// ===== CHAT =====
function fillChat(t){ document.getElementById('ci').value=t; document.getElementById('ci').focus(); }
function sendChat(){
  const inp=document.getElementById('ci'), raw=inp.value.trim(); if(!raw) return;
  addMsg(raw,'u'); inp.value='';
  setTimeout(()=>addMsg(processCmd(raw.toLowerCase()),'b'),200);
}
function addMsg(content,type){
  const w=document.getElementById('cwin'), d=document.createElement('div');
  d.className='cmsg '+type; d.innerHTML=`<div class="mb">${content}</div>`;
  w.appendChild(d); w.scrollTop=w.scrollHeight;
}
function fmtV(ch,v){
  const tr=lang==='en'?v.translation_en:v.translation_hi, mn=lang==='en'?v.meaning_en:v.meaning_hi;
  return `<span style="font-size:0.78rem;color:var(--saffron)">📖 Ch.${ch.chapter} · ${lang==='en'?ch.name_en:ch.name_hi} · V.${v.verse}</span>
<div class="vsk">${v.sanskrit}</div><div class="vtr">${tr}</div>${mn?`<div class="vmn">${mn}</div>`:''}`;
}
function processCmd(cmd){
  if(!GITA) return '⏳ Data still loading…';
  const all=[]; GITA.chapters.forEach(ch=>ch.verses.forEach(v=>all.push({ch,v})));
  if(cmd==='help'||cmd==='h') return `<strong>📖 ${lang==='en'?'Commands':'आदेश'}:</strong><br><br>
<b>chN</b> — ${lang==='en'?'First verse + summary of chapter N':'अध्याय N का पहला श्लोक'}<br>
<b>chN vM</b> — ${lang==='en'?'Chapter N, verse M':'अध्याय N, श्लोक M'}<br>
<b>chN all</b> — ${lang==='en'?'All verses of chapter N (max 5 shown)':'अध्याय N के सभी श्लोक'}<br>
<b>daily</b> — ${lang==='en'?'Today\'s verse':'आज का श्लोक'}<br>
<b>random</b> — ${lang==='en'?'Random verse':'यादृच्छिक श्लोक'}<br>
<b>chapters</b> — ${lang==='en'?'List all chapters':'सभी अध्यायों की सूची'}`;
  if(cmd==='daily'){ const p=all[Math.floor(Date.now()/86400000)%all.length]; return fmtV(p.ch,p.v); }
  if(cmd==='random'){ const p=all[Math.floor(Math.random()*all.length)]; return fmtV(p.ch,p.v); }
  if(cmd==='chapters'||cmd==='list') return '<strong>📚 18 Chapters:</strong><br><br>'+GITA.chapters.map(ch=>`<b>Ch.${ch.chapter}</b> — ${lang==='en'?ch.name_en:ch.name_hi}`).join('<br>');
  const m=cmd.match(/^ch\s*(\d+)(?:\s+(?:v\s*(\d+)|(all)))?/);
  if(m){
    const n=parseInt(m[1]);
    if(n<1||n>18) return `❌ Chapter ${n} not found. Enter 1–18.`;
    const ch=GITA.chapters[n-1];
    if(m[3]==='all'){
      const shown=ch.verses.slice(0,5);
      return `<strong>📖 Ch.${n}: ${lang==='en'?ch.name_en:ch.name_hi}</strong> (${ch.verses.length} verses)<br><br>`+
        shown.map(v=>fmtV(ch,v)).join('<hr class="vs">')+
        (ch.verses.length>5?`<br><em style="color:var(--saffron)">${lang==='en'?`…and ${ch.verses.length-5} more. Open the chapter to read all.`:`…और ${ch.verses.length-5} श्लोक। सभी पढ़ने के लिए अध्याय खोलें।`}</em>`:'');
    }
    if(m[2]){ const vn=parseInt(m[2]), v=ch.verses.find(x=>x.verse===vn); return v?fmtV(ch,v):`❌ Verse ${vn} not in Ch.${n}. (Ch.${n} has ${ch.verses.length} verses)`; }
    const sum=lang==='en'?ch.summary_en:ch.summary_hi;
    return `<strong>📖 Ch.${n}: ${lang==='en'?ch.name_en:ch.name_hi}</strong><br><br><em>${sum}</em><br><br>${fmtV(ch,ch.verses[0])}`;
  }
  return `❓ ${lang==='en'?'Unknown command. Try':'अज्ञात आदेश। प्रयास करें'} <em>help</em>`;
}

// ===== TOAST =====
function showToast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

init();
