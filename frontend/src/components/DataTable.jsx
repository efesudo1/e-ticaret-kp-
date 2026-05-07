import { useState, useMemo, useEffect, Fragment } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';

/**
 * Excel-mantığında reusable tablo:
 * - Kolon başlığına tıkla → ASC → DESC → clear (3 cycle)
 * - Üstte global text search (string kolonlarda contains)
 * - Custom render desteği (column.render)
 * - Format desteği (column.format)
 * - Expandable rows (expandable callback)
 *
 * Kullanım:
 *   <DataTable
 *     rows={users}
 *     columns={[
 *       { key: 'name', label: 'İsim', sortable: true },
 *       { key: 'spend', label: 'Spend', align: 'right', sortable: true, format: fmtTL },
 *       { key: 'actions', label: '', sortable: false, render: (row) => <button/> },
 *     ]}
 *     searchable
 *     defaultSort={{ key: 'spend', dir: 'desc' }}
 *   />
 */
export default function DataTable({
  rows = [],
  columns = [],
  searchable = true,
  searchPlaceholder = 'Tabloda ara...',
  defaultSort = null,
  expandable = null,           // (row, idx) => ReactNode | null  (null = expand kapalı)
  emptyMessage = 'Veri yok',
  rowKey = (row, idx) => row.id ?? row.key ?? idx,
  className = '',
  stickyHeader = true,
  compact = false,
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(defaultSort || { key: null, dir: null });
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  // defaultSort prop değişince state'i yenile (parent re-render yaparsa)
  useEffect(() => {
    if (defaultSort) setSort(defaultSort);
  }, [defaultSort?.key, defaultSort?.dir]);

  const handleHeaderClick = (col) => {
    if (col.sortable === false) return;
    setSort(prev => {
      if (prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return { key: null, dir: null };
    });
  };

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Filter + sort hesaplama
  const visibleRows = useMemo(() => {
    let result = rows;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(row =>
        columns.some(col => {
          const v = row[col.key];
          if (v == null) return false;
          return String(v).toLowerCase().includes(q);
        })
      );
    }

    // Sort
    if (sort.key && sort.dir) {
      const col = columns.find(c => c.key === sort.key);
      const sortFn = col?.sortFn;
      const dirMul = sort.dir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (sortFn) return dirMul * sortFn(a, b);
        const av = a[sort.key];
        const bv = b[sort.key];
        // null/undefined her zaman en sonda
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        // Numeric karşılaştırma
        if (typeof av === 'number' && typeof bv === 'number') return dirMul * (av - bv);
        // Tarih
        if (av instanceof Date && bv instanceof Date) return dirMul * (av - bv);
        // String (locale + case-insensitive)
        return dirMul * String(av).localeCompare(String(bv), 'tr', { sensitivity: 'base', numeric: true });
      });
    }

    return result;
  }, [rows, columns, search, sort]);

  return (
    <div className={`datatable-wrapper ${className}`}>
      {searchable && (
        <div className="datatable-toolbar">
          <div className="datatable-search">
            <Search size={14} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="datatable-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>
          <div className="datatable-count">
            {visibleRows.length === rows.length
              ? `${rows.length} kayıt`
              : `${visibleRows.length} / ${rows.length} kayıt`}
          </div>
        </div>
      )}

      <div className="datatable-container">
        <table className={`datatable ${compact ? 'datatable-compact' : ''}`}>
          <thead className={stickyHeader ? 'datatable-sticky' : ''}>
            <tr>
              {expandable && <th style={{ width: 36 }}></th>}
              {columns.map(col => {
                const isSortable = col.sortable !== false;
                const isActive = sort.key === col.key && sort.dir;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col)}
                    style={{
                      textAlign: col.align || 'left',
                      cursor: isSortable ? 'pointer' : 'default',
                      width: col.width,
                      whiteSpace: 'nowrap',
                    }}
                    className={isActive ? 'datatable-sorted' : ''}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {isSortable && (
                        <span className="datatable-sort-icon">
                          {sort.key === col.key
                            ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                            : <ArrowUpDown size={12} style={{ opacity: 0.35 }} />}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (expandable ? 1 : 0)}
                  style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}
                >
                  {search ? 'Aramayla eşleşen kayıt yok' : emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, idx) => {
                const key = rowKey(row, idx);
                const isExpanded = expandable && expandedKeys.has(key);
                const expanded = isExpanded ? expandable(row, idx) : null;
                return (
                  <Fragment key={key}>
                    <tr
                      className={expandable ? 'datatable-row-clickable' : ''}
                      onClick={expandable ? () => toggleExpand(key) : undefined}
                    >
                      {expandable && (
                        <td className="datatable-expand-cell">
                          <span className={`datatable-expand-arrow ${isExpanded ? 'open' : ''}`}>▶</span>
                        </td>
                      )}
                      {columns.map(col => {
                        const value = row[col.key];
                        const cell = col.render
                          ? col.render(row, idx)
                          : col.format
                            ? col.format(value, row)
                            : value;
                        return (
                          <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                            {cell ?? '—'}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && expanded && (
                      <tr className="datatable-expanded-row" onClick={(e) => e.stopPropagation()}>
                        <td colSpan={columns.length + 1}>{expanded}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
