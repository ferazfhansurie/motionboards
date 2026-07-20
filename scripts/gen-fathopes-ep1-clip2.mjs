import { promises as fs } from "node:fs";
import path from "node:path";
const ROOT="/Users/faeez/motionboards";
const MODEL="dreamina-seedance-2-0-fast-260128/omni";
const OUT=path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-clip2-next15-v2.mp4");
const REFS=[
 path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-next-storyboard/ep1-next15-8panel-storyboard-final.png"),
 path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-next-storyboard-frames/approved-clip-last-frame.png"),
 path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-manifest/fh-ep1-sinki-backplate.png"),
 path.join(ROOT,"fathopes-heroes-series-bible/Generated image 1.png"),
 path.join(ROOT,"fathopes-heroes-series-bible/Kit-action 2.png")
];
async function env(){for(const f of ["env.local",".env.local"]){try{const raw=await fs.readFile(path.join(ROOT,f),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}catch{}}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function upload(base,key,file,i){const b=await fs.readFile(file);const type=file.endsWith(".jpg")?"image/jpeg":"image/png";const r=await fetch(`${base}/api/upload`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":type,"x-filename":`ep1-clip2-ref-${i+1}.png`},body:b});const j=await r.json().catch(()=>({}));if(!r.ok||!j.url)throw Error(`upload failed ${file} ${r.status}`);return j.url;}
async function main(){await env();const base=(process.env.MB_BASE||"https://motionboards.vercel.app").replace(/\/$/,"");const key=process.env.MB_KEY||process.env.MB_API_KEY;if(!key)throw Error("Missing API key");const raw=await fs.readFile(path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-seedance-prompts/clip-02-final-startframe-prompt.txt"),"utf8");const prompt=raw.split("PASTE-READY PROMPT\n")[1].trim();console.log(`prompt ${prompt.length} chars`);const urls=[];for(let i=0;i<REFS.length;i++){urls.push(await upload(base,key,REFS[i],i));console.log(`uploaded Image${i+1}`);}const r=await fetch(`${base}/api/generate`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,prompt,inputImages:urls,generationOptions:{aspect_ratio:"9:16",resolution:"720p",duration:"15s",generate_audio:true}})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.requestId||!j.generationId)throw Error(`submit failed ${r.status} ${JSON.stringify(j)}`);console.log(`submitted ${j.requestId}`);const qs=new URLSearchParams({requestId:j.requestId,modelId:MODEL,generationId:j.generationId,byteplusVideo:"true",durationSec:"15",resolution:"720p"});let url;for(let i=1;i<=120;i++){await sleep(5000);const s=await fetch(`${base}/api/generate/status?${qs}`,{headers:{Authorization:`Bearer ${key}`}});const sj=await s.json().catch(()=>({}));if(sj.status==="completed"&&sj.outputUrl){url=sj.outputUrl;break;}if(sj.status==="failed")throw Error(`generation failed: ${sj.error||"unknown"}`);if(i%6===0)console.log(`${i*5}s ${sj.status||"processing"}`);}if(!url)throw Error("timed out");const v=await fetch(url,{headers:{Authorization:`Bearer ${key}`}});await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,Buffer.from(await v.arrayBuffer()));console.log(`saved ${OUT}`);}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
