import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { compressImageToBase64, formatFileSize } from '@/lib/imageCompression';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  className?: string;
  maxSize?: number;
  accept?: string[];
  enableCompression?: boolean;
  compressionQuality?: number;
  maxDimension?: number;
}

export function ImageUpload({
  value,
  onChange,
  className,
  maxSize = 5,
  accept = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  enableCompression = true,
  compressionQuality = 0.7,
  maxDimension = 1200
}: ImageUploadProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadMutation = trpc.storage.upload.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    if (!accept.includes(file.type)) {
      return t('imageUpload.invalidFormat');
    }
    if (file.size > maxSize * 1024 * 1024) {
      return t('imageUpload.fileTooLarge');
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setCompressionInfo(null);

    try {
      let base64Data: string;
      let finalFile = file;
      
      // Compress image if enabled
      if (enableCompression && file.type.startsWith('image/')) {
        setUploadProgress(20);
        
        const compressed = await compressImageToBase64(file, {
          maxWidth: maxDimension,
          maxHeight: maxDimension,
          quality: compressionQuality,
        });
        
        base64Data = compressed.base64;
        finalFile = compressed.file;
        
        // Show compression info if size was reduced
        if (compressed.compressedSize < compressed.originalSize) {
          const savedPercent = Math.round((1 - compressed.compressedSize / compressed.originalSize) * 100);
          setCompressionInfo(
            `${formatFileSize(compressed.originalSize)} → ${formatFileSize(compressed.compressedSize)} (${savedPercent}% saved)`
          );
        }
        
        setUploadProgress(50);
      } else {
        // No compression - read file directly
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setUploadProgress(50);
      }

      setUploadProgress(70);

      const result = await uploadMutation.mutateAsync({
        fileName: finalFile.name,
        contentType: finalFile.type,
        base64Data: base64Data
      });

      setUploadProgress(100);
      onChange(result.url ?? undefined);
    } catch (err) {
      console.error('Upload error:', err);
      setError(t('imageUpload.uploadFailed'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    setCompressionInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        <div className="relative group">
          <div className="relative aspect-square w-full max-w-[200px] mx-auto rounded-xl overflow-hidden border-2 border-border bg-muted">
            <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleClick} className="text-xs">
                {t('imageUpload.change')}
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleRemove} className="text-xs">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 mt-2">
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('imageUpload.uploaded')}</span>
            </div>
            {compressionInfo && (
              <p className="text-xs text-muted-foreground">{compressionInfo}</p>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200',
            'flex flex-col items-center justify-center p-8 text-center',
            'hover:border-primary hover:bg-primary/5',
            isDragging && 'border-primary bg-primary/10 scale-[1.02]',
            error && 'border-destructive bg-destructive/5',
            !isDragging && !error && 'border-muted-foreground/25 bg-muted/50'
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                {uploadProgress < 50 
                  ? t('imageUpload.compressing') || 'Compressing...'
                  : t('imageUpload.uploading')
                }
              </p>
              {uploadProgress > 0 && (
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          ) : isDragging ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-primary">{t('imageUpload.dropHere')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('imageUpload.clickOrDrag')}</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP (5MB max)</p>
                {enableCompression && (
                  <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                    {t('imageUpload.autoCompression') || 'Auto-compressed for faster loading'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-2 text-center">{error}</p>}
    </div>
  );
}

export default ImageUpload;
