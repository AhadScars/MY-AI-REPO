import { ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { normalizePath } from '../../../packages/shared/src/path';

interface BreadcrumbsProps {
  filePath: string;
}

export function Breadcrumbs({ filePath }: BreadcrumbsProps) {
  const rootPath = useWorkspaceStore((s) => s.rootPath);

  if (filePath.startsWith('untitled:')) {
    return (
      <div className="flex h-6 items-center gap-1 overflow-hidden border-b border-ide-border px-3 text-ide-xs text-ide-muted">
        <span className="text-ide-text">{filePath.replace('untitled:', 'Untitled-')}</span>
      </div>
    );
  }

  const normalized = normalizePath(filePath);
  const rootNorm = rootPath ? normalizePath(rootPath) : null;

  let relative = normalized;
  if (rootNorm && normalized.toLowerCase().startsWith(rootNorm.toLowerCase())) {
    relative = normalized.slice(rootNorm.length).replace(/^\//, '');
  }

  const parts = relative.split('/').filter(Boolean);

  return (
    <nav
      className="flex h-6 items-center gap-0.5 overflow-x-auto border-b border-ide-border px-3 text-ide-xs text-ide-muted"
      aria-label="Breadcrumb"
    >
      {rootPath && (
        <>
          <span className="shrink-0 truncate max-w-[120px]" title={rootPath}>
            {rootPath.split(/[/\\]/).filter(Boolean).pop()}
          </span>
          {parts.length > 0 && <ChevronRight size={12} className="shrink-0 opacity-50" />}
        </>
      )}
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        return (
          <span key={`${part}-${i}`} className="flex shrink-0 items-center gap-0.5">
            {i > 0 && <ChevronRight size={12} className="opacity-50" />}
            <span className={isLast ? 'text-ide-text' : undefined} title={part}>
              {part}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
