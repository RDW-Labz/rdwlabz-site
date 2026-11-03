import asyncio, time, json, subprocess, sys
from playwright.async_api import async_playwright
D='/tmp/claude-0/-home-claude/66182c9c-6d6a-55e6-a725-57986873973a/scratchpad/'
O=D+'mine7/'
MODE=sys.argv[1] if len(sys.argv)>1 else 'desk'
PAGES=json.loads(sys.argv[2]) if len(sys.argv)>2 else [[12,'ps5']]
STEPS=json.loads(sys.argv[3]) if len(sys.argv)>3 else [0,0.5,1]
RING=json.loads(sys.argv[4]) if len(sys.argv)>4 else []
PORT=8861
FILMK=float(__import__("os").environ.get("FK","0.3"))
SRV=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=D+'site3d',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
  async with async_playwright() as pw:
    b=await pw.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
    vp={'width':1280,'height':800} if MODE!='mob' else {'width':390,'height':844}
    ctx=await b.new_context(viewport=vp, reduced_motion='reduce' if MODE=='red' else 'no-preference')
    pg=await ctx.new_page(); logs=[]; imgs=[]
    pg.on('pageerror',lambda e: logs.append('ERR '+str(e)[:300]))
    pg.on('console',lambda m: logs.append(m.type+' '+m.text[:200]) if m.type in ('error','warning') else None)
    pg.on('response',lambda r: (logs.append(f'HTTP {r.status} {r.url}') if r.status>=400 else None, imgs.append(r.url.split('/img/')[-1]) if '/img/' in r.url else None))
    await pg.goto(f'http://localhost:{PORT}/t.html'); await asyncio.sleep(24)
    print('boot img requests', len(imgs), [i for i in imgs if i.startswith('g/')])
    info=await pg.evaluate("(()=>{const w=window.__world; return {S0:w.S0, vh:innerHeight, beats:w.beats.map(b=>({id:b.id,start:b.start,len:b.len,hero:b.hero}))}})()")
    bi={b['id']:i for i,b in enumerate(info['beats'])}
    bt=info['beats'][bi['ring']]; yy=(info['S0']+bt['start']+bt['len']*bt['hero'])*info['vh']
    await pg.evaluate(f"window.__noSnap=1; window.scrollTo(0,{yy})"); await asyncio.sleep(8)
    R=f"window.__world.beats[{bi['ring']}].inst"
    cur=0
    for c in RING:
      await pg.evaluate(f"{R}.stepBy({c-cur})"); cur=c; await asyncio.sleep(20)
      await pg.screenshot(path=O+f'{MODE}_ring_{c+1:02d}.png',timeout=90000)
    for idx,nm in PAGES:
      n0=len(imgs)
      await pg.evaluate(f"{R}.openPage({idx})")
      for _ in range(30):
        await asyncio.sleep(1)
        if await pg.evaluate("!!window.__world.page"): break
      await asyncio.sleep(3)
      for k in STEPS:
        await pg.evaluate(f"window.__world.page && window.__world.page.scrollTo({k})"); await asyncio.sleep(9 if k else 5)
        await pg.screenshot(path=O+f'{MODE}_page_{nm}_{int(k*100)}.png',timeout=90000)
      print(nm, await pg.evaluate("(()=>{const p=window.__world.page; return p? {items:p.items.map(i=>i.k+(i.loaded?'+':'')), vids:(p.videos||[]).map(v=>[v.readyState,v.paused])}:null})()"), 'fetched', [i for i in imgs[n0:]])
      if nm=='ps5':
        # open the player from the frame's own button, check it, close with Escape
        await pg.evaluate("window.__world.page.scrollTo(0.0)"); await asyncio.sleep(4)
        btn=await pg.evaluate("(()=>{const b=document.querySelector('.pp-acts .wr-link:last-child'); return b? b.textContent:null})()"); print('acts button', btn)
        await pg.click('.pp-acts button.wr-link'); await asyncio.sleep(3)
        st=await pg.evaluate("(()=>{const v=document.querySelector('.pp-film video'); return v?{ctrl:v.controls,pi:v.playsInline,pre:v.preload,poster:v.poster.split('/').pop(),paused:v.paused,muted:v.muted,focus:document.activeElement===v,ready:v.readyState,src:v.currentSrc.split('/').pop()}:null})()"); print('film', st)
        await pg.screenshot(path=O+f'{MODE}_film_open.png',timeout=90000)
        await pg.keyboard.press('Escape'); await asyncio.sleep(1.5)
        print('after esc', await pg.evaluate("({film:!!document.querySelector('.pp-film'), page:!!window.__world.page, focus:document.activeElement&&document.activeElement.textContent.slice(0,30)})"))
        fk=await pg.evaluate("(()=>{const p=window.__world.page,f=p.items.find(i=>i.k==='film'); return (f.pos-p.x0-(p.mob?0:p.visW*0.15))/p.max})()"); print("film k",fk); await pg.evaluate(f"window.__world.page.scrollTo({fk})"); await asyncio.sleep(8)
        vis=await pg.evaluate("(()=>{const b=document.querySelector('.pp-play'); return b?[b.style.visibility,b.getBoundingClientRect().x|0,b.getBoundingClientRect().y|0]:null})()"); print('play btn', vis)
        if vis and vis[0]=='visible':
          await pg.click('.pp-play'); await asyncio.sleep(3)
          await pg.screenshot(path=O+f'{MODE}_film_open2.png',timeout=90000)
          await pg.click('.pp-film-x'); await asyncio.sleep(1)
          print('after x', await pg.evaluate("({film:!!document.querySelector('.pp-film'), page:!!window.__world.page})"))
      await pg.evaluate(f"{R}.closePage()")
      for _ in range(30):
        await asyncio.sleep(1)
        if not await pg.evaluate("window.__world.busy()"): break
    print(MODE,'scrollW',await pg.evaluate('document.documentElement.scrollWidth'))
    print(MODE,'logs',logs[:20]); await b.close()
try: asyncio.run(main())
finally: SRV.terminate()
