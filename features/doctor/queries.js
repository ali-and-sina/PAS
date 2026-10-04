import "server-only";

/** CONTRACT SEAM — نیازمند Contract: getDoctorDashboard (verified + active relationship). */
export async function getDoctorDashboard() {
  return {
    activePatients: 0,
    pendingResults: 0, // گزارش‌های final بدون تفسیر
    pendingVisitRequests: 0,
    recentLabOrders: [], // { id, patientName, status, createdAt }
  };
}
