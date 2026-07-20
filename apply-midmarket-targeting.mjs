#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";
const adSetId = "120251221850460414";

async function updateMidMarketTargeting() {
  console.log("🎯 Targeting 1k-5k Mid-Market Business Owners\n");
  
  const newTargeting = {
    age_max: 65,
    age_min: 25,
    geo_locations: {
      countries: ["MY"],
      location_types: ["home", "recent"]
    },
    interests: [
      { id: "6003371567474", name: "Entrepreneurship (business and finance)" },
      { id: "6003102820440", name: "Creative entrepreneurship" },
      { id: "6003221485467", name: "E-commerce (retail)" },
      { id: "6003025413050", name: "E-commerce payment system" },
      { id: "6003274244908", name: "Management consulting" },
      { id: "6003526234370", name: "Online advertising" },
      { id: "6003120739217", name: "Business networking" },
    ],
    targeting_automation: {
      advantage_audience: 1
    }
  };
  
  console.log("📌 Mid-Market (1k-5k) Targeting:");
  console.log(JSON.stringify(newTargeting.interests, null, 2));
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
    
    console.log("✅ Targeting updated for 1k-5k tier!\n");
    
    // Verify
    const verifyRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?fields=targeting&access_token=${token}`
    );
    const verifyData = await verifyRes.json();
    console.log("✅ Current Targeting Applied:\n");
    console.log("🎯 Niche Focus: E-commerce, freelancers, small agencies, consultants");
    console.log("💰 Budget Tier: 1k-5k budget decision-makers");
    console.log("📍 Location: Malaysia only");
    console.log("👥 Age: 25–65\n");
    console.log("Interests reaching:");
    verifyData.targeting.interests.forEach((int, i) => {
      console.log(`   ${i + 1}. ${int.name}`);
    });
    
    return true;
  } catch (err) {
    console.error("❌ Error:", err.message);
    return false;
  }
}

updateMidMarketTargeting().catch(console.error);
