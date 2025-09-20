'use client';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'yellow';
  animated?: boolean;
  className?: string;
}

export default function ProgressBar({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  color = 'blue',
  animated = true,
  className = ''
}: ProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    yellow: 'bg-yellow-600'
  };

  const backgroundColorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100'
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Label and Percentage */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-500">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}

      {/* Progress Bar Container */}
      <div
        className={`
          w-full rounded-full overflow-hidden
          ${sizeClasses[size]}
          ${backgroundColorClasses[color]}
        `}
      >
        {/* Progress Bar Fill */}
        <div
          className={`
            ${sizeClasses[size]}
            ${colorClasses[color]}
            rounded-full transition-all duration-300 ease-out
            ${animated ? 'animate-pulse' : ''}
          `}
          style={{
            width: `${clampedProgress}%`,
            transition: animated ? 'width 0.3s ease-out' : 'none'
          }}
        />
      </div>
    </div>
  );
}