# ops/tests/test_minio_smoke.py
import json, os, time, urllib.request

BASE = os.getenv("API_BASE", "http://localhost:4000")

def _post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BASE + path, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def _get_json(path):
    with urllib.request.urlopen(BASE + path, timeout=15) as r:
        return json.loads(r.read().decode())

def test_minio_smoke_end_to_end():
    # 1) tạo block + job
    block = _post("/blocks", {"text": "Hi. Test."})
    job = _post("/jobs/tts", {"blockId": block["id"]})

    # 2) poll trạng thái
    state = "unknown"
    for _ in range(90):
        st = _get_json(f"/jobs/{job['jobId']}/status")
        state = st.get("state", "unknown")
        if state in ("done", "error"):
            break
        time.sleep(1.0)
    assert state == "done"

    # 3) đọc manifest
    man = _get_json(f"/blocks/{block['id']}/manifest")
    assert isinstance(man["mixKey"], str) and man["mixKey"].endswith(".wav")
    assert isinstance(man["qcKey"], str) and man["qcKey"].endswith(".json")
    assert "qcBlock" in man and isinstance(man["qcBlock"], dict)

    # 4) tải merged.wav & kiểm tra header/size
    with urllib.request.urlopen(BASE + "/files/" + man["mixKey"], timeout=15) as resp:
        ctype = resp.getheader("Content-Type") or ""
        clen = int(resp.getheader("Content-Length") or 0)
        assert ctype.startswith("audio/")
        assert clen > 1000  # >1KB cho file hợp lệ

    # 5) đọc QC JSON & sanity checks
    qc = _get_json("/files/" + man["qcKey"])
    for k in ("lufsIntegrated", "truePeakDbtp", "clippingCount", "oversampleFactor"):
        assert k in qc
