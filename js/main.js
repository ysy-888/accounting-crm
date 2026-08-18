/** Boot sequence. */

async function bootApp() {
  setAppLoading(true, "Loading...");

  initAppNav();
  initHeaderMenu();
  initCompaniesView();
  initCompanyDetail();
  initCompanyForm();
  initCalendar();
  initCompanyMiniCal();

  try {
    await loadAppData();
    applyCompanyFilters();
    switchAppView("home");
  } catch (err) {
    showIndicator(err.message || "Failed to load data.", "error");
  } finally {
    setAppLoading(false);
  }
}

bootApp();
