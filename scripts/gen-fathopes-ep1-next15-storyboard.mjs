import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const ROOT="/Users/faeez/motionboards";
const OUT=path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-next-storyboard/ep1-next15-8panel-storyboard-final.png");
const REFS=[
 path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-next-storyboard/ep1-next15-8panel-storyboard.png"),
 path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-next-storyboard-frames/frame-15.jpg"),
 path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-manifest/fh-ep1-sinki-backplate.png"),
 path.join(ROOT,"fathopes-heroes-series-bible/Generated image 1.png"),
 path.join(ROOT,"fathopes-heroes-series-bible/Kit-action 2.png")
];
async function env(){const raw=await fs.readFile(path.join(ROOT,"env.local"),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}
async function uri(p){const b=await sharp(p).resize({width:640,height:960,fit:"inside"}).jpeg({quality:62,mozjpeg:true}).toBuffer();return `data:image/jpeg;base64,${b.toString("base64")}`;}
const prompt=`Create a PURE VISUAL 8-PANEL STORYBOARD SHEET for the next 15-second vertical mixed-media cartoon clip, continuing directly from the attached chosen storyboard and generated video frame. Use Image1 as the exact previous storyboard style and character continuity. Use Image2 as the actual last-frame kitchen and aunty continuity. Use Image3 for the exact sink environment. Use Image4 for the oily dark-green monster identity. Use Image5 for the exact chubby Kit identity, black hat, teal workwear, black gloves and reflective bands.

Make exactly 8 vertical 9:16 panels in a 4 by 2 grid, touching edge to edge. No gaps, borders, white space, frame lines, text, labels, numbers, arrows, speech bubbles or logos. Pure images only. Preserve the same photoreal Malaysian kitchen with flat 2D cartoon characters over it.

Panel 1: wide exterior high top-down shot, aunty tilts the pan and a steady stream of cold dark used oil pours into the round sink drain.
Panel 2: tight drain close-up, only the monster face visible in the hole, mouth open under the falling oil, happily drinking; no body.
Panel 3: true low drain POV from inside the pipe, looking upward through the round drain opening at the aunty and pan. Show the circular drain opening and the aunty above it. The monster is behind the camera, completely hidden inside the pipe: no monster face, head, back, body silhouette or character shape anywhere in the sink basin. Oil stream still pours continuously.
Panel 4: overhead insert of oil landing in the drain while the monster looks blissful and greedy, only face visible.
Panel 5: medium side-wide kitchen shot, aunty keeps pouring, monster's purple mind power still faintly controls her; the pour does not stop.
Panel 6: close-up of the monster's silly happy face drinking, playful not scary, while a girl's intervention is implied by a bright comic energy cue, no words.
Panel 7: dynamic wide shot as Kit enters and reaches down toward the drain, one black-gloved hand grabbing the helpless monster by the neck. Copy Kit's exact face from Image5: same eyes, nose, mouth, jaw, hair, hat and broad chubby proportions. Do not invent a new face.
Panel 8: tight action close-up of Kit's black-gloved hand clearly gripping the monster by the neck and lifting its face just above the drain opening; Kit's face is partly visible and must match Image5 exactly. The monster looks helpless and surprised, the purple mind-power waves have stopped and the oil stream has stopped. No sound-effect graphics.

 No Glinciro, no extra characters, no full monster body before Kit grabs him, no monster arms, hands, belly, legs or tail before the grab, no horror, gore or scary face. Do not show any monster part in Panel 3. Keep aunty and Kit visually distinct. Do not turn the monster into a human. Copy Kit's face exactly from Image5; no redesign, no alternate face, no different hat. Keep the sink geometry, monster identity, Kit proportions, wardrobe and lighting consistent. ABSOLUTELY NO TEXT OR GRAPHICS OF ANY KIND, including words, sound effects, comic lettering, symbols, captions or logos.`;
async function main(){await env();const key=process.env.MB_API_KEY||process.env.MB_KEY,base=process.env.MB_BASE||"https://motionboards.vercel.app";if(!key)throw Error("Missing MB_API_KEY or MB_KEY");const inputImages=await Promise.all(REFS.map(uri));const r=await fetch(`${base.replace(/\/$/,"")}/api/generate`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gemini-3.1-flash-image-preview",prompt,inputImages,generationOptions:{aspect_ratio:"1:1",resolution:"2K"}})});const j=await r.json().catch(()=>({}));if(!r.ok||j.status!=="completed"||!j.outputUrl)throw Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0,500)}`);const img=await fetch(j.outputUrl,{headers:{Authorization:`Bearer ${key}`}});await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,Buffer.from(await img.arrayBuffer()));console.log(`saved ${OUT}`);}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
