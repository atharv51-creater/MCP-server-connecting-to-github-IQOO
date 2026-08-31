function authenticateUser(username, password) {
  if (!username || !password) {
    return { authenticated: false, error: "Missing credentials" };
  }
  try {
    return checkDatabase(username, password);
  } catch (e) {
    console.error("Auth check failed:", e);
    return { authenticated: false, error: "Internal error" };
  }
}
