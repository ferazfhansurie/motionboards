#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";
const adSetId = "120251221850460414";

async function searchMarketingInterests() {
  console.log("🔍 Searching for digital marketing interests...\n");
  
  const queries = ["Digital marketing", "Marketing", "Social media marketing", "Business owners", "Marketing professionals"];
  
  for (const query of queries) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${apiVersion}/search?type=adinterest&q=${encodeURIComponent(query)}&access_token=${token}`
      );
      const data = await res.json();
      
      if (data.data && data.data.length > 0) {
        console.log(`📌 "${query}":`);
        data.data.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.name} (ID: ${item.id})`);
        });
        console.log("");
      }
    } catch (err) {
      console.error(`Error searching "${query}":`, err.message);
    }
  }
}

async function updateToMarketingTargeting() {
  console.log("📝 Updating targeting for digital marketing services...\n");
  
  const newTargeting = {
    age_max: 65,
    age_min: 25,
    geo_locations: {
      countries: ["MY"],
      location_types: ["home", "recent"]
    },
    interests: [
      { id: "6003127206524", name: "Digital marketing" },
      { id: "6853952393067", name: "Marketing services and organisations" },
      { id: "6003389760112", name: "Social media marketing" },
      { id: "6003279598823", name: "Marketing (business and finance)" },
      { id: "6003120739217", name: "Business networking" },
      { id: "6002884511422", name: "Small business (business and finance)" },
    ],
    targeting_automation: {
      advantage_audience: 1
    }
  };
  
  console.log("📌 Digital Marketing Targeting:");
  console.log(JSON.stringify(newTargeting, null, 2));
  console.log("\n");
  
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targeting: newTargeting }),
      }
    );
    const data = await res.json();
    
    if (!res.ok) {
      console.error("❌ Error:", data.error?.message || JSON.stringify(data));
      return false;
    }
    
    console.log("✅ Targeting updated for digital marketing services!\n");
    
    // Verify
    const verifyRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?fields=targeting&access_token=${token}`
    );
    const verifyData = await verifyRes.json();
    console.log("✅ Current Interests Applied:");
    verifyData.targeting.interests.forEach((int, i) => {
      console.log(`   ${i + 1}. ${int.name}`);
    });
    
    return true;
  } catch (err) {
    console.error("❌ Error:", err.message);
    return false;
  }
}

async function main() {
  console.log("🎯 Digital Marketing Services Targeting\n");
  await updateToMarketingTargeting();
}

main().catch(console.error);
