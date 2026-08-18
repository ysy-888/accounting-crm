/** Boot sequence. */

async function bootApp() {
  setAppLoading(true, "Loading...");

  initAppNav();
  initHeaderMenu();
  initCompaniesView();
  initCompanyDetail();

  try {
    await loadAppData();
    applyCompanyFilters();
    switchAppView("companies");
  } catch (err) {
    showIndicator(err.message || "Failed to load data.", "error");
  } finally {
    setAppLoading(false);
  }
}

bootApp();
