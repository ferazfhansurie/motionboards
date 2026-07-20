#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";
const adSetId = "120251221850460414";

async function updateHighTicketLeadGenTargeting() {
  console.log("🎯 Targeting High-Ticket Business Owners & Professionals\n");
  
  const newTargeting = {
    age_max: 65,
    age_min: 25,
    geo_locations: {
      countries: ["MY"],
      location_types: ["home", "recent"]
    },
    interests: [
      { id: "6003199479265", name: "Life Coach" },
      { id: "6003578086487", name: "Property (industry)" },
      { id: "6849417269780", name: "Residential property" },
      { id: "6003484864669", name: "Wealth management" },
      { id: "6003371567474", name: "Entrepreneurship" },
      { id: "6003184559502", name: "Professional services" },
      { id: "6003120739217", name: "Business networking" },
    ],
    targeting_automation: {
      advantage_audience: 1
    }
  };
  
  console.log("📌 High-Ticket Lead Gen Targeting:");
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
    
    console.log("✅ Targeting applied successfully!\n");
    
    // Verify
    const verifyRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?fields=targeting&access_token=${token}`
    );
    const verifyData = await verifyRes.json();
    console.log("✅ Current Targeting Applied:\n");
    console.log("🎯 Niche Focus: High-ticket coaches, real estate, wealth managers, professionals");
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

updateHighTicketLeadGenTargeting().catch(console.error);
