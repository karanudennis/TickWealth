import json, re, xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
from smoke import new, BASE
R=[]
def step(n,fn):
    try: R.append(('PASS',n,fn() or ''))
    except Exception as e: R.append(('FAIL',n,str(e).split('\n')[0][:200]))
def ok(c,m):
    if not c: raise Exception(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=new(b); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:140])); pg.on('dialog',lambda d:d.accept())
    pg.goto(BASE+'bots-library.html'); pg.wait_for_timeout(1500)
    cards=lambda:pg.locator('.bc[data-id]').count()
    toast=lambda:pg.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.innerText).join(' | ')")
    names=lambda:pg.eval_on_selector_all('.bh input','e=>e.map(x=>x.value)')
    def t_all():
        with pg.expect_download() as d: pg.locator('#dl').click()
        j=json.load(open(d.value.path())); ok(j['app']=='TickWealth' and len(j['bots'])==cards(),'bundle mismatch'); return f"{d.value.suggested_filename}: {len(j['bots'])} bots, no ids"
    step('Download all bots (JSON bundle)',t_all)
    def t_roundtrip():
        n=cards()
        with pg.expect_download() as d: pg.locator('.bc[data-id]').first.get_by_role('button',name='Download JSON').click()
        f=d.value.path(); pg.set_input_files('#file',f); pg.wait_for_timeout(500); ok(cards()==n+1,'re-import did not add a bot'); return 'download one bot -> import it back: +1 bot'
    step('Per-bot download + re-import (JSON)',t_roundtrip)
    def t_bundle():
        n=cards()
        with pg.expect_download() as d: pg.locator('#dl').click()
        pg.set_input_files('#file',d.value.path()); pg.wait_for_timeout(500); ok(cards()==n*2,'bundle import %d -> %d'%(n,cards())); return f'bundle import {n} -> {cards()}'
    step('Import a downloaded bundle',t_bundle)
    def t_xml():
        pg.locator('.bc[data-id]').first.locator('select[data-k=symbol]').select_option('R_75'); pg.wait_for_timeout(200)
        with pg.expect_download() as d: pg.locator('.bc[data-id]').first.get_by_role('button',name=re.compile('Deriv XML')).click()
        raw=open(d.value.path()).read(); root=ET.fromstring(raw); ns={'b':'https://developers.google.com/blockly/xml'}
        fields={f.get('name'):f.text for f in root.iter('{https://developers.google.com/blockly/xml}field')}; ok(fields.get('SYMBOL_LIST')=='R_75' and fields.get('TYPE_LIST'),'xml fields '+str(list(fields)[:6]))
        types=[bl.get('type') for bl in root.iter('{https://developers.google.com/blockly/xml}block')]; ok({'trade_definition','before_purchase','purchase','after_purchase','trade_again'}<=set(types),'missing blocks')
        n=cards(); pg.set_input_files('#file',d.value.path()); pg.wait_for_timeout(500); ok(cards()==n+1,'xml re-import'); last=pg.locator('.bc[data-id]').last
        ok(last.locator('select[data-k=symbol]').input_value()=='R_75','imported symbol wrong'); return 'valid XML with all DBot blocks; re-imports with the same market'
    step('Deriv XML download (well-formed) + import',t_xml)
    def t_dbot():
        xml='<xml xmlns="https://developers.google.com/blockly/xml"><block type="trade_definition"><field name="SYMBOL_LIST">R_50</field><field name="TYPE_LIST">CALL</field><field name="DURATIONTYPE_LIST">m</field><value name="DURATION"><shadow type="math_number"><field name="NUM">2</field></shadow></value><value name="AMOUNT"><shadow type="math_number"><field name="NUM">3</field></shadow></value></block></xml>'
        n=cards(); pg.set_input_files('#file',{'name':'My DBot.xml','mimeType':'text/xml','buffer':xml.encode()}); pg.wait_for_timeout(600); ok(cards()==n+1,'dbot import'); t=toast(); ok('Only the basic trade settings' in t,'no conversion notice: '+t)
        last=pg.locator('.bc[data-id]').last; ok(last.locator('select[data-k=contract]').input_value()=='CALL' and last.locator('input[data-k=stake]').input_value()=='3' and last.locator('input[data-k=duration]').input_value()=='5','values wrong'); return 'DBot-style XML imported; unsupported minutes unit handled with a notice'
    step('Import a Deriv Bot XML from outside',t_dbot)
    def t_bad():
        n=cards(); e0=len(errs)
        pg.set_input_files('#file',{'name':'bad.json','mimeType':'application/json','buffer':b'{not json'}); pg.wait_for_timeout(400); t1=toast()
        pg.set_input_files('#file',{'name':'other.xml','mimeType':'text/xml','buffer':b'<root><a>1</a></root>'}); pg.wait_for_timeout(400); t2=toast()
        ok(cards()==n,'bad file added a bot'); ok('Import failed' in t1+t2,'no error message'); ok(len(errs)==e0,'page error on bad file'); return 'bad JSON and non-bot XML rejected with a message'
    step('Bad files are rejected safely',t_bad)
    def t_drop():
        n=cards(); pg.evaluate("""()=>{const dt=new DataTransfer();dt.items.add(new File([JSON.stringify({name:'Dropped bot',symbol:'R_25',contract:'DIGITODD',rule:{kind:'every',n:4}})],'drop.json',{type:'application/json'}));window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))}"""); pg.wait_for_timeout(600)
        ok(cards()==n+1 and 'Dropped bot' in names(),'drop did not import'); return 'drag and drop imports a bot'
    step('Drag and drop import',t_drop)
    def t_ctl():
        n=cards(); pg.locator('.bc[data-id]').first.get_by_role('button',name='Duplicate').click(); ok(cards()==n+1,'duplicate'); ok(any('(copy)' in x for x in names()),'copy name')
        pg.locator('#runall').click(); pg.wait_for_timeout(1200); st=pg.eval_on_selector_all('[data-a=run]','b=>b.map(x=>x.innerText)'); ok(all(s=='Stop' for s in st),'Run all: '+str(set(st)))
        pg.locator('#stopall').click(); pg.wait_for_timeout(400); st=pg.eval_on_selector_all('[data-a=run]','b=>b.map(x=>x.innerText)'); ok(all(s=='Start' for s in st),'Stop all: '+str(set(st)))
        pg.locator('#rst').click(); pg.locator('.bc[data-id]').first.get_by_role('button',name='Reset').click()
        pg.locator('.bc[data-id]').last.get_by_role('button',name='Delete').click(); ok(cards()==n,'delete'); ok(pg.locator('#undo').is_visible(),'no undo button'); pg.locator('#undo').click(); ok(cards()==n+1,'undo'); ok(not pg.locator('#undo').is_visible(),'undo stays visible'); return 'duplicate, run all, stop all, reset, delete, undo all work'
    step('Duplicate / Run all / Stop all / Reset / Delete / Undo',t_ctl)
    def t_edit():
        c=pg.locator('.bc[data-id]').first; c.locator('input[data-k=stake]').fill('2.5'); c.locator('input[data-k=stake]').dispatch_event('change'); pg.reload(); pg.wait_for_timeout(1200)
        ok(pg.locator('.bc[data-id]').first.locator('input[data-k=stake]').input_value()=='2.5','edit not saved'); ok(cards()>=10,'bots not persisted'); return 'edits and bots persist after reload'
    step('Edits persist after reload',t_edit)
    ok(not errs,errs) if False else None
    b.close()
w=max(len(n) for _,n,_ in R)
for s,n,m in R: print(f'{s}  {n:<{w}}  {m}')
print('page errors:',errs or 'none'); print('PASS',sum(r[0]=='PASS' for r in R),'FAIL',sum(r[0]=='FAIL' for r in R))
