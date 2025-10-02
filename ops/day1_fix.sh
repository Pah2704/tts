#!/usr/bin/env bash
set -euo pipefail

# 1) Thêm @types/node cho API + ép tsconfig dùng types "node"
python3 - <<'PY'
import json, pathlib

# apps/api/package.json
p = pathlib.Path("apps/api/package.json")
pkg = json.loads(p.read_text())
dev = pkg.setdefault("devDependencies", {})
dev.setdefault("@types/node", "^20.14.2")
p.write_text(json.dumps(pkg, indent=2, ensure_ascii=False))

# apps/api/tsconfig.json
p = pathlib.Path("apps/api/tsconfig.json")
ts = json.loads(p.read_text())
co = ts.setdefault("compilerOptions", {})
types = set(co.get("types", []))
if "node" not in types:
    types.add("node")
    co["types"] = list(types)
p.write_text(json.dumps(ts, indent=2, ensure_ascii=False))
PY

# 2) Ép FE chạy đúng host/port 3000
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("apps/frontend/package.json")
pkg = json.loads(p.read_text())
scripts = pkg.setdefault("scripts", {})
scripts["dev"] = "vite --host --port 3000"
p.write_text(json.dumps(pkg, indent=2, ensure_ascii=False))
PY

echo "✅ Patched: @types/node, tsconfig types=node, FE dev script -> port 3000"