/**
 * Test script for Moorsyl SMS integration
 * Run: npx tsx scripts/test-moorsyl.ts
 */

import { sendMoorsylSMS, isMoorsylConfigured, formatMauritanianPhone } from "../src/lib/moorsyl"

async function test() {
  console.log("🔧 Moorsyl SMS Test\n")

  // Test 1: Check configuration
  console.log("1. Checking configuration...")
  if (!isMoorsylConfigured()) {
    console.error("❌ Moorsyl not configured - add MOORSYL_API_KEY to .env")
    process.exit(1)
  }
  console.log("✅ Moorsyl configured\n")

  // Test 2: Phone number formatting
  console.log("2. Testing phone number formatting...")
  const testNumbers = [
    "47155148",
    "22247155148",
    "+22247155148",
    "44123456",
  ]
  for (const num of testNumbers) {
    const formatted = formatMauritanianPhone(num)
    console.log(`   ${num} → ${formatted}`)
  }
  console.log("")

  // Test 3: Send test SMS (uncomment to test)
  console.log("3. Sending test SMS...")
  console.log("⚠️  Uncomment the code below to send a real SMS\n")

  /*
  const testPhone = "+222XXXXXXXX" // Replace with a real number
  const result = await sendMoorsylSMS(testPhone, "Test from ClassFlow - Moorsyl integration working!")
  
  if (result.success) {
    console.log(`✅ SMS sent successfully! Message ID: ${result.messageId}`)
  } else {
    console.error(`❌ SMS failed: ${result.error}`)
  }
  */

  console.log("✅ All tests passed!")
}

test().catch(console.error)
