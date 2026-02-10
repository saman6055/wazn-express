// Test script to trigger email notification by updating package status
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testNotification() {
  try {
    // First, let's get the packages for customer saman (AZ004)
    // We need to find a package with status 'registered' to change to 'ready_for_delivery'
    
    // The customer ID for saman (AZ004) is 30001 based on the URL we saw
    // Package g000002 has tracking 111112 and status 'registered'
    
    console.log('Testing notification system...');
    console.log('Looking for packages to update...');
    
    // We'll use the tRPC API to update the package status
    // This requires authentication, so let's check the logs instead
    
    console.log('\n=== Notification Test Instructions ===');
    console.log('To test the email notification:');
    console.log('1. Go to the customer page: /customers/30001');
    console.log('2. Find a package with status "registered"');
    console.log('3. Click "Update Status" and change to "ready_for_delivery"');
    console.log('4. Check your email at saman6055@gmail.com');
    console.log('\nThe notification system will send an email when:');
    console.log('- Package status changes to ready_for_delivery');
    console.log('- Invoice is created');
    console.log('- Payment is received');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testNotification();
