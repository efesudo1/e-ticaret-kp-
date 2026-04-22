const db = require('c:/Users/ahmet/Desktop/E-TİCARET KPI DASHBOARD/backend/src/config/database');
async function check() {
  try {
    const [metaCampaigns] = await db.query(`
      SELECT campaign_name, 'Meta' as platform, 
             SUM(impressions) as impressions, 
             SUM(clicks) as clicks, 
             SUM(spend) as spend, 
             SUM(actions_purchase) as conversions, 
             SUM(action_values_purchase) as conversionValue 
      FROM meta_ads 
      GROUP BY campaign_name 
      ORDER BY spend DESC 
      LIMIT 2`);
    console.log("META", metaCampaigns);
    process.exit(0);
  } catch(e) {
    console.error("ERROR", e);
    process.exit(1);
  }
}
check();
