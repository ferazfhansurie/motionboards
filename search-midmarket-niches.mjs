#!/usr/bin/env node

const token = "EAAK1X7xLCTEBR0lDNlIoVi8q1rEUE8eZAkOQd83xQImGmgc6BkVcdyJ8PytNOy0M4WFqIOUJOgSbn2eqL9gtLFR9eYpzl3Lk2Adm9QI8Mhj2wizGBKoQLxMtZBoGIe2WunLlbQ48iOrG6tlCmdblOICZALPgy033JiBhGDkZBNlDJbLBByMINyArqhpAR56Q3TMjY12TYW5rlwgbN5aPlGVKmJVcVHaYBJWO0eaZBzjEbANm0ZAAZDZD";
const apiVersion = "v23.0";

async function searchMidMarketNiches() {
  console.log("🔍 Searching for 1k-5k mid-market business interests...\n");
  
  const queries = [
    "Small business owners",
    "Entrepreneurs",
    "Freelancers",
    "Service-based business",
    "E-commerce",
    "Digital products",
    "Online business",
    "Solopreneurs",
    "Content creators",
    "Consultants",
    "Agency owners",
    "Online marketing",
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

searchMidMarketNiches().catch(console.error);
