"""Render the completed pairs from a private TTS run for blind listening."""
import hashlib
import html
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
clips = {c["id"]: c for c in json.loads((root / "listening-inputs.json").read_text("utf8"))}
parts = ['''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sahva voice comparison</title><style>body{font:17px/1.5 system-ui;max-width:760px;margin:2rem auto;padding:0 1rem}section{border-top:1px solid #aaa;margin:1.5rem 0}label{display:block;margin:1rem 0}textarea{width:100%}audio{max-width:100%}</style>
<h1>Compare the two voices</h1><p>Play A and B for each phrase. Listen for names, numbers, negations, pronunciation and natural pacing. The labels are shuffled for each pair.</p>''']
pair_ids = []
for a in sorted(root.glob("*-A.json")):
    b = a.with_name(a.name[:-6] + "B.json")
    if not b.exists():
        continue
    ra, rb = [json.loads(f.read_text("utf8")) for f in (a, b)]
    if any(r["status"] != "ok" for r in (ra, rb)):
        continue
    text = clips[ra["fixture"]]["text"]
    assert ra["fixture"] == rb["fixture"] and ra["repeat"] == rb["repeat"] and ra["engine"] != rb["engine"]
    assert ra["textSha256"] == rb["textSha256"] == hashlib.sha256(text.encode()).hexdigest()
    key = ra["fixture"] + "-" + str(ra["repeat"])
    pair_ids.append(key)
    parts.append(f'<section data-pair="{html.escape(key,quote=True)}"><h2>{html.escape(ra["target"])} · {html.escape(key)}</h2><p>{html.escape(text)}</p>')
    for label, file, row in (("A", a, ra), ("B", b, rb)):
        wav = file.with_suffix(".wav")
        assert hashlib.sha256(wav.read_bytes()).hexdigest() == row["wavSha256"]
        parts.append(f'<p>{label}<br><audio controls preload="none" src="{html.escape(wav.name,quote=True)}"></audio></p>')
    parts.append('''<label>Preferred voice <select><option value="">Choose after listening</option><option>A</option><option>B</option><option>Tie</option><option>Neither</option></select></label>
<label>What sounded right or wrong? <textarea rows="2"></textarea></label></section>''')
parts.append('''<label>Reviewer initials <input id="reviewer"></label><button id="save">Download listening review</button> <span id="status" role="status"></span>
<script>
document.querySelector('#save').onclick=()=>{
 const reviewer=document.querySelector('#reviewer').value.trim();
 const ratings=[...document.querySelectorAll('section')].filter(s=>s.querySelector('select').value)
 .map(s=>({pair:s.dataset.pair,preference:s.querySelector('select').value,notes:s.querySelector('textarea').value.trim()}));
 if(!reviewer||!ratings.length){document.querySelector('#status').textContent='Enter initials and review at least one pair.';return;}
 const url=URL.createObjectURL(new Blob([JSON.stringify({reviewer,run:RUN,reviewedAt:new Date().toISOString(),ratings},null,2)],{type:'application/json'}));
 const a=document.createElement('a'); a.href=url; a.download='sahva-voice-review.json'; a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 document.querySelector('#status').textContent='Saved '+ratings.length+' reviews.';
};</script>'''.replace("run:RUN", "run:" + json.dumps(root.resolve().name).replace("<", "\\u003c")))
(root / "listening.html").write_text("\n".join(parts), encoding="utf8")
print(len(pair_ids), "complete blind listening pairs")
