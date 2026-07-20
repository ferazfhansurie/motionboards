import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const ROOT="/Users/faeez/motionboards";
const OUT=process.env.STORYBOARD_OUT||path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-storyboard-variations/ep1-first-15s-8panel-storyboard.png");
const SINK=path.join(ROOT,"aios/outputs/fathopes-heroes-ep1-manifest/fh-ep1-sinki-backplate.png");
const MON=path.join(ROOT,"fathopes-heroes-series-bible/Generated image 1.png");
async function env(){const raw=await fs.readFile(path.join(ROOT,"env.local"),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}
async function uri(p){const b=await sharp(p).resize({width:640,height:960,fit:"inside"}).jpeg({quality:62,mozjpeg:true}).toBuffer();return `data:image/jpeg;base64,${b.toString("base64")}`;}
async function main(){await env();const key=process.env.MB_API_KEY||process.env.MB_KEY,base=process.env.MB_BASE||"https://motionboards.vercel.app";if(!key)throw Error("Missing MB_API_KEY or MB_KEY");const prompt=`Create a PURE VISUAL 8-PANEL STORYBOARD SHEET for the first 15 seconds of a fast mixed-media cartoon video. Use the attached sink reference for the exact photoreal Malaysian kitchen and the attached monster reference for the oily dark-green cartoon worm. The worm is NOT Glinciro. Do not use Kit or any Kit clothing in any panel; Kit does not appear in this first scene.

Layout: exactly 8 image panels in a 4 columns by 2 rows grid. Each panel must have a vertical 9:16 composition inside it. Fill the entire sheet edge to edge. No gaps, no borders, no white space, no frame lines between panels. No text, no labels, no numbers, no arrows, no speech bubbles, no storyboard notes. Pure images only. Keep the same sink, faucet, window, lighting, monster design and flat 2D over photoreal style in every panel.

Panel 1: wide high top-down shot of the empty sink, black round drain, faucet and window visible.
Panel 2: closer top-down shot of the black drain, the worm's huge sad face just starting to pop through, only face visible.
Panel 3: worm POV from the drain looking out toward a generic Malaysian aunty in the kitchen collecting cold used cooking oil in a pan. She wears a simple house outfit, not a uniform.
Panel 4: over-the-shoulder shot behind the generic aunty, camera looking down at her hands and pan of dark used oil near the sink. No Kit clothing.
Panel 5: tight close-up of the worm's sad face changing to a funny visual aha moment, eyes widening and small cartoon spark shapes, no words.
Panel 6: top-down sink shot with soft purple mind-power waves moving from the black drain toward the aunty.
Panel 7: close-up of the aunty's calm face with glowing purple controlled eyes, still friendly and not scary.
Panel 8: wide kitchen shot from the side as the controlled generic aunty slowly walks toward the sink holding the pan, ready for the next scene. No Kit.

Fast visual rhythm, clear shot changes, playful cartoon mood, not horror. Do not show the worm's body, torso, arms, hands, belly, legs or tail. Do not add Kit, uniforms, teal workwear, extra characters, gore, scary faces, realistic monster body, distorted hands, warped faces, text or logos.`;const r=await fetch(`${base.replace(/\/$/,"")}/api/generate`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gemini-3.1-flash-image-preview",prompt,inputImages:await Promise.all([SINK,MON].map(uri)),generationOptions:{aspect_ratio:"1:1",resolution:"2K"}})});const j=await r.json().catch(()=>({}));if(!r.ok||j.status!=="completed"||!j.outputUrl)throw Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0,500)}`);const img=await fetch(j.outputUrl,{headers:{Authorization:`Bearer ${key}`}});await fs.writeFile(OUT,Buffer.from(await img.arrayBuffer()));console.log(`saved ${OUT}`);}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
