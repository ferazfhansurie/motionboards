import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "FatHopes IMG", "push-carousel-identify-collector-mural-v3");
const actual = (...p) => path.join(ROOT, ...p);
const files = {
  logo: actual("FatHopes IMG", "poster-refs", "LOGO-mark.png"),
  front: actual("FatHopes IMG", "drive-download-20260627T093124Z-3-001", "PUX09986.JPG"),
  qr: actual("FatHopes IMG", "poster-refs", "qr code.jpeg"),
  home: actual("FatHopes IMG", "poster-refs", "home.jpeg"),
};
const system = `Create ONE vertical 4:5 social carousel panel in the existing FatHopes Energy PUSH collector-verification mural. Keep its premium continuous night-time industrial depot world: forest-green steel, yellow-lime safety rails, teal haze, practical overhead lights, physical fluorescent-lime route cable. This is not a board, a collage or a fresh unrelated poster. No labels for route percentages, no numbers floating beside the route, no duplicate headings, no invented text, no watermarks.`;
const tasks = [
  { out: "05-mini-tanker.png", inputs: [path.join(DIR, "04-vendor-app.png"), actual("FatHopes IMG", "push-people", "PUX02644.JPG"), files.logo, path.join(DIR, "06-verified.png")], prompt: `Image 1 is the preceding Vendor App mural panel: continue its RIGHTMOST lime route exactly as it leaves low on the edge. Image 2 is the real FatHopes mini tanker and must be preserved faithfully. Image 3 is official logo. Image 4 is the following verification panel: match its LEFTMOST lime route exactly as it enters. Rebuild only the mini-tanker panel as the physical bridge between the two neighbours. The route must enter LOW on the left, run under the genuine tanker wheels, and exit LOW on the right at the exact height seen in Image 4. It must be visibly one uninterrupted cable across both seams, with no jump, no second loop and no unrelated arrow. Keep the same depot perspective, horizon and lighting. TEXT EXACTLY ONCE: STEP 3 / MINI TANKER / NOT A NORMAL VAN OR CAR.` },
];
async function env(){const raw=await fs.readFile(path.join(ROOT,"env.local"),"utf8");for(const line of raw.split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}}
async function inline(file){const data=await sharp(file).rotate().resize({width:1200,height:1500,fit:"inside",withoutEnlargement:true}).jpeg({quality:88}).toBuffer();return {inlineData:{mimeType:"image/jpeg",data:data.toString("base64")}};}
async function main(){await env();const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});for(const task of tasks){console.log(`Fixing ${task.out}`);const response=await ai.models.generateContent({model:"gemini-3.1-flash-image-preview",contents:[{text:`${system}\n\n${task.prompt}`},...await Promise.all(task.inputs.map(inline))],config:{responseModalities:["IMAGE"],imageConfig:{aspectRatio:"4:5",imageSize:"2K"}}});const data=response.candidates?.[0]?.content?.parts?.find(p=>p.inlineData)?.inlineData?.data;if(!data)throw Error(`No image for ${task.out}`);await fs.writeFile(path.join(DIR,task.out),Buffer.from(data,"base64"));}
const names=["01-identify","02-uniform-front","03-uniform-back","04-vendor-app","05-mini-tanker","06-verified","07-case-closed"];const frames=await Promise.all(names.map(async name=>({input:await sharp(path.join(DIR,`${name}.png`)).resize({width:432}).png().toBuffer()})));const h=(await sharp(frames[0].input).metadata()).height;await sharp({create:{width:3024,height:h,channels:4,background:"#061c15"}}).composite(frames.map((frame,i)=>({...frame,left:i*432,top:0}))).png().toFile(path.join(DIR,"_mural-review-fixed.png"));}
main().catch(e=>{console.error(`FATAL: ${e.message}`);process.exitCode=1;});
