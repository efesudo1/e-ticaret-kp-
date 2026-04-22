const KpiService = require('c:/Users/ahmet/Desktop/E-TİCARET KPI DASHBOARD/backend/src/services/kpiService.js');
async function run() {
  const service = new KpiService();
  try {
    await service.getMarketingKpis();
    console.log("Marketing OK");
  } catch(e) {
    console.log("MARKETING FAILED:", e.sqlMessage);
  }
  try {
    await service.getCohortAnalysis();
    console.log("Cohort OK");
  } catch(e) {
    console.log("COHORT FAILED:", e.sqlMessage);
  }
  process.exit();
}
run();
