/**
 * Test the deployed employee login + /me flow end-to-end
 */
async function main() {
  const baseUrl = "https://syspro-pi.vercel.app";
  
  // Step 1: Login
  console.log("=== Step 1: Login ===");
  const loginResp = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": baseUrl },
    body: JSON.stringify({ email: "onyedika.akoma@gmail.com", password: "dikaoliver2660" }),
  });
  
  console.log("Login status:", loginResp.status);
  const setCookie = loginResp.headers.get("set-cookie");
  console.log("Set-Cookie header present:", !!setCookie);
  if (setCookie) {
    console.log("Set-Cookie (first 100 chars):", setCookie.substring(0, 100));
  }
  
  const loginData = await loginResp.json();
  console.log("Login response:", JSON.stringify(loginData).substring(0, 200));
  
  if (!loginData.success) {
    console.log("FAIL: Login failed");
    process.exit(1);
  }
  
  // Extract the employee_session cookie value from Set-Cookie header
  let sessionCookie = "";
  if (setCookie) {
    const match = setCookie.match(/employee_session=([^;]+)/);
    if (match) sessionCookie = match[1];
  }
  
  // Also use the token from the response body as fallback
  const token = loginData.token || sessionCookie;
  console.log("Token from body:", loginData.token ? loginData.token.substring(0, 50) + "..." : "NOT PRESENT");
  console.log("Token from cookie:", sessionCookie ? sessionCookie.substring(0, 50) + "..." : "NOT PRESENT");
  
  if (!token) {
    console.log("FAIL: No token obtained");
    process.exit(1);
  }
  
  // Step 2: Call /me with the cookie
  console.log("\n=== Step 2: Call /api/hr/employees/me ===");
  const meResp = await fetch(`${baseUrl}/api/hr/employees/me`, {
    method: "GET",
    headers: {
      "Cookie": `employee_session=${token}`,
    },
  });
  
  console.log("/me status:", meResp.status);
  const meData = await meResp.json();
  console.log("/me response:", JSON.stringify(meData).substring(0, 300));
  
  if (meResp.status === 200) {
    console.log("\n=== SUCCESS: Employee can login and access /me ===");
  } else {
    console.log("\n=== FAIL: /me returned", meResp.status, "===");
    console.log("This means the token verification failed on the server.");
    console.log("Possible cause: SESSION_SECRET mismatch between login and /me endpoints");
  }
  
  process.exit(0);
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
