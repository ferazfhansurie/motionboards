import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACT = "act_3681677928638351";
const PAGE = "121551227591222";
const IG = "17841448306375961";
const ADSET = "52546379823948";
const V = "v21.0";
async function env() { for (const l of (await fs.readFile(path.join(ROOT,"env.local"),"utf8")).split("\n")) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,""); } }
const tok=()=>process.env.META_APP_TOKEN;
async function api(e,m="GET",b){const o={method:m};if(b instanceof FormData)o.body=b;else if(b){o.headers={"Content-Type":"application/json"};o.body=JSON.stringify(b)}const r=await fetch(`https://graph.facebook.com/${V}/${e}`,o),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(`${m} ${e}: ${JSON.stringify(j.error||j)}`);return j;}
async function main(){
  await env();
  const file=path.join(ROOT,"Hyperwrapz & Detailing","IMG_5206.MOV");
  const f=new FormData();f.append("access_token",tok());f.append("source",new Blob([await fs.readFile(file)],{type:"video/quicktime"}),"IMG_5206.MOV");
  const v=await api(`${PAGE}/videos`,"POST",f); console.log(`video=${v.id}`);
  const c=await api(`${ACT}/adcreatives`,"POST",{name:"Kid Colour Wrap Video | WhatsApp",object_story_spec:{page_id:PAGE,instagram_user_id:IG,video_data:{video_id:v.id,title:"Colour wrap tanpa cat balik",message:"Ni namanya colour change wrap — tukar warna kereta tanpa kena cat balik. Nak tau harga untuk kereta korang? WhatsApp Hyperwrapz & Detailing.",call_to_action:{type:"WHATSAPP_MESSAGE",value:{app_destination:"WHATSAPP"}}}},access_token:tok()});
  const a=await api(`${ACT}/ads`,"POST",{name:"WA | Kid Colour Wrap Video",adset_id:ADSET,creative:{creative_id:c.id},status:"PAUSED",access_token:tok()}); console.log(`creative=${c.id} ad=${a.id}`);
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
