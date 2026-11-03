// Screen world: HTML overlay layer (crisp, accessible): chapter rail, hints, per-beat panels, reveal helpers.
const CSS = `
@property --k{syntax:'<number>';inherits:true;initial-value:1}
.edk{transition:--k .5s cubic-bezier(.4,0,.6,1)}
.edk.in{transition:--k 1.15s cubic-bezier(.16,.84,.24,1)}
@media (prefers-reduced-motion:reduce){.edk,.edk.in{transition:--k .2s linear}}
#worldUI{position:fixed;inset:0;z-index:6;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .35s}
#worldUI.on{opacity:1;visibility:visible}
#worldUI.modal .wr-rail,#worldUI.modal .wr-count{opacity:0;visibility:hidden}
#site.wmodal #nav .links{opacity:0;pointer-events:none}
.wr-rail{transition:opacity .3s}
#worldUI .on,#worldUI a,#worldUI button{pointer-events:auto}
#worldUI .wb{position:absolute;inset:0;visibility:hidden}
#worldUI .wb.vis{visibility:visible}
#worldUI .wb:not(.vis) *{visibility:hidden!important}
.wr-rail{position:absolute;right:clamp(14px,2.2vw,30px);top:50%;transform:translateY(-50%);pointer-events:none}
.wr-rail ol{pointer-events:auto;width:auto!important}.wr-rail{width:auto!important}.wr-rail button{width:auto;flex-direction:row;position:relative}.wr-rail button .l{position:absolute;right:24px}
.wr-rail ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;align-items:stretch;gap:6px;position:relative;width:220px}
.wr-rail{width:220px}
.wr-rail ol::before{content:"";position:absolute;right:8px;top:10px;bottom:10px;width:2px;border-radius:2px;background:rgba(255,240,235,.18)}
.wr-rail .fill{position:absolute;right:8px;top:10px;width:2px;border-radius:2px;background:linear-gradient(#FFE0B0,#E2A07A);height:0}
.wr-rail button{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;align-items:center;justify-content:flex-end;gap:10px;height:22px;font:500 12px/1 "JetBrains Mono",monospace;letter-spacing:.06em;color:rgba(255,240,235,.6)}
.wr-rail button .l{opacity:0;transform:translateX(6px);transition:opacity .25s,transform .25s;white-space:nowrap;text-shadow:0 1px 10px rgba(5,5,30,.8)}
.wr-rail button .d{width:8px;height:8px;border-radius:50%;background:rgba(255,240,235,.35);border:2px solid transparent;margin-right:2px;transition:all .3s;flex:none;position:relative;z-index:1}
.wr-rail button:hover .l,.wr-rail button:focus-visible .l{opacity:1;transform:none}   /* labels on hover/focus only: never over body copy */
.wr-rail:hover button .l{opacity:.85;transform:none}
.wr-rail button[aria-current="step"]{color:#FFF0EB}
.wr-rail button[aria-current="step"] .d{background:#FFE0B0;box-shadow:0 0 0 4px rgba(255,224,176,.18),0 0 14px rgba(255,200,140,.7)}
.wr-rail button:focus-visible{outline:none}.wr-rail button:focus-visible .d{border-color:#FFE0B0}
.wr-hint{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);font:19px/1 VT323,monospace;color:rgba(255,240,235,.72);letter-spacing:.04em;white-space:nowrap;display:flex;gap:10px;align-items:center;text-shadow:0 1px 10px rgba(5,5,30,.9)}
.wr-hint kbd{font:inherit;border:1px solid rgba(255,240,235,.35);border-radius:5px;padding:1px 6px;background:rgba(10,8,30,.35)}
.wr-hint .ar{display:inline-block;animation:wrbob 1.6s ease-in-out infinite}
@keyframes wrbob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
.wr-eyebrow{font:21px/1 VT323,monospace;letter-spacing:.06em;color:#FFE0B0;margin:0 0 12px;text-shadow:0 1px 12px rgba(5,5,30,.8)}
.wr-h{font-family:"Instrument Serif",serif;font-weight:400;font-size:clamp(52px,7.4vw,124px);line-height:.92;letter-spacing:-.02em;margin:0;color:#FFF6E8;text-shadow:0 6px 40px rgba(10,10,60,.55)}
.wr-h em{font-style:italic;color:#FFE0B0}
.wr-p{font-size:clamp(16px,1.3vw,19px);line-height:1.5;color:rgba(255,240,235,.84);max-width:430px;margin:18px 0 0;text-shadow:0 1px 14px rgba(5,5,30,.9)}
.wr-link{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin-top:18px;padding:0 20px;border-radius:999px;background:#FFE4BF;color:#1A120A;text-decoration:none;font-weight:600;font-size:16px;box-shadow:0 10px 30px rgba(255,200,140,.22);transition:transform .2s,box-shadow .2s}
.wr-link:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(255,200,140,.32)}
.wr-link.ghost{background:rgba(20,14,40,.6);color:#FFF0EB;border:1px solid rgba(255,240,235,.4);}
.wr-link:focus-visible,.wr-btn:focus-visible,.wr-chip:focus-visible{outline:3px solid #FFB45E;outline-offset:3px}
.rv .ln{display:block;overflow:hidden;padding-bottom:.06em;margin-bottom:-.06em}
.rv .ln>span{display:inline-block;transform-origin:0 100%;--kk:clamp(0,calc(var(--k,1)*1.5 - var(--i,0)*.22),1);transform:translateY(calc((1 - var(--kk))*112%)) rotate(calc((1 - var(--kk))*7deg));opacity:calc(.2 + var(--kk))}
.fadeup{--kk:clamp(0,calc(var(--k,1)*1.4 - .3),1);opacity:var(--kk);transform:translateY(calc((1 - var(--kk))*18px))}
.wr-copy{position:absolute;left:clamp(16px,6vw,96px);top:50%;transform:translateY(-50%);max-width:min(560px,46vw)}
.wr-copy.right{left:auto;right:clamp(70px,8vw,140px);text-align:right}.wr-copy.right .wr-p{margin-left:auto}
.wr-copy.top{top:clamp(90px,15vh,150px);transform:none}
.wr-copy.bottom{top:auto;bottom:clamp(70px,12vh,120px);transform:none}
.wr-tip{position:absolute;left:0;top:0;padding:6px 11px;border-radius:999px;background:rgba(255,240,224,.94);color:#1A120A;font:600 14px/1.2 "Instrument Sans",sans-serif;white-space:nowrap;transform:translate(-50%,-140%);opacity:0;transition:opacity .15s;box-shadow:0 8px 20px rgba(5,5,30,.35)}
.wr-tip.on{opacity:1}
.wr-btn{all:unset;box-sizing:border-box;cursor:pointer;width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,240,235,.4);background:rgba(20,14,40,.62);color:#FFF0EB;display:inline-flex;align-items:center;justify-content:center;font-size:20px;transition:background .2s,transform .2s}
.wr-btn:hover{background:rgba(255,240,235,.16);transform:translateY(-1px)}
.wr-chip{all:unset;cursor:pointer;font:20px/1 VT323,monospace;padding:8px 15px;border-radius:999px;border:1px solid rgba(255,240,235,.35);background:rgba(10,8,30,.55);color:#FFF0EB;}
.wr-chip[aria-pressed="true"]{background:#FFE4BF;color:#1A120A;border-color:#FFE4BF}
@media (max-width:820px){
  .wr-rail{top:64px;right:16px;left:16px;transform:none;width:auto}
  .wr-rail ol{width:auto}
  .wr-rail ol{flex-direction:row;gap:4px}
  .wr-rail ol::before,.wr-rail .fill{display:none}
  .wr-rail li{flex:1}
  .wr-rail button{width:100%;height:20px;justify-content:center}
  .wr-rail button .l{display:none}
  .wr-rail button .d{width:100%;height:4px;border-radius:3px;margin:0}
  .wr-rail button[aria-current="step"] .d{box-shadow:0 0 10px rgba(255,200,140,.6)}
  .wr-railname{display:block!important}
  .wr-copy,.wr-copy.right{left:16px;right:16px;max-width:none;text-align:left;top:auto;bottom:clamp(64px,10vh,96px);transform:none}
  .wr-copy.right .wr-p{margin-left:0}
  .wr-copy.top{top:122px;bottom:auto}
  .lb-copy.wr-copy.top{top:auto;bottom:64px}
  .wr-h{font-size:clamp(46px,13vw,64px)}
  .wr-p{font-size:16px;margin-top:12px}
  .wr-link{min-height:40px;padding:0 15px;font-size:14px;margin-top:12px}
  .wr-hint{font-size:15px;bottom:12px;white-space:normal;width:92vw;justify-content:center;flex-wrap:wrap;text-align:center;gap:6px}
}
.wr-railname{display:none;position:absolute;left:0;right:0;top:24px;text-align:center;font:18px/1 VT323,monospace;color:#FFE0B0;letter-spacing:.06em;text-shadow:0 1px 10px rgba(5,5,30,.9)}

/* editorial block: eyebrow, headline, lead (40-90 words), second paragraph, stat callout, figure tag */
.wr-ed{position:absolute;left:clamp(16px,5.5vw,88px);top:50%;transform:translateY(-50%);width:min(450px,35vw);color:#FFF0EB}
.wr-ed.right{left:auto;right:clamp(150px,13vw,210px)}
.wr-ed.top{top:clamp(88px,13vh,130px);transform:none}
.wr-ed::before{content:"";position:absolute;inset:-60px -80px;z-index:-1;opacity:var(--k,1);background:radial-gradient(closest-side,rgba(6,5,24,.55),rgba(6,5,24,0));pointer-events:none}
.wr-ed .wr-h{font-size:clamp(50px,5.8vw,96px)}
.wr-ed .lead{font-size:clamp(16px,1.2vw,18px);line-height:1.55;color:rgba(255,240,235,.92);margin:18px 0 0;text-shadow:0 1px 14px rgba(5,5,30,.9)}
.wr-ed .second{font-size:16px;line-height:1.55;color:rgba(255,240,235,.72);margin:10px 0 0;text-shadow:0 1px 14px rgba(5,5,30,.9)}
.wr-ed .stat{display:flex;align-items:baseline;gap:12px;margin:18px 0 0;padding:12px 0 0;border-top:1px solid rgba(255,240,235,.2)}
.wr-ed .stat b{font:400 clamp(44px,4vw,64px)/.9 "Instrument Serif",serif;font-style:italic;color:#FFE0B0}
.wr-ed .stat span{font:500 13px/1.3 "JetBrains Mono",monospace;letter-spacing:.06em;color:rgba(255,240,235,.75);text-transform:uppercase;max-width:200px}
.wr-ed .fig{display:inline-block;margin:14px 0 0;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,240,235,.28);font:500 12px "JetBrains Mono",monospace;letter-spacing:.04em;color:rgba(255,240,235,.75);background:rgba(10,8,30,.35)}
.wr-ed .acts{display:flex;gap:10px;flex-wrap:wrap}
.wr-ed .acts .wr-link{margin-top:14px}
.wr-count{position:absolute;right:clamp(14px,2.2vw,30px);top:calc(50% - 196px);font:20px/1 VT323,monospace;letter-spacing:.08em;color:#FFE0B0;text-shadow:0 1px 10px rgba(5,5,30,.9)}
.wr-count i{font-style:normal;color:rgba(255,240,235,.5)}
.wr-ed.ink{color:#1B1208}.wr-ed.ink .wr-eyebrow{color:#B5733F;text-shadow:none}.wr-ed.ink .wr-h{color:#1B1208;text-shadow:none}.wr-ed.ink .wr-h em{color:#C2412E}
.wr-ed.ink .lead{color:#3A2E22;text-shadow:none}.wr-ed.ink .second{color:#5a4a3a;text-shadow:none}.wr-ed.ink .stat{border-color:rgba(40,25,10,.2)}.wr-ed.ink .stat b{color:#C2412E}.wr-ed.ink .stat span{color:#6B4A2E}
.wr-ed.ink .fig{color:#5a4a3a;border-color:rgba(40,25,10,.25);background:rgba(255,248,238,.6)}.wr-ed.ink::before{background:radial-gradient(closest-side,rgba(250,240,224,.85),rgba(250,240,224,0))}
@media (max-width:820px){
  #worldUI .wr-ed.ink{background:linear-gradient(180deg,rgba(245,234,214,0),rgba(245,234,214,.92) 46px,rgba(245,234,214,.97))}
  .wr-count{display:none}
  .wr-ed,.wr-ed.right,.wr-ed.top{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-width:none;padding:56px 16px 46px;background:linear-gradient(180deg,rgba(5,4,22,0),rgba(5,4,22,.86) 46px,rgba(5,4,22,.94));text-align:left}
  .wr-ed::before{display:none}
  .wr-ed .wr-h{font-size:clamp(40px,11.5vw,54px)}
  .wr-ed .lead{font-size:16px;margin-top:10px}
  .wr-ed .second{display:none}
  .wr-ed .stat{margin-top:10px;padding-top:8px}.wr-ed .stat b{font-size:40px}
  .wr-ed .fig{margin-top:8px}
  .wr-ed .wr-eyebrow{font-size:18px;margin-bottom:6px}
}
/* polish pass: one kicker per beat, short copy, quiet chrome */
.wr-ed .fig{display:none}
.wr-ed .second{display:none}.wr-ed.hint .second{display:block;font:500 13px/1.4 "JetBrains Mono",monospace;letter-spacing:.03em;color:rgba(255,240,235,.62)}
.wr-ed.ink.hint .second{color:#6B4A2E}
.wr-count{display:none}
.wr-rail{opacity:.42;transition:opacity .3s}.wr-rail:hover,.wr-rail:focus-within{opacity:1}
@media (min-width:821px){.wr-rail{right:14px}}
@media (prefers-reduced-motion:reduce){.wr-hint .ar{animation:none}.rv .ln>span{transform:none}.fadeup{transform:none}}
`;

