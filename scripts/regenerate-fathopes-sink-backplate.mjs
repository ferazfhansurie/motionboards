import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios", "outputs", "fathopes-heroes-ep1-manifest", "fh-ep1-sinki-backplate.png");
async function loadEnv(){const raw=await fs.readFile(path.join(ROOT,"env.local"),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}
async function main(){
 await loadEnv(); const base=process.env.MB_BASE||"https://motionboards.vercel.app",key=process.env.MB_API_KEY||process.env.MB_KEY;
 const prompt=`Create a clean vertical 9:16 photoreal reference backplate of a real Malaysian home kitchen sink, viewed from OUTSIDE the sink at a high top-down angle, like a person standing above the counter looking down. Match this composition: the stainless-steel sink basin fills the lower two-thirds of frame; the round drain opening sits near the lower center; the faucet and flexible spray hose are visible toward the upper half; wooden or light-colored counter surrounds the basin; a tiled backsplash, window and simple kitchen utensils sit softly in the background. Camera is above and slightly in front of the sink, not inside the drain and not at pipe level. The sink must be empty and clearly visible for later compositing. Real brushed metal, small water droplets and subtle household grime, warm practical kitchen lighting. No people, no hands, no cartoon characters, no monster, no oil, no text, no labels, no logos, no watermark. Preserve clear space above and around the drain for animation. The environment must remain photoreal and physically coherent, suitable for mixed-media 2D cartoon compositing.`;
 const r=await fetch(`${base.replace(/\/$/,"")}/api/generate`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gemini-3.1-flash-image-preview",prompt,inputImages:[],generationOptions:{aspect_ratio:"9:16",resolution:"2K"}})});
 const j=await r.json().catch(()=>({}));if(!r.ok||j.status!=="completed"||!j.outputUrl)throw Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0,500)}`);const img=await fetch(j.outputUrl,{headers:{Authorization:`Bearer ${key}`}});await fs.writeFile(OUT,Buffer.from(await img.arrayBuffer()));console.log(`saved ${OUT}`);
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
