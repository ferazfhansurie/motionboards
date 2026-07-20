import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios", "outputs", "fathopes-heroes-ep1-startframes");
const MANIFEST = path.join(ROOT, "aios", "outputs", "fathopes-heroes-ep1-manifest");
const MONSTER = path.join(ROOT, "fathopes-heroes-series-bible", "Generated image 1.png");
const KIT = path.join(ROOT, "public", "Fathopes_heroes_animated", "kit-3.png");
const SINK = path.join(MANIFEST, "fh-ep1-sinki-backplate.png");
const OILKIT = path.join(MANIFEST, "fh-ep1-oil-collection-kit.png");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,""); }
}
async function uri(file) { const b=await sharp(file).resize({width:640,height:960,fit:"inside"}).jpeg({quality:62,mozjpeg:true}).toBuffer(); return `data:image/jpeg;base64,${b.toString("base64")}`; }
async function gen(base,key,prompt,files) {
  const r=await fetch(`${base.replace(/\/$/,"")}/api/generate`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gemini-3.1-flash-image-preview",prompt,inputImages:await Promise.all(files.map(uri)),generationOptions:{aspect_ratio:"9:16",resolution:"2K"}})});
  const j=await r.json().catch(()=>({})); if(!r.ok||j.status!=="completed"||!j.outputUrl) throw Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0,400)}`);
  const img=await fetch(j.outputUrl,{headers:{Authorization:`Bearer ${key}`}}); return Buffer.from(await img.arrayBuffer());
}
const STYLE=`Mixed-media animation reference frame: bold 2D hand-drawn cel-shaded cartoon characters with thick confident outlines composited into a richly detailed photoreal Malaysian environment. Characters stay flat 2D; environment stays real and textured. Playful creepy comedy, not gore. No text, logos or watermark.`;
const jobs=[
 {file:"03-glinciro-feeding.png",files:[SINK,MONSTER],prompt:`${STYLE} Use Image 1 as the exact sink-drain POV and Image 2 as the exact Glinciro identity. Make Glinciro an enormous creature whose full body is hidden deep behind the small circular drain opening. The drain opening is too small for his body to come through. Show ONLY his oversized face poking into the opening: both eyes, nose, huge oily grin and a little bit of cheek at the rim. Absolutely no torso, shoulders, arms, hands, belly, legs, tail, barrel or full body visible. His face fills most of the opening and looks upward toward camera, hungry and delighted as a few drops of cold dark used oil fall. Preserve the real sink geometry and wet metal. No other characters, no body parts outside the face.`},
 {file:"05-proper-collection.png",files:[KIT,OILKIT],prompt:`${STYLE} Use Image 1 as Kit's exact character identity and body shape. Kit is intentionally chubby and broad-bodied with a round belly, thick torso, broad hips and soft heavy cheeks; keep this chubby build clearly visible. Preserve his black bucket hat, dark teal coveralls, silver reflective bands, black gloves and thick black boots. Use Image 2 for the bottle and lidded collection tong. Stage chubby Kit at a bright kitchen counter, carefully pouring cold dark used cooking oil from a pan into the transparent bottle, with the lidded tong beside it. Three-quarter full-body view. Do not slim Kit, do not make him athletic, do not change his face or outfit. Keep the bottle and tong realistic and fully visible. No text or labels.`},
];
async function main(){await loadEnv();const base=process.env.MB_BASE||"https://motionboards.vercel.app",key=process.env.MB_API_KEY||process.env.MB_KEY;if(!key)throw Error("Missing MB_API_KEY or MB_KEY");await fs.mkdir(OUT,{recursive:true});for(const j of jobs){process.stdout.write(`[${j.file}] generating... `);const b=await gen(base,key,j.prompt,j.files);await fs.writeFile(path.join(OUT,j.file),b);console.log(`saved ${(b.length/1024).toFixed(0)} KB`);}}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
