"""Render the private recording-sheet manifest for a human listening review."""
import html, json, pathlib, re, sys
from urllib.parse import quote

if len(sys.argv) != 2:
    raise SystemExit("Pass the imported private fixture directory")
root = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root/"manifest.draft.json").read_text(encoding="utf8"))
esc = html.escape
parts = ["""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sahva recording review</title><style>body{font:17px/1.5 system-ui;background:#fafaf8;color:#182523;max-width:840px;margin:32px auto;padding:0 20px}section{border-top:1px solid #a9b8b3;padding:16px 0}h2{margin-bottom:4px}textarea{display:block;font:inherit;width:95%;padding:8px}label{display:block;margin:12px 0}audio{display:block;max-width:100%}button{font:inherit;padding:8px}small{color:#42534e}</style>
<h1>Review your Sahva recordings</h1><p>Play each recording. Correct the source to match what you actually said and confirm the intended meaning in the other language. Select only the pairs you have reviewed. Download your corrections before closing this file.</p>"""]
for i,f in enumerate(manifest):
    if not re.fullmatch(r"(EN|TE)-\d{2}",f["id"]) or not re.fullmatch(r"\d{2}/(english|telugu)\.wav", f["wav"]):
        raise ValueError("Unexpected fixture filename")
    parts += [f"<section><h2>{esc(f['id'])}</h2><small>{f['samples']/16000:.2f} seconds · {esc(f['criticalFacts'][0])}</small>",
              f'<audio controls preload="none" src="{quote(f["wav"])}"></audio>']
    reading = root/(f["id"]+"-local.json")
    if reading.exists():
        text = json.loads(reading.read_text(encoding="utf8"))["text"]
        parts += [f"<details><summary>Offline machine reading</summary><p>{esc(text or "The offline recognizer returned no words. Please use the recording.")}</p></details>"]
    for key,label in (("sourceText","Words actually spoken"),("targetText","Intended translation")):
        parts += [f'<label>{label}<textarea id="{key}{i}" rows="2">{esc(f[key])}</textarea></label>']
    parts += [f'<label>Meaning to preserve (names, amounts, negations or other details)<textarea id="facts{i}" rows="1">{esc(chr(10).join(f["criticalFacts"]))}</textarea></label>',
              f'<label><input id="ok{i}" type="checkbox"> I checked both texts against this recording.</label></section>']
parts += ['''<h2>Permission for the checked clips</h2>
<p>Select the tests you authorize for this Sahva benchmark. Saving this form downloads a local file. Each box applies only to the clips you checked.</p>
<label><input type="checkbox" id="mt"> Compare the corrected source text with Sarvam Mayura and Sahva’s private IndicTrans2 worker on this PC.</label>
<label><input type="checkbox" id="asr"> Send the original speech to Sarvam for transcription and the speech-pipeline test (transcription, translation and preset voice playback).</label>
<label><input type="checkbox" id="tts"> Send the verified target text to Sarvam Bulbul and Maya Research’s public Hugging Face Studio for speech generation with built-in voices. The Studio may log submitted text.</label>
<label>Reviewer name or initials <input id="reviewer"></label>
<button id="save">Download checked references</button> <span id="status" role="status"></span>''']
data = json.dumps(manifest,ensure_ascii=False).replace("<","\\u003c")
parts += ['<script>const fixtures='+data+""";
const at=id=>document.getElementById(id);
at('save').onclick=()=>{
 const reviewer=at('reviewer').value.trim();
 const revision=new Date().toISOString();
 const scopes=['mt','asr','tts'].filter(k=>at(k).checked).map(k=>at(k).parentElement.textContent.trim());
 const rows=fixtures.flatMap((f,i)=>at('ok'+i).checked?[{...f,sourceText:at('sourceText'+i).value.trim(),targetText:at('targetText'+i).value.trim(),criticalFacts:at('facts'+i).value.trim().split(/\\n/).map(s=>s.trim()).filter(Boolean),confirmedBy:reviewer,referenceRevision:revision,allowedProcessors:at('mt').checked?['sarvam','indictrans2']:[],consentRecord:scopes.length?reviewer+' · '+revision+' · '+scopes.join(' '):'',speechTestPermissions:{sarvamOriginalAudio:at('asr').checked,sarvamAndHostedMayaTargetText:at('tts').checked}}]:[]);
 if(!reviewer||!rows.length||rows.some(r=>!r.sourceText||!r.targetText||!r.criticalFacts.length)){at('status').textContent='Enter your initials, both texts and the meaning to preserve for at least one checked clip.';return;}
 const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='reviewed-references.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 at('status').textContent='Downloaded '+rows.length+' checked references.';
};</script>"""]
(root/"review.html").write_text("\n".join(parts),encoding="utf8")
print("Private review generated:",len(manifest),"recordings")
