async function main() {
  try {
    const res = await fetch("http://localhost:3000/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Local",
        companySlug: "local-co",
        region: "Europe",
        industry: "Industry",
        seats: 50,
        adminName: "Ada",
        adminEmail: "ada_local@example.com",
        adminPassword: "password123",
        adminNotes: "none",
      }),
    });

    const text = await res.text();
    console.log(res.status);
    console.log(text);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
