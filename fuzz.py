import re
from playwright.sync_api import sync_playwright
from smoke import new, BASE, PAGES
SKIP=re.compile(r'wipe|disconnect|log ?out|clear all|reset all',re.I)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=new(b); tot=0; bad=0
    for f in PAGES:
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e,errs=errs:errs.append(str(e)[:150])); pg.on('dialog',lambda d:d.accept())
        pg.goto(BASE+f); pg.wait_for_timeout(2200); clicked=0
        sel='button, [role=button], .btn, .pbt, .b, .circle'
        n=pg.locator(sel).count()
        def close_modal():
            try:
                m=pg.locator('.modal').first
                if m.is_visible():
                    cb=m.get_by_role('button',name='Close')
                    cb.click(timeout=800) if cb.count() else pg.keyboard.press('Escape')
            except Exception: pass
        for i in range(n):
            close_modal()
            if pg.url.split('/')[-1].split('?')[0]!=f: pg.goto(BASE+f); pg.wait_for_timeout(1200)
            loc=pg.locator(sel).nth(i) if i<pg.locator(sel).count() else None
            if loc is None: break
            try:
                if not loc.is_visible() or not loc.is_enabled(): continue
                if SKIP.search(loc.inner_text(timeout=300) or ''): continue
                loc.click(timeout=700,no_wait_after=True); clicked+=1; pg.wait_for_timeout(70)
            except Exception: pass
        tot+=clicked; bad+=len(errs); print(f'{f:22} controls={n:3} clicked={clicked:3} errors={len(errs)}'); [print('    ',e) for e in sorted(set(errs))[:4]]; pg.close()
    print('TOTAL clicks',tot,'ERRORS',bad); b.close()
