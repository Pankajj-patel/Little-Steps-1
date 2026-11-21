import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '../../design-system/Button';
import { EmptyState } from '../../design-system/EmptyState';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  accessor?: (item: T) => string | number | boolean | null | undefined;
  render?: (item: T) => React.ReactNode;
}

export interface AdminDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  filtersSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  loading?: boolean;
  initialPageSize?: number;
  initialSortKey?: string;
  initialSortDirection?: 'asc' | 'desc';
}

export function AdminDataTable<T extends object>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = 'Search records...',
  searchFilter,
  filtersSlot,
  actionsSlot,
  emptyTitle = 'No records found',
  emptyMessage = 'Try adjusting your search query or filters.',
  loading = false,
  initialPageSize = 10,
  initialSortKey,
  initialSortDirection = 'asc',
}: AdminDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 1. Filter
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.trim().toLowerCase();
    if (searchFilter) {
      return data.filter((item) => searchFilter(item, q));
    }
    // Default search over all string/number columns
    return data.filter((item) => {
      return columns.some((col) => {
        const val = col.accessor
          ? col.accessor(item)
          : (item as Record<string, unknown>)[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery, searchFilter, columns]);

  // 2. Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = col.accessor
        ? col.accessor(a)
        : (a as Record<string, unknown>)[sortKey];
      const valB = col.accessor
        ? col.accessor(b)
        : (b as Record<string, unknown>)[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection, columns]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleHeaderClick = (colKey: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === colKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(colKey);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-cream-accent/60 shadow-sm overflow-hidden flex flex-col">
      {/* Top Bar: Search, Filters & Action Buttons */}
      <div className="p-4 sm:p-5 border-b border-cream-accent/60 bg-offwhite/40 flex flex-col sm:flex-row gap-3.5 sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-cream-accent rounded-xl text-charcoal placeholder-muted focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Slot */}
          {filtersSlot && <div className="flex flex-wrap items-center gap-2">{filtersSlot}</div>}
        </div>

        {/* Actions Slot */}
        {actionsSlot && <div className="flex items-center gap-2 self-start sm:self-auto">{actionsSlot}</div>}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[220px]">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-8 h-8 border-3 border-sage border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted font-medium">Loading platform records...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="p-8">
            <EmptyState title={emptyTitle} description={emptyMessage} />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-accent/60 bg-cream/40 text-muted font-semibold text-xs tracking-wider uppercase">
                {columns.map((col) => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      onClick={() => handleHeaderClick(col.key, col.sortable)}
                      className={`px-4 sm:px-6 py-3.5 select-none ${col.sortable ? 'cursor-pointer hover:bg-cream/70 hover:text-charcoal transition' : ''} ${col.className || ''}`}
                      aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-muted/70">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-sage" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-sage" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-accent/40 text-charcoal">
              {paginatedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-cream/20 transition-colors group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 sm:px-6 py-4 align-middle ${col.className || ''}`}
                    >
                      {col.render
                        ? col.render(item)
                        : String(
                            col.accessor
                              ? col.accessor(item) ?? ''
                              : (item as Record<string, unknown>)[col.key] ?? ''
                          )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && sortedData.length > 0 && (
        <div className="p-4 sm:px-6 border-t border-cream-accent/60 bg-offwhite/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-cream-accent rounded-lg px-2 py-1 text-charcoal focus:outline-none focus:ring-1 focus:ring-sage"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="ml-2">
              Showing <span className="font-semibold text-charcoal">{startIndex + 1}</span>–
              <span className="font-semibold text-charcoal">
                {Math.min(startIndex + pageSize, sortedData.length)}
              </span>{' '}
              of <span className="font-semibold text-charcoal">{sortedData.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-2">
              Page <span className="font-semibold text-charcoal">{safePage}</span> of{' '}
              <span className="font-semibold text-charcoal">{totalPages}</span>
            </span>
            <Button
              variant="subtle"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="subtle"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
