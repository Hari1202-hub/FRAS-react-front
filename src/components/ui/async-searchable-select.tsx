import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface AsyncOption {
  value: string;
  label: string;
}

export interface AsyncPageResult {
  options: AsyncOption[];
  hasMore: boolean;
}

interface AsyncSearchableSelectProps {
  value: string;
  onChange: (value: string, option?: AsyncOption) => void;
  /** Fetch one page of options for a search term. Page is 1-based. */
  fetchPage: (args: { search: string; page: number }) => Promise<AsyncPageResult>;
  /** Options always pinned to the top, regardless of search (e.g. "All"). */
  staticOptions?: AsyncOption[];
  /** Label to show for the current value when it isn't in the loaded page yet. */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * A Select-style combobox whose options are searched and paginated on the
 * server. The search box is debounced; scrolling to the bottom of the list
 * loads the next page. Use for very large lists (e.g. projects).
 */
export function AsyncSearchableSelect({
  value,
  onChange,
  fetchPage,
  staticOptions = [],
  selectedLabel,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  className,
  disabled,
}: AsyncSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  // Remember the chosen option so its label shows even after the list changes.
  const [chosen, setChosen] = useState<AsyncOption | null>(null);

  // Keep the latest fetcher without retriggering effects when it's inline.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadPage = useCallback(async (pageToLoad: number, term: string, replace: boolean) => {
    setLoading(true);
    try {
      const res = await fetchRef.current({ search: term, page: pageToLoad });
      setOptions((prev) => (replace ? res.options : [...prev, ...res.options]));
      setHasMore(res.hasMore);
      setPage(pageToLoad);
    } catch {
      if (replace) setOptions([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // (Re)load the first page when the dropdown opens or the search changes.
  useEffect(() => {
    if (!open) return;
    loadPage(1, debounced, true);
  }, [open, debounced, loadPage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || !hasMore) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      loadPage(page + 1, debounced, false);
    }
  };

  const select = (opt: AsyncOption) => {
    setChosen(opt);
    onChange(opt.value, opt);
    setOpen(false);
  };

  const displayLabel =
    chosen?.value === value
      ? chosen.label
      : staticOptions.find((o) => o.value === value)?.label ??
        (value ? selectedLabel : undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between px-3 font-normal text-sm md:text-sm", className)}
        >
          <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
            {displayLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* shouldFilter={false}: filtering happens on the server */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList onScroll={handleScroll}>
            {!loading && options.length === 0 && staticOptions.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {staticOptions.map((opt) => (
                <CommandItem key={`static-${opt.value}`} value={opt.value} onSelect={() => select(opt)}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
              {options.map((opt) => (
                <CommandItem key={opt.value} value={opt.value} onSelect={() => select(opt)}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
