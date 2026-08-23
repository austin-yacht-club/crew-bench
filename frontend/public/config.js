# Runtime config for Crew Bench frontend.
# In Docker this file is rewritten on container start from API_BASE_PATH.
# For local `npm start`, leave apiBasePath null to use CRA / REACT_APP_API_URL defaults.
window.__CREW_BENCH_CONFIG__ = window.__CREW_BENCH_CONFIG__ || { apiBasePath: null };
