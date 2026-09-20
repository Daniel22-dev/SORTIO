#!/usr/bin/env python3
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import os, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
out=Path(sys.argv[2] if len(sys.argv)>2 else 'SORTIO-1.1.20-GARP2.5-BUILD-INPUT-SOURCE.zip').resolve()
skip_dirs={'.git','node_modules','dist','dist-school-server','dist-deployment','qa-results','test-results','audit-evidence'}
skip_prefixes=('security/evidence/','security/release-integrity/')
skip_names={out.name}
files=[]
for p in root.rglob('*'):
    rel=p.relative_to(root).as_posix()
    if any(part in skip_dirs for part in p.relative_to(root).parts): continue
    if rel.startswith(skip_prefixes): continue
    if p.is_symlink(): raise SystemExit(f'symlink forbidden: {rel}')
    if p.is_file() and p.name not in skip_names: files.append((rel,p))
files.sort(key=lambda x:x[0].encode('utf-8'))
out.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=9) as z:
    for rel,p in files:
        info=ZipInfo(rel,(2026,9,13,6,0,0)); info.compress_type=ZIP_DEFLATED; info.external_attr=(0o100644 << 16)
        z.writestr(info,p.read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=9)
print(f'{out} files={len(files)}')
