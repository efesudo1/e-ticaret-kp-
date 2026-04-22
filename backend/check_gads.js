const db = require('c:/Users/ahmet/Desktop/E-TİCARET KPI DASHBOARD/backend/src/config/database');
async function check() {
  try {
    const [googleCampaigns] = await db.query(`
      SELECT campaign_name, 'Google' as platform, 
             SUM(impressions) as impressions, 
             SUM(clicks) as clicks, 
             SUM(cost_micros)/1000000 as spend, 
             SUM(conversions) as conversions, 
             SUM(conversions_value) as conversionValue 
      FROM google_ads 
      GROUP BY campaign_name 
      ORDER BY spend DESC 
      LIMIT 2`);
    console.log("GOOGLE", googleCampaigns);
    process.exit(0);
  } catch(e) {
    console.error("ERROR", e);
    process.exit(1);
  }
}
check();
