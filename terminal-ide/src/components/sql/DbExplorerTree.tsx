import { ChevronDown, ChevronRight, Database, Table2, Loader2 } from 'lucide-react';
import { useSqlStore } from '../../stores/sqlStore';
import { cn } from '../../utils/cn';

/**
 * Clean tables tree: Database ▸ Table. Double-click a table to edit data.
 */
export function DbExplorerTree() {
  const engineType = useSqlStore((s) => s.engineType);
  const mysql = useSqlStore((s) => s.mysql);
  const mysqlDatabases = useSqlStore((s) => s.mysqlDatabases);
  const tables = useSqlStore((s) => s.tables);
  const expandedSchemas = useSqlStore((s) => s.expandedSchemas);
  const schemaTables = useSqlStore((s) => s.schemaTables);
  const loadingNodes = useSqlStore((s) => s.loadingNodes);
  const dbPath = useSqlStore((s) => s.dbPath);
  const tableEditor = useSqlStore((s) => s.tableEditor);

  const toggleSchema = useSqlStore((s) => s.toggleSchema);
  const openTableEditor = useSqlStore((s) => s.openTableEditor);

  if (!engineType) return null;

  if (engineType === 'sqlite') {
    const schemaKey = 'sqlite';
    const open = expandedSchemas.has(schemaKey);
    const tableList = schemaTables[schemaKey] ?? tables;
    const title = dbPath ? dbPath.split(/[/\\]/).pop() ?? 'SQLite' : 'SQLite';

    return (
      <div className="select-none py-0.5">
        <TreeItem
          depth={0}
          expandable
          expanded={open}
          loading={loadingNodes.has(`schema:${schemaKey}`)}
          icon={<Database size={14} className="text-ide-accent" />}
          label={title}
          onToggle={() => void toggleSchema(schemaKey)}
        />
        {open &&
          tableList.map((t) => (
            <TreeItem
              key={t}
              depth={1}
              expandable={false}
              active={
                tableEditor?.schemaKey === schemaKey && tableEditor?.table === t
              }
              icon={<Table2 size={13} className="text-ide-muted" />}
              label={t}
              onActivate={() => void openTableEditor(schemaKey, t)}
            />
          ))}
        {open && tableList.length === 0 && (
          <Empty depth={1}>No tables</Empty>
        )}
      </div>
    );
  }

  // MySQL
  if (mysqlDatabases.length === 0) {
    return <Empty depth={0}>No databases found</Empty>;
  }

  return (
    <div className="select-none py-0.5">
      {mysqlDatabases.map((schema) => {
        const open = expandedSchemas.has(schema);
        const tableList =
          schemaTables[schema] ?? (mysql?.database === schema ? tables : []);
        const activeSchema = mysql?.database === schema;

        return (
          <div key={schema}>
            <TreeItem
              depth={0}
              expandable
              expanded={open}
              selected={activeSchema}
              loading={loadingNodes.has(`schema:${schema}`)}
              icon={<Database size={14} className="text-ide-accent" />}
              label={schema}
              onToggle={() => void toggleSchema(schema)}
            />
            {open &&
              tableList.map((t) => (
                <TreeItem
                  key={`${schema}.${t}`}
                  depth={1}
                  expandable={false}
                  active={
                    tableEditor?.schemaKey === schema && tableEditor?.table === t
                  }
                  icon={<Table2 size={13} className="text-ide-muted" />}
                  label={t}
                  onActivate={() => void openTableEditor(schema, t)}
                />
              ))}
            {open &&
              tableList.length === 0 &&
              !loadingNodes.has(`schema:${schema}`) && (
                <Empty depth={1}>No tables</Empty>
              )}
          </div>
        );
      })}
    </div>
  );
}

function TreeItem({
  depth,
  expandable,
  expanded,
  selected,
  active,
  loading,
  icon,
  label,
  onToggle,
  onActivate,
}: {
  depth: number;
  expandable: boolean;
  expanded?: boolean;
  selected?: boolean;
  active?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
  onToggle?: () => void;
  onActivate?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={() => {
        if (expandable) onToggle?.();
        else onActivate?.();
      }}
      onDoubleClick={() => onActivate?.()}
      className={cn(
        'flex h-7 w-full items-center gap-1.5 pr-2 text-left text-ide-sm transition-colors',
        'hover:bg-ide-elevated',
        (selected || active) && 'bg-ide-selection text-ide-text',
        !selected && !active && 'text-ide-text',
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {expandable ? (
        expanded ? (
          <ChevronDown size={14} className="shrink-0 text-ide-muted" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-ide-muted" />
        )
      ) : (
        <span className="inline-block w-3.5 shrink-0" />
      )}
      {loading ? (
        <Loader2 size={13} className="shrink-0 animate-spin text-ide-muted" />
      ) : (
        <span className="shrink-0 opacity-90">{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function Empty({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <p
      className="py-1 text-ide-xs text-ide-muted"
      style={{ paddingLeft: 8 + depth * 14 + 18 }}
    >
      {children}
    </p>
  );
}
