#!/usr/bin/env python3
"""Generate static outlines and a local search index from public Markdown."""
import argparse,json,re
from html import unescape
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true',help='Fail if the generated outline/search index is stale; do not write files.')
args=parser.parse_args()
def plain(s):
    s=re.sub(r'{[%{].*?[%}]}',' ',s,flags=re.S)
    s=re.sub(r'<[^>]+>',' ',s)
    s=re.sub(r'\[([^]]+)\]\([^)]*\)',r'\1',s)
    return re.sub(r'\s+',' ',unescape(s).replace('`','').replace('**','')).strip()
def slug(s):
    s=re.sub(r'[^a-z0-9\s-]','',plain(s).lower())
    return re.sub(r'\s+','-',s).strip('-')
pages={}; search=[]
for p in sorted(SITE.rglob('*.md')):
    if any(part.startswith('_') for part in p.relative_to(SITE).parts):continue
    source=p.read_text(encoding='utf-8')
    if not source.startswith('---\n'):continue
    _,front,body=source.split('---',2)
    if not re.search(r'^layout: document$',front,re.M):continue
    title=re.search(r'^title:\s*(.*)$',front,re.M).group(1).strip('"\'')
    permalink=re.search(r'^permalink:\s*(.*)$',front,re.M)
    path=p.relative_to(SITE).with_suffix('').as_posix()
    url=permalink.group(1).strip() if permalink else '/'+path.removesuffix('/index')+'/'
    if url=='/404.html':continue
    heads=list(re.finditer(r'^(#{2,3})\s+(.+)$|^<h([23])\s+id="([^"]+)"[^>]*>(.*?)</h[23]>',body,re.M))
    sections=[];used={}
    search.append({'title':title,'context':'Documentation','url':url,'text':plain(re.search(r'^description:\s*(.*)$',front,re.M).group(1))})
    for i,h in enumerate(heads):
        level=len(h.group(1)) if h.group(1) else int(h.group(3))
        label=plain(h.group(2) or h.group(5));anchor=h.group(4) or slug(label)
        count=used.get(anchor,0);used[anchor]=count+1
        if count:anchor+='-'+str(count)
        if label=='Contents':continue
        text=plain(body[h.end():heads[i+1].start() if i+1<len(heads) else len(body)])
        search.append({'title':label,'context':title,'url':url+'#'+anchor,'text':text})
        if level==2:sections.append({'title':label,'id':anchor})
    pages[url]={'title':title,'sections':sections}
output=SITE/'_data/documentation.json'
expected=json.dumps({'pages':pages,'search':search},ensure_ascii=False,indent=2)+'\n'
if args.check:
    if not output.is_file() or output.read_text(encoding='utf-8')!=expected:
        raise SystemExit('Stale documentation index. Run python tools/generate_documentation_index.py.')
    print(f'Documentation index is current ({len(search)} page/section entries).')
else:
    output.write_text(expected,encoding='utf-8')
    print(f'Indexed {len(pages)} documentation pages and {len(search)} page/section entries.')
