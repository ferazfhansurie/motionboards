#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";
const adSetId = "120251221850460414";

async function updateHighTicketSellerTargeting() {
  console.log("🎯 Targeting People Selling 1k-5k Services/Products\n");
  
  const newTargeting = {
    age_max: 65,
    age_min: 25,
    geo_locations: {
      countries: ["MY"],
      location_types: ["home", "recent"]
    },
    interests: [
      { id: "6003051822645", name: "Coaching (education)" },
      { id: "6003748928462", name: "Personal development" },
      { id: "6003184559502", name: "Professional services" },
      { id: "6003274244908", name: "Management consulting" },
      { id: "6003142970561", name: "Information technology consulting" },
      { id: "6002969639194", name: "Vocational education" },
      { id: "6003285403725", name: "Educational technology" },
      { id: "6003371567474", name: "Entrepreneurship" },
    ],
    targeting_automation: {
      advantage_audience: 1
    }
  };
  
  console.log("📌 Targeting (1k-5k Service Sellers):");
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
    
    console.log("✅ Targeting updated for 1k-5k service/product sellers!\n");
    
    // Verify
    const verifyRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?fields=targeting&access_token=${token}`
    );
    const verifyData = await verifyRes.json();
    console.log("✅ Current Targeting Applied:\n");
    console.log("🎯 Niche Focus: Coaches, consultants, course creators, service providers");
    console.log("💰 Their Service Price: 1k-5k range");
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

updateHighTicketSellerTargeting().catch(console.error);
