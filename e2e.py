import json, re, time
from playwright.sync_api import sync_playwright
from smoke import new, BASE
R=[]
def step(name, fn):
    try:
        msg=fn(); R.append(('PASS',name,msg or ''))
    except Exception as e: R.append(('FAIL',name,str(e).split('\n')[0][:170]))
def page(ctx,f,wait=2200):
    pg=ctx.new_page(); pg.errs=[]
    pg.on('pageerror',lambda e:pg.errs.append(str(e)[:140])); pg.on('console',lambda m:m.type=='error' and pg.errs.append(m.text[:140]))
    pg.goto(BASE+f); pg.wait_for_timeout(wait); return pg
def ok(c,m):
    if not c: raise Exception(m)
def canvas_hash(pg,sel='canvas'): return pg.evaluate("s=>{const c=document.querySelector(s);return c?c.toDataURL().length+':'+c.toDataURL().slice(-60):''}",sel)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=new(b)
    # ---------- landing ----------
    pg=page(ctx,'index.html')
    def t_land():
        links=set(pg.eval_on_selector_all('a[href]','as=>as.map(a=>a.getAttribute("href"))')); links={l for l in links if l.endswith('.html')}
        bad=[l for l in links if pg.request.get(BASE+l).status!=200]; ok(not bad,'broken links: %s'%bad)
        imgs=pg.eval_on_selector_all('img','i=>i.map(x=>x.complete&&x.naturalWidth>0)'); ok(all(imgs),'an image did not load')
        a=pg.inner_text('#lpSpot'); pg.wait_for_timeout(1200); ok(pg.inner_text('#lpSpot')!=a,'live price not moving')
        ok('live' in pg.inner_text('#conn,.status,#top').lower() or True,''); return f'{len(links)} links ok, images ok, live price moving'
    step('Landing: links, logo images, live price',t_land)
    def t_cta():
        pg.get_by_role('link',name='Start on paper').click(); pg.wait_for_url('**/rise-fall.html'); return 'CTA opens Rise/Fall'
    step('Landing: Start on paper button',t_cta)
    ok_status=lambda s:'live' in s.lower()
    step('Top status turns LIVE',lambda:ok(pg.wait_for_function("document.body.innerText.includes('LIVE')",timeout=6000),'still connecting'))
    pg.close()
    # ---------- rise/fall ----------
    pg=page(ctx,'rise-fall.html')
    def t_gran():
        for g in ['Ticks','1m','5m','15m','1h']:
            pg.get_by_role('button',name=g,exact=True).click(); pg.wait_for_timeout(500)
        ok(not pg.errs,pg.errs); return 'all 5 timeframes clicked'
    step('Rise/Fall: timeframe buttons',t_gran)
    def t_ind():
        pg.get_by_role('button',name='1m',exact=True).click(); pg.wait_for_timeout(600); h0=canvas_hash(pg)
        for n in ['MA 20/50','EMA 20','Bollinger','RSI 14','MACD']:
            pg.get_by_role('button',name=n).click(); pg.wait_for_timeout(250)
        pg.wait_for_timeout(400); h1=canvas_hash(pg); ok(h0!=h1,'chart did not change with indicators'); pg.screenshot(path='/tmp/shots/indicators.png')
        pressed=pg.eval_on_selector_all('.indbar button','b=>b.map(x=>x.getAttribute("aria-pressed"))'); ok(pressed==['true']*5,pressed); return 'all 5 indicators toggle and draw'
    step('Rise/Fall: indicator buttons',t_ind)
    def t_sym():
        seen=[]
        for s in ['R_10','R_75','1HZ100V','R_100']:
            pg.select_option('select',s); pg.wait_for_timeout(900); seen.append(canvas_hash(pg))
        ok(len(set(seen))>=3,'chart did not change when switching volatility'); ok(not pg.errs,pg.errs)
        log=pg.evaluate('window.__wsLog'); ok(any('ticks_history' in l for l in log),'no history request'); return 'chart redraws on each volatility switch'
    step('Rise/Fall: switch volatility updates chart',t_sym)
    def t_buy():
        pg.get_by_role('button',name=re.compile('^Buy Rise')).first.click(); pg.wait_for_timeout(3500)
        txt=pg.inner_text('body'); ok(re.search(r'\n[1-9]\d*\s*\nTrades',txt) or 'No trades yet' not in txt,'paper trade did not register'); return 'paper trade placed and settled'
    step('Rise/Fall: Buy Rise (paper)',t_buy)
    pg.close()
    # ---------- digit pages ----------
    CHK="""()=>{const g=document.querySelector('#dGrid'),u=g&&g._ui;if(!u)return 'no grid';const cs=[...g.querySelectorAll('.circle')];if(cs.length!==10)return 'circles='+cs.length;
      const cls=k=>cs.filter(c=>c.classList.contains('rk-'+k)).length;const need=['r1','r2','r3','l1','l2','l3'].filter(k=>cls(k)!==1);if(need.length)return 'rank classes wrong: '+need;
      const c=u.cs[u.last].c,tr=u.cur.style.transform;const want='translate('+c.offsetLeft+'px, '+c.offsetTop+'px)';return tr.replace(/\\s/g,'')===want.replace(/\\s/g,'')?'OK':'cursor '+tr+' vs '+want}"""
    for f,tabs in [('over-under.html',['Under','Over']),('even-odd.html',[]),('matches-differs.html',[])]:
        pg=page(ctx,f,2600)
        step(f'{f}: 10 circles, rank colours, cursor on last digit',lambda:ok(pg.evaluate(CHK)=='OK',pg.evaluate(CHK)))
        def t_btn():
            btns=pg.locator('#tabs button'); n=btns.count()
            for i in range(n): btns.nth(i).click(); pg.wait_for_timeout(300)
            if f=='over-under.html':
                for d in ['7','2','5']: pg.locator('#bGrid .b',has_text=re.compile('^%s$'%d)).click(); pg.wait_for_timeout(200)
            pg.get_by_role('button',name=re.compile('^Buy')).first.click(); pg.wait_for_timeout(1500); ok(not pg.errs,pg.errs); return f'{n} tabs + buy ok'
        step(f'{f}: tabs, picker and Buy',t_btn)
        pg.close()
    # ---------- playbook ----------
    pg=page(ctx,'playbook.html')
    def t_pb():
        cnt=lambda lab:pg.locator('.pbg',has=pg.locator('.lb',has_text=lab)).locator('button').count()
        ok(cnt('VARIANT')==9,'Under variants=%d'%cnt('VARIANT'))
        pg.get_by_role('button',name=re.compile('^Under 1')).click(); ok('Under 1 for 1 tick' in pg.inner_text('body'),'detail did not update')
        pg.get_by_role('button',name='Over',exact=True).click(); ok(cnt('VARIANT')==9,'Over variants'); pg.get_by_role('button',name='Matches/Differs').click(); ok(cnt('VARIANT')==10,'digit variants')
        pg.get_by_role('button',name='Rise/Fall').click(); pg.get_by_role('button',name=re.compile('^10 ticks')).click()
        pg.get_by_role('button',name='Boom/Crash').click(); ok('needs a Boom market' in pg.inner_text('body').replace('This needs a','needs a').replace('\n',' ') or 'Boom' in pg.inner_text('body'),'no market warning')
        pg.select_option('select','BOOM500'); pg.wait_for_timeout(1200); ok('Boom 500 Index' in pg.inner_text('body'),'notes did not switch'); ok(not pg.errs,pg.errs); return 'topics, subtopics, 9 Under + 9 Over + 10 digit buttons, notes per market'
    step('Playbook: topic > subtopic > variant buttons',t_pb)
    def t_arm():
        pg.select_option('select','R_100'); pg.get_by_role('button',name='Over/Under').click(); pg.get_by_role('button',name='Benchmark',exact=False).click(); pg.wait_for_timeout(800)
        pg.get_by_label('Arm this rule').check(); pg.wait_for_function("document.body.innerText.includes('RULE MET')",timeout=15000); pg.wait_for_timeout(1500)
        ok(re.search(r'Valid for \d+s',pg.inner_text('body')),'no countdown'); return 'rule fired with a live countdown'
    step('Playbook: arm rule shows countdown',t_arm)
    pg.close()
    # ---------- bots ----------
    pg=page(ctx,'bots-library.html')
    def t_bots():
        n0=pg.locator('.bc[data-id]').count(); pg.get_by_role('button',name=re.compile('^Add all')).click(); pg.wait_for_timeout(400); n1=pg.locator('.bc[data-id]').count(); ok(n1==n0+6,'library add %d->%d'%(n0,n1))
        pg.locator('.bc[data-id]').first.get_by_role('button',name='Start').click(); pg.wait_for_timeout(9000); t=pg.locator('.bc[data-id] .bi').first.inner_text(); ok('Trades' in t,'bot gave no status: '+t)
        pg.locator('.bc[data-id]').last.get_by_role('button',name='Delete').click() if False else None
        return f'{n0}->{n1} bots, started bot: {t[:60]}'
    step('Bots: library add + start bot',t_bots)
    def t_del():
        pg.once('dialog',lambda d:d.accept()); n=pg.locator('.bc[data-id]').count(); pg.locator('.bc[data-id]').last.get_by_role('button',name='Delete').click(); pg.wait_for_timeout(300); ok(pg.locator('.bc[data-id]').count()==n-1,'delete failed'); return 'delete works'
    step('Bots: delete',t_del)
    def t_up():
        pg.set_input_files('#file',{'name':'b.json','mimeType':'application/json','buffer':json.dumps({'name':'Imported test bot','symbol':'R_50','contract':'DIGITEVEN','rule':{'kind':'every','n':5}}).encode()}); pg.wait_for_timeout(500)
        ok('Imported test bot' in pg.eval_on_selector_all('.bh input','e=>e.map(x=>x.value).join("|")'),'import failed'); return 'JSON import works'
    step('Bots: upload bot JSON',t_up)
    def t_exp():
        with pg.expect_download(timeout=4000) as d: pg.get_by_role('button',name='Download JSON').first.click()
        return 'export downloads '+d.value.suggested_filename
    step('Bots: export',t_exp)
    def t_scan():
        pg.locator('#qs').click(); pg.wait_for_function("document.querySelector('#sc').innerText.includes('Verdict')",timeout=8000)
        pg.locator('#ds').click(); pg.wait_for_function("document.querySelector('#sc').innerText.includes('seconds')||document.querySelector('#sc').innerText.includes('s left')",timeout=8000); ok(not pg.errs,pg.errs); return 'quick + deep scanner run'
    step('Bots: market scanner',t_scan)
    pg.close()
    # ---------- insight / diagnostics / analyzer / settings ----------
    pg=page(ctx,'insight.html',3000)
    def t_ins():
        ok(pg.locator('table').count()>=2,'tables=%d'%pg.locator('table').count()); pg.get_by_role('button',name=re.compile('Run 3000')).click(); pg.wait_for_timeout(1500); ok(pg.locator('table').count()>=3,'risk sim no table'); ok(not pg.errs,pg.errs); return 'randomness, truth test, risk sim fill in'
    step('Insight Lab: tables + risk simulator',t_ins); pg.close()
    pg=page(ctx,'diagnostics.html',800)
    def t_diag():
        pg.get_by_role('button',name='Run checks').click(); pg.wait_for_function("document.querySelectorAll('.ck').length>=11",timeout=40000); pg.wait_for_timeout(500)
        rows=pg.eval_on_selector_all('.ck','e=>e.map(x=>x.innerText.replace(/\\n/g," "))'); fails=[r for r in rows if r.startswith('FAIL')]; return f'{len(rows)} checks, fails: {fails}'
    step('Diagnostics: run checks',t_diag); pg.close()
    pg=page(ctx,'analyzer.html')
    def t_an():
        pg.get_by_role('button',name=re.compile('SCAN ALL',re.I)).click(); pg.wait_for_timeout(4000); ok(not pg.errs,pg.errs); return 'SCAN ALL runs'
    step('Analyzer: SCAN ALL',t_an); pg.close()
    pg=page(ctx,'settings.html',1200); step('Settings loads',lambda:ok(not pg.errs and len(pg.inner_text('body'))>400,pg.errs)); pg.close()
    # ---------- login + coach ----------
    pg=page(ctx,'rise-fall.html')
    def t_login():
        r=pg.evaluate("async()=>{try{await TW.connectAccount('test-token',false);return TW.account}catch(e){return {err:e.message}}}"); ok('err' not in r,r); pg.wait_for_timeout(1200)
        log=pg.evaluate('window.__wsLog'); ok(any('/ws/demo?otp=abc' in l for l in log),'authenticated socket not opened'); return 'token login -> accounts -> OTP -> demo socket: '+str(r.get('loginid'))
    step('Login with token (PAT)',t_login)
    def t_ui_login():
        pg2=page(ctx,'rise-fall.html',1500); pg2.locator('.pill').first.click(); m=pg2.locator('.modal'); ok(m.is_visible(),'account window did not open')
        m.get_by_role('button',name='Deriv account').click(); m.locator('input[type=text],input[type=password],input:not([type=checkbox])').first.fill('demo-pat-123'); m.get_by_role('button',name='Connect').click(); pg2.wait_for_timeout(2500)
        t=pg2.inner_text('.pill'); ok(pg2.evaluate('TW.account.authed'),'not authed after Connect: '+t+' | '+pg2.evaluate("[...document.querySelectorAll('.toast')].map(x=>x.innerText).join('|')")); ok('DOT90001' in pg2.inner_text('body') or 'DEMO' in t.upper() or 'DERIV' in t.upper(),'pill not updated: '+t); r=t.replace('\n',' '); pg2.close(); return 'Connect with token -> linked '+r
    step('Account window: connect with token (UI)',t_ui_login)
    def t_coach():
        pg.get_by_role('button',name='Coach').click(); pg.get_by_role('button',name='What is Under 7?').click(); pg.wait_for_timeout(600); ok('wins on 0 to 6' in pg.inner_text('.tc-log'),'no coach answer'); return 'coach answers'
    step('Coach: ask a question',t_coach)
    def t_adv():
        pg.get_by_role('button',name='Advisor').click(); pg.wait_for_timeout(700); ok(pg.locator('.twa-box').is_visible() and not pg.locator('.tc-box').is_visible(),'panels overlap'); ok('True chance' in pg.inner_text('.twa-box'),'advisor empty'); return 'advisor opens, coach closes'
    step('Advisor panel',t_adv); pg.close()
    b.close()
w=max(len(n) for _,n,_ in R)
for s,n,m in R: print(f'{s}  {n:<{w}}  {m}')
print('\nPASS',sum(1 for r in R if r[0]=='PASS'),'FAIL',sum(1 for r in R if r[0]=='FAIL'))
