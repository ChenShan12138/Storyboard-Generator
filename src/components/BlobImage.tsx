import React, { useState, useEffect } from 'react';

interface BlobImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

// A cache to avoid recreating blobs for the same base64 string
const blobCache = new Map<string, string>();

export function BlobImage({ src, ...props }: BlobImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      return;
    }

    if (src.startsWith('http') || src.startsWith('blob:')) {
      setBlobUrl(src);
      return;
    }

    if (src.startsWith('data:')) {
      // Check cache first
      // To avoid storing massive base64 strings as keys, we could hash them, 
      // but for simplicity and speed, we'll just use a simple substring as a key if it's long enough.
      // Actually, storing the base64 in the Map key keeps it in memory, but it's already in memory from the props.
      // Let's just use the first 100 chars + length as a pseudo-hash to save memory.
      const cacheKey = src.length > 100 ? `${src.substring(0, 100)}_${src.length}` : src;
      
      if (blobCache.has(cacheKey)) {
        setBlobUrl(blobCache.get(cacheKey)!);
        return;
      }

      let isActive = true;
      fetch(src)
        .then(res => res.blob())
        .then(blob => {
          if (isActive) {
            const url = URL.createObjectURL(blob);
            blobCache.set(cacheKey, url);
            setBlobUrl(url);
          }
        })
        .catch(err => {
          console.error('Failed to convert base64 to blob', err);
          if (isActive) setBlobUrl(src);
        });

      return () => {
        isActive = false;
      };
    }

    setBlobUrl(src);
  }, [src]);

  if (!blobUrl) {
    return <div className={`animate-pulse bg-gray-200 ${props.className || ''}`} />;
  }

  return <img src={blobUrl} {...props} loading="lazy" />;
}