export function makeUI(home, beats, onJump) {
  if (!document.getElementById('worldCSS')) { const st = document.createElement('style'); st.id = 'worldCSS'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.id = 'worldUI'; root.setAttribute('aria-label', 'Inside the screen');
  root.innerHTML = `<p class="wr-count" aria-hidden="true"></p><nav class="wr-rail" aria-label="Chapters inside the screen"><ol></ol><i class="fill" aria-hidden="true"></i><span class="wr-railname" aria-hidden="true"></span></nav><p class="wr-hint" aria-hidden="true"></p><div class="wr-tip" aria-hidden="true"></div>`;
  home.insertBefore(root, home.querySelector('#track'));
  const count = root.querySelector('.wr-count'), ol = root.querySelector('ol'), fill = root.querySelector('.fill'), hint = root.querySelector('.wr-hint'), tip = root.querySelector('.wr-tip'), railName = root.querySelector('.wr-railname');
  const btns = beats.map((b, i) => {
    const li = document.createElement('li'); const bt = document.createElement('button'); bt.type = 'button';
    bt.innerHTML = `<span class="l">${String(i + 1).padStart(2, '0')} ${b.name}</span><span class="d" aria-hidden="true"></span>`;
    bt.setAttribute('aria-label', `Go to ${b.name}`); bt.addEventListener('click', () => onJump(i)); li.appendChild(bt); ol.appendChild(li); return bt;
  });
  const panels = {};
  beats.forEach((b) => { const s = document.createElement('section'); s.className = 'wb'; s.dataset.b = b.id; s.setAttribute('aria-label', b.name); root.appendChild(s); panels[b.id] = s; });
  let cur = -1, hintTxt = '';
  return {
    root, panels, tip,
    show(on) { if (root.classList.contains('on') !== on) root.classList.toggle('on', on); },
    setBeat(i, prog) {
      if (i !== cur) { cur = i; btns.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }); railName.textContent = `${String(i + 1).padStart(2, '0')} / ${String(beats.length).padStart(2, '0')} · ${beats[i].name}`; count.innerHTML = `${String(i + 1).padStart(2, '0')} <i>/ ${String(beats.length).padStart(2, '0')}</i>`; }
      const top = btns[0].offsetTop + 11, bot = btns[btns.length - 1].offsetTop + 11;
      fill.style.height = Math.max(0, (bot - top) * prog) + 'px';
    },
    panelVis(id, vis) { const p = panels[id]; if (p.classList.contains('vis') !== vis) { p.classList.toggle('vis', vis); p.inert = !vis; } },
    hint(html) { if (html !== hintTxt) { hintTxt = html; hint.innerHTML = html; } },
    tipAt(text, x, y) { if (!text) { tip.classList.remove('on'); return; } tip.textContent = text; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on'); },
    dispose() { root.remove(); },
  };
}

