const KpiService = require('c:/Users/ahmet/Desktop/E-TİCARET KPI DASHBOARD/backend/src/services/kpiService.js');
async function run() {
  try {
    const service = new KpiService();
    const data = await service.getCampaignPerformance();
    console.log("Success. Total campaigns:", data.campaigns.length);
    process.exit(0);
  } catch(e) {
    console.error("ERROR:", e);
    process.exit(1);
  }
}
run();
