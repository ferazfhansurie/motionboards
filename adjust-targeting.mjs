#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";

// Ad set details from the screenshot
const accountId = "417766879541571";
const adSetId = "120251221850460414";

async function fetchAdSetTargeting() {
  console.log("📊 Fetching current ad set targeting...\n");
  
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${adSetId}?fields=targeting&access_token=${token}`
    );
    const data = await res.json();
    
    if (!res.ok) {
      console.error("❌ Error:", data.error?.message || JSON.stringify(data));
      return null;
    }
    
    console.log("✅ Current Targeting:");
    console.log(JSON.stringify(data.targeting, null, 2));
    return data.targeting;
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
    return null;
  }
}

async function searchInterests(query) {
  console.log(`\n🔍 Searching for interests: "${query}"\n`);
  
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/search?type=adinterest&q=${encodeURIComponent(query)}&access_token=${token}`
    );
    const data = await res.json();
    
    if (!res.ok) {
      console.error("❌ Error:", data.error?.message || JSON.stringify(data));
      return [];
    }
    
    if (data.data && data.data.length > 0) {
      console.log(`Found ${data.data.length} results:\n`);
      data.data.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name} (ID: ${item.id}, audience: ${item.audience_size})`);
      });
      return data.data;
    } else {
      console.log("No results found.");
      return [];
    }
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
    return [];
  }
}

async function searchJobs(query) {
  console.log(`\n💼 Searching for job titles: "${query}"\n`);
  
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/search?type=adjob&q=${encodeURIComponent(query)}&access_token=${token}`
    );
    const data = await res.json();
    
    if (!res.ok) {
      console.error("❌ Error:", data.error?.message || JSON.stringify(data));
      return [];
    }
    
    if (data.data && data.data.length > 0) {
      console.log(`Found ${data.data.length} results:\n`);
      data.data.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name} (ID: ${item.id})`);
      });
      return data.data;
    } else {
      console.log("No results found.");
      return [];
    }
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
    return [];
  }
}

async function updateAdSetTargeting(newTargeting) {
  console.log("\n📝 Updating ad set targeting...\n");
  
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
    console.log("Updated data:", JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("❌ Update error:", err.message);
    return false;
  }
}

async function main() {
  console.log("🚀 Meta Ads Targeting Adjuster\n");
  console.log(`Account: ${accountId}`);
  console.log(`Ad Set: ${adSetId}\n`);
  
  // Step 1: Fetch current targeting
  const currentTargeting = await fetchAdSetTargeting();
  
  if (!currentTargeting) {
    console.log("\n⚠️  Could not fetch current targeting. Exiting.");
    return;
  }
  
  // Step 2: Search for interests and jobs to suggest
  console.log("\n\n📋 Suggested additions:\n");
  
  const interestSearches = ["Entrepreneurship", "Self-employed", "Small business", "Delivery driver", "Truck driver"];
  const jobSearches = ["Delivery driver", "Truck driver", "Taxi driver", "Courier"];
  
  for (const query of interestSearches) {
    await searchInterests(query);
  }
  
  for (const query of jobSearches) {
    await searchJobs(query);
  }
  
  console.log("\n\n💡 Next step: Manually select IDs from above and run updateTargeting() to apply them.");
  console.log("Example targeting structure:");
  console.log(JSON.stringify({
    geo_locations: { regions: [{ key: "2345" }] },
    age_min: 25,
    age_max: 65,
    interests: [{ id: "6003107", name: "Small business" }],
    work: [{ id: "123456", name: "Delivery driver" }],
  }, null, 2));
}

main().catch(console.error);
