// Test script to update package status and trigger email notification

const BASE_URL = 'http://localhost:3000';

async function updatePackageStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/packages.updateStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          id: 2, // Package g000002
          status: 'ready_for_delivery'
        }
      })
    });
    
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updatePackageStatus();
