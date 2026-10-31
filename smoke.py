import sys, json, re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8000/'
PAGES=['index.html','rise-fall.html','over-under.html','even-odd.html','matches-differs.html','analyzer.html','playbook.html','insight.html','bots-library.html','settings.html','diagnostics.html']
mock=open('mock.js').read()
CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
def route(r):
    u=r.request.url
    if r.request.method=='OPTIONS': return r.fulfill(status=204,headers=CORS)
    if u.endswith('/otp'): return r.fulfill(status=200,headers=CORS,content_type='application/json',body=json.dumps({'data':{'url':'wss://api.derivws.com/trading/v1/options/ws/demo?otp=abc'}}))
    if '/trading/v1/options/accounts' in u: return r.fulfill(status=200,headers=CORS,content_type='application/json',body=json.dumps({'data':[{'account_id':'DOT90001','account_type':'demo','currency':'USD','balance':10000}]}))
    r.continue_()
def new(b):
    ctx=b.new_context(viewport={'width':1280,'height':900}); ctx.add_init_script(mock); ctx.route('https://api.derivws.com/**',route); return ctx
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(); ctx=new(b); bad=0
        for f in PAGES:
            pg=ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e,errs=errs:errs.append('PAGEERROR '+str(e)[:160]))
            pg.on('console',lambda m,errs=errs:m.type=='error' and errs.append('console: '+m.text[:160]))
            pg.on('requestfailed',lambda r,errs=errs:errs.append('reqfail: '+r.url[-60:]))
            pg.goto(BASE+f); pg.wait_for_timeout(2500)
            top=len(pg.inner_text('#top').strip()) if pg.query_selector('#top') else -1
            body=len(pg.inner_text('body').strip())
            pg.screenshot(path='/tmp/shots/'+f.replace('.html','.png'))
            print(f'{f:22} top={top:4} body={body:5} errors={len(errs)}'); [print('    ',e) for e in errs[:6]]; bad+=len(errs); pg.close()
        print('TOTAL ERRORS',bad); b.close()
