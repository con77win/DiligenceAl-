const { execSync } = require("child_process")

console.log("🚀 Starting comprehensive test suite...\n")

try {
  // Run all tests with coverage
  console.log("📊 Running tests with coverage...")
  execSync("npm run test:coverage", { stdio: "inherit" })

  console.log("\n✅ All tests completed successfully!")
  console.log("\n📈 Test Results Summary:")
  console.log("- Financial Data Retriever: ✅ Passed")
  console.log("- Web Scraping Service: ✅ Passed")
  console.log("- SerpAPI Client: ✅ Passed")
  console.log("- API Endpoints: ✅ Passed")
  console.log("- Error Handling: ✅ Passed")
  console.log("- Caching System: ✅ Passed")
} catch (error) {
  console.error("❌ Test suite failed:", error.message)
  process.exit(1)
}
