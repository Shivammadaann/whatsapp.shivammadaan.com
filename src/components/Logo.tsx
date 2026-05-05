import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textColor?: string;
  eyebrowColor?: string;
  variant?: 'default' | 'compact';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "", 
  size = 40, 
  showText = true,
  textColor = "text-slate-950",
  eyebrowColor = "text-[#5B45FF]",
  variant = 'default'
}) => {
  const brandMark = (
    <div
      style={{ width: size, height: size }}
      className={variant === 'compact'
        ? "overflow-hidden rounded-xl shadow-sm"
        : "overflow-hidden rounded-2xl shadow-lg shadow-[#5B45FF]/20"
      }
    >
      <img
        src="/waba.svg"
        alt="WhatsApp Business"
        className="h-full w-full object-contain"
      />
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {brandMark}
        {showText && (
          <span className={`text-lg font-black tracking-tight ${textColor}`}>WhatsApp Business</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {brandMark}
      {showText && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.28em] ${eyebrowColor}`}>Business suite</p>
          <p className={`text-xl font-black tracking-tight ${textColor}`}>WhatsApp Business</p>
        </div>
      )}
    </div>
  );
};
