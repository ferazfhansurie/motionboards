import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT="/Users/faeez/motionboards";
const OUT=path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-storyboard-variations");
const BASE=path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-startframes/01-sink-pov-auntie-pan.png");
const SINK=path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-manifest/fh-ep1-sinki-backplate.png");
const MONSTER=path.join(ROOT,"fathopes-heroes-series-bible/Generated image 1.png");
async function env(){const raw=await fs.readFile(path.join(ROOT,"env.local"),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}
async function uri(p){const b=await sharp(p).resize({width:640,height:960,fit:"inside"}).jpeg({quality:62,mozjpeg:true}).toBuffer();return `data:image/jpeg;base64,${b.toString("base64")}`;}
async function gen(key,prompt){const base=process.env.MB_BASE||"https://motionboards.vercel.app";const r=await fetch(`${base}/api/generate`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gemini-3.1-flash-image-preview",prompt,inputImages:await Promise.all([BASE,SINK,MONSTER].map(uri)),generationOptions:{aspect_ratio:"9:16",resolution:"2K"}})});const j=await r.json().catch(()=>({}));if(!r.ok||j.status!=="completed"||!j.outputUrl)throw Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0,500)}`);const i=await fetch(j.outputUrl,{headers:{Authorization:`Bearer ${key}`}});return Buffer.from(await i.arrayBuffer());}
const common=`Use Image 1 as the storyboard base, Image 2 as the exact exterior top-down Malaysian sink, and Image 3 as the exact oily dark-green cartoon worm. Create a vertical 9:16 storyboard image for the first scene. Keep the mixed-media style: flat 2D cartoon over a real photoreal kitchen. The worm is NOT Glinciro. Only the worm's huge sad face is visible through the small black drain hole; its full body stays hidden below the pipe. No Kit, no aunty, no full body, no text, no logo, no watermark.`;
const prompts=[
 `${common} Variation 1: wide top-down view with the sink basin filling most of frame, faucet and window visible above, black drain near the lower center. The worm face is just starting to pop up from the drain, only the upper face visible, sad eyes and a small oily frown. Leave clear space above the sink for later auntie action.`,
 `${common} Variation 2: slightly closer high-angle view from above the counter, drain centered lower frame. The worm face fills the small drain opening but remains cropped by the rim, sad sleepy eyes, round cheeks and a tiny oily mouth. Add a subtle pool of shadow around the drain, but keep the sink dry and photoreal. Leave clear space at the top for the kitchen and future POV cut.`
];
async function main(){await env();const key=process.env.MB_API_KEY||process.env.MB_KEY;if(!key)throw Error("Missing MB_API_KEY or MB_KEY");await fs.mkdir(OUT,{recursive:true});for(let i=0;i<prompts.length;i++){process.stdout.write(`[variation-${i+1}] generating... `);const b=await gen(key,prompts[i]);const f=path.join(OUT,`storyboard-variation-${i+1}.png`);await fs.writeFile(f,b);console.log(`saved ${(b.length/1024).toFixed(0)} KB`);}}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
