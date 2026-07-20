#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";

// Ad set details
const accountId = "417766879541571";
const adSetId = "120251221850460414";

async function updateAdSetTargeting() {
  console.log("📝 Applying targeting update...\n");
  
  // Enhanced targeting with interests
  const newTargeting = {
    age_max: 65,
    age_min: 25,
    geo_locations: {
      countries: ["MY"],
      location_types: ["home", "recent"]
    },
    // Add these interests for better targeting
    interests: [
      { id: "6003371567474", name: "Entrepreneurship (business and finance)" },
      { id: "6003214937861", name: "Self-employment (careers)" },
      { id: "6002884511422", name: "Small business (business and finance)" },
      { id: "6003032315492", name: "Entrepreneurs' Organization" },
      { id: "6003278282454", name: "Self-Employed and loving it" },
    ],
    // Keep advantage audience
    targeting_automation: {
      advantage_audience: 1
    }
  };
  
  console.log("📌 New Targeting Structure:");
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
    
    console.log("✅ Ad set targeting updated successfully!");
    console.log("\n📊 Response:", JSON.stringify(data, null, 2));
    
    // Verify the update
    console.log("\n\n🔍 Verifying update...\n");
    const verifyRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?fields=targeting&access_token=${token}`
    );
    const verifyData = await verifyRes.json();
    console.log("Current Targeting After Update:");
    console.log(JSON.stringify(verifyData.targeting, null, 2));
    
    return true;
  } catch (err) {
    console.error("❌ Update error:", err.message);
    return false;
  }
}

updateAdSetTargeting().catch(console.error);
