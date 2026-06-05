import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  minWidth?: string;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "All",
  minWidth = "130px",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find((o) => o.value === value);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("all");
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-0.5" ref={ref}>
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <div className="relative" style={{ minWidth }}>
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSearch(""); }}
          className="w-full flex items-center justify-between gap-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-proscape text-left"
        >
          <span className={`truncate ${!selected || selected.value === "all" ? "text-gray-400" : "text-gray-800"}`}>
            {selected && selected.value !== "all" ? selected.label : placeholder}
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            {selected && selected.value !== "all" && (
              <X className="h-3 w-3 text-gray-400 hover:text-gray-600" onClick={handleClear} />
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 left-0 w-52 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  autoFocus
                  className="w-full pl-7 pr-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-proscape"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === "all" ? "text-proscape font-medium" : "text-gray-700"}`}
                onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
              >
                All
              </button>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 truncate ${value === o.value ? "text-proscape font-medium bg-blue-50" : "text-gray-700"}`}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">No results.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