// split a headline into masked lines for the rise-in reveal. lines: array of HTML strings
export function headline(tag, lines, id) {
  return `<${tag} class="wr-h rv"${id ? ` id="${id}"` : ''}>${lines.map((l, i) => `<span class="ln"><span style="--i:${i}">${l}</span></span>`).join('')}</${tag}>`;
}
export function setK(el, k) { if (!el) return; const v = (Math.round(k * 1000) / 1000).toString(); if (el._k !== v) { el._k = v; el.style.setProperty('--k', v); } }

// editorial block. o: { cls, eyebrow, title: [lines], lead, second, stat: [number, label], fig, acts: html }
export function ed(o) {
  return `<div class="wr-ed ${o.cls || ''}"><p class="wr-eyebrow fadeup">${o.eyebrow}</p>${headline(o.tag || 'h2', o.title)}
    <p class="lead fadeup">${o.lead}</p>${o.second ? `<p class="second fadeup">${o.second}</p>` : ''}
    ${o.stat ? `<p class="stat fadeup"><b>${o.stat[0]}</b><span>${o.stat[1]}</span></p>` : ''}
    ${o.acts ? `<p class="acts fadeup">${o.acts}</p>` : ''}${o.fig ? `<span class="fig fadeup">${o.fig}</span>` : ''}</div>`;
}
// show/hide an editorial block with the reveal value k
// time-based reveal: scroll only decides in/out (with hysteresis); the motion itself is a smooth CSS transition,
// so text never sits half-built or jitters with the scroll wheel.
export function edK(el, k) {
  if (!el) return;
  if (!el._edk) { el._edk = 1; el.classList.add('edk'); el._on = false; el.style.setProperty('--k', '0'); el.style.visibility = 'hidden'; }
  const on = el._on ? k > 0.25 : k > 0.55;
  if (on === el._on) return;
  el._on = on; clearTimeout(el._hideT);
  if (on) { el.style.visibility = 'visible'; el.classList.add('in'); requestAnimationFrame(() => el.style.setProperty('--k', '1')); }
  else { el.classList.remove('in'); el.style.setProperty('--k', '0'); el._hideT = setTimeout(() => { if (!el._on) el.style.visibility = 'hidden'; }, 520); }
}
