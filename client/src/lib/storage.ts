// Frontend storage helper for file uploads

const FORGE_API_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL;
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;

export async function storagePut(
  key: string,
  data: Uint8Array | string,
  contentType?: string
): Promise<{ key: string; url: string }> {
  // Convert data to base64 if it's a Uint8Array
  let base64Data: string;
  if (typeof data === 'string') {
    base64Data = btoa(data);
  } else {
    // Convert Uint8Array to base64
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    base64Data = btoa(binary);
  }

  const response = await fetch(`${FORGE_API_URL}/storage/put`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      key,
      data: base64Data,
      contentType: contentType || 'application/octet-stream',
    }),
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed: ${response.statusText}`);
  }

  return response.json();
}

export async function storageGet(
  key: string,
  expiresIn?: number
): Promise<{ key: string; url: string }> {
  const params = new URLSearchParams({ key });
  if (expiresIn) {
    params.append('expiresIn', expiresIn.toString());
  }

  const response = await fetch(`${FORGE_API_URL}/storage/get?${params}`, {
    headers: {
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Storage get failed: ${response.statusText}`);
  }

  return response.json();
}
