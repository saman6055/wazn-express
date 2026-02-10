// Test script to directly trigger email notification
// Run with: npx tsx test-email-notification.ts

import { notifyPackageStatusChange } from "./server/notifications";

async function testEmailNotification() {
  console.log("Testing email notification for package g000002 (ID: 2)...");
  
  try {
    // Package ID 2 is g000002 belonging to customer saman (saman6055@gmail.com)
    await notifyPackageStatusChange(2, "ready_for_delivery");
    console.log("Notification sent successfully!");
  } catch (error) {
    console.error("Error sending notification:", error);
  }
  
  process.exit(0);
}

testEmailNotification();
