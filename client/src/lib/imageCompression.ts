/**
 * Image compression utility for reducing file sizes before upload
 * Compresses images to reduce bandwidth and improve loading performance
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const defaultOptions: CompressionOptions = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8,
  maxSizeMB: 1,
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<File> - The compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...defaultOptions, ...options };
  
  // Skip compression for non-image files or small files
  if (!file.type.startsWith('image/')) {
    return file;
  }
  
  // Skip if file is already small enough (less than 100KB)
  if (file.size < 100 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const maxWidth = opts.maxWidth || 1200;
        const maxHeight = opts.maxHeight || 1200;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw image with white background (for transparency)
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Convert to blob with quality setting
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = file.type === 'image/png' ? 1 : (opts.quality || 0.8);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Create new file with compressed data
              const compressedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              
              // If compressed file is larger, return original
              if (compressedFile.size >= file.size) {
                resolve(file);
              } else {
                resolve(compressedFile);
              }
            } else {
              resolve(file); // Return original if compression fails
            }
          },
          outputType,
          quality
        );
      } catch (error) {
        console.error('Image compression error:', error);
        resolve(file); // Return original on error
      }
    };

    img.onerror = () => {
      console.error('Failed to load image for compression');
      resolve(file); // Return original on error
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve(file);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress image and convert to base64
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<{base64: string, file: File}> - The compressed base64 data and file
 */
export async function compressImageToBase64(
  file: File,
  options: CompressionOptions = {}
): Promise<{ base64: string; file: File; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;
  const compressedFile = await compressImage(file, options);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({
        base64: base64Data,
        file: compressedFile,
        originalSize,
        compressedSize: compressedFile.size,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(compressedFile);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
