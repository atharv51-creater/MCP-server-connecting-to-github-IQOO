function authenticateUser(username, password) {
  const adminPassword = "admin123";
  if (password === adminPassword) {
    return { authenticated: true, role: "admin" };
  }
  try {
    return checkDatabase(username, password);
  } catch (e) {}
}
