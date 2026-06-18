"use client";

import { useState, useMemo } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Download,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy
} from "lucide-react";

export type Column<T = any> = {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
};

export type Action<T = any> = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  disabled?: (row: T) => boolean;
  variant?: "primary" | "secondary" | "danger";
};

export type DataTableProps<T = any> = {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  sortable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  exportable?: boolean;
  exportFormats?: ("csv" | "excel" | "pdf" | "json")[];
  className?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  filterable = true,
  sortable = true,
  paginated = true,
  pageSize = 10,
  exportable = true,
  exportFormats = ["csv", "excel"],
  className = "",
  emptyMessage = "No data available",
  onRowClick,
  getRowId = (row) => JSON.stringify(row),
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        columns.some(column => {
          const value = row[column.key];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(row =>
          row[key] && row[key].toString().toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortColumn && sortable) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        const comparison = aValue.toString().localeCompare(bValue.toString());
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, filters, sortColumn, sortDirection, sortable, columns]);

  // Apply pagination
  const paginatedData = useMemo(() => {
    if (!paginated) return processedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize, paginated]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const handleSort = (column: keyof T) => {
    if (!sortable) return;
    
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleFilter = (column: keyof T, value: string) => {
    setFilters(prev => ({ ...prev, [column as string]: value }));
    setCurrentPage(1);
  };

  const handleExport = (format: string) => {
    const exportData = processedData.map(row => {
      const exportRow: any = {};
      columns.forEach(column => {
        exportRow[column.title] = row[column.key];
      });
      return exportRow;
    });

    switch (format) {
      case "csv":
        exportToCSV(exportData, columns.map(c => c.title));
        break;
      case "excel":
        exportToExcel(exportData);
        break;
      case "pdf":
        exportToPDF(exportData);
        break;
      case "json":
        exportToJSON(exportData);
        break;
    }
  };

  const exportToCSV = (data: any[], headers: string[]) => {
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => `"${row[header] || ""}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = (data: any[]) => {
    // Simplified Excel export (in production, use a library like xlsx)
    const csvContent = Object.keys(data[0] || {}).join(",") + "\n" + 
      data.map(row => Object.values(row).map(v => `"${v}"`).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${new Date().toISOString().split("T")[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = (data: any[]) => {
    // Simplified PDF export (in production, use a library like jsPDF)
    alert("PDF export requires additional library implementation");
  };

  const exportToJSON = (data: any[]) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAlignmentClass = (align?: string) => {
    switch (align) {
      case "center": return "text-center";
      case "right": return "text-right";
      default: return "text-left";
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {filterable && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
            >
              <Filter className="w-4 h-4" />
              Filters
              {Object.values(filters).some(v => v) && (
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              )}
            </button>
          )}
          
          {exportable && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                <Download className="w-4 h-4" />
                Export
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                {exportFormats.map(format => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    Export as {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && filterable && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {columns.filter(col => col.filterable).map(column => (
              <div key={column.key as string}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {column.title}
                </label>
                <input
                  type="text"
                  placeholder={`Filter by ${column.title}`}
                  value={filters[column.key as string] || ""}
                  onChange={(e) => handleFilter(column.key, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key as string}
                    className={`px-4 py-3 text-xs font-medium text-slate-700 uppercase tracking-wider ${getAlignmentClass(column.align)}`}
                    style={{ width: column.width }}
                  >
                    {column.sortable ? (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-1 hover:text-slate-900"
                      >
                        {column.title}
                        {sortColumn === column.key && (
                          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    ) : (
                      column.title
                    )}
                  </th>
                ))}
                {actions.length > 0 && (
                  <th className="px-4 py-3 text-xs font-medium text-slate-700 uppercase tracking-wider text-center">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="px-4 py-8 text-center">
                    <div className="inline-flex items-center gap-2 text-slate-600">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="px-4 py-8 text-center text-slate-600">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr
                    key={getRowId(row)}
                    className={`hover:bg-slate-50 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(column => (
                      <td
                        key={column.key as string}
                        className={`px-4 py-3 text-sm text-slate-900 ${getAlignmentClass(column.align)}`}
                      >
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center gap-1">
                          {actions.map(action => (
                            <button
                              key={action.key}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                              disabled={action.disabled?.(row)}
                              className={`p-1 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                                action.variant === "danger" ? "text-red-600 hover:bg-red-50" :
                                action.variant === "primary" ? "text-blue-600 hover:bg-blue-50" :
                                "text-slate-600"
                              }`}
                              title={action.label}
                            >
                              {action.icon || <MoreVertical className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg border ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
