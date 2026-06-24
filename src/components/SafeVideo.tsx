import React, { useState, useEffect } from 'react';
import { Video } from 'lucide-react';

interface SafeVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  fallbackText?: string;
}

export const SafeVideo = React.forwardRef<HTMLVideoElement, SafeVideoProps>(
  ({ src, className, fallbackText = 'वीडियो लोड नहीं हो सका या फॉर्मेट समर्थित नहीं है', ...props }, ref) => {
    const [hasError, setHasError] = useState(false);

    // Reset error when source changes
    useEffect(() => {
      setHasError(false);
    }, [src]);

    if (hasError || !src) {
      return (
        <div className={`flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-4 min-h-[150px] border border-slate-800/40 rounded-xl w-full h-full ${className}`}>
          <Video className="w-8 h-8 text-slate-600 mb-1 animate-pulse" />
          <span className="text-[10px] text-slate-500 font-medium text-center px-2">{fallbackText}</span>
        </div>
      );
    }

    return (
      <video
        ref={ref}
        src={src}
        className={className}
        onError={() => {
          console.warn("Video failed to load, falling back gracefully:", src);
          setHasError(true);
        }}
        {...props}
      />
    );
  }
);

SafeVideo.displayName = 'SafeVideo';
