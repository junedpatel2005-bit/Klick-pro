"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { POPULAR_INDIAN_BANKS, type IndianBank } from "@/lib/indian-banks";

type BankComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  onSelectBank?: (bank: IndianBank) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
};

export function BankCombobox({
  value,
  onChange,
  onSelectBank,
  placeholder = "Search or type bank name (e.g. HDFC, SBI, Kotak)…",
  className = "",
  required = false,
  id = "bank-name-combobox",
}: BankComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal query with external value prop
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBanks = POPULAR_INDIAN_BANKS.filter((b) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const bankName = b.name.toLowerCase();
    const code = b.code.toLowerCase();
    if (bankName.includes(q) || code.includes(q)) return true;
    if (q === "bob" && (code === "barb" || bankName.includes("baroda"))) return true;
    if (q === "sbi" && (code === "sbin" || bankName.includes("state bank"))) return true;
    if (q === "pnb" && (code === "punb" || bankName.includes("punjab national"))) return true;
    if (q === "cbi" && (code === "cbin" || bankName.includes("central bank"))) return true;
    if (q === "ubi" && (code === "ubin" || bankName.includes("union bank"))) return true;
    if (q === "boi" && (code === "bkid" || bankName.includes("bank of india"))) return true;
    if (q === "kotak" && (code === "kkbk" || bankName.includes("kotak"))) return true;
    return false;
  });

  const handleSelect = (bank: IndianBank) => {
    setQuery(bank.name);
    onChange(bank.name);
    onSelectBank?.(bank);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && filteredBanks[0]) {
        handleSelect(filteredBanks[0]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    inputRef.current?.focus();
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* 2-in-1 Typeable Input with Embedded Dropdown Toggle */}
      <div className="relative flex items-center">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="h-10 w-full rounded-xl border border-input bg-background pl-3 pr-16 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Clear input"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
            title="Toggle Indian Bank list"
          >
            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* Autocomplete Suggestion Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-1.5 backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground flex items-center justify-between border-b border-border/50 mb-1">
            <span>Choose from Indian Banks ({filteredBanks.length})</span>
            <span className="text-[10px]">or type custom name</span>
          </div>

          {filteredBanks.length > 0 ? (
            <div className="space-y-0.5">
              {filteredBanks.map((bank) => {
                const isSelected = value.toLowerCase() === bank.name.toLowerCase();
                return (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => handleSelect(bank)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="truncate pr-2">{bank.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase font-bold ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {bank.code}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 text-center">
              <p className="text-xs text-muted-foreground">
                No standard bank matching &ldquo;<span className="font-semibold text-foreground">{query}</span>&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Use &ldquo;{query}&rdquo; as custom bank name
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
