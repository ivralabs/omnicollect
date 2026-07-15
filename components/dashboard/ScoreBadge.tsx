import { cn, scoreColor } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full tabular-nums',
        scoreColor(score),
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
      )}
    >
      {score}
    </span>
  );
}
