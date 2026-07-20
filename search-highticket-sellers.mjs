#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";

async function searchHighTicketServiceProviders() {
  console.log("🔍 Searching for 1k-5k service/product sellers...\n");
  
  const queries = [
    "Online courses",
    "Course creators",
    "Coaching programs",
    "Coaching",
    "Online coaching",
    "Personal development",
    "Business coaching",
    "Digital products",
    "Information products",
    "Online education",
    "Membership sites",
    "Premium services",
    "Consulting services",
    "Expert advice",
  ];
  
  for (const query of queries) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${apiVersion}/search?type=adinterest&q=${encodeURIComponent(query)}&access_token=${token}`
      );
      const data = await res.json();
      
      if (data.data && data.data.length > 0) {
        console.log(`📌 "${query}":`);
        data.data.slice(0, 2).forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.name} (ID: ${item.id})`);
        });
        console.log("");
      }
    } catch (err) {
      console.error(`Error searching "${query}":`, err.message);
    }
  }
}

searchHighTicketServiceProviders().catch(console.error);
