"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, Landmark, Loader2, MapPin, Search } from "lucide-react";
import { COMMON_INDIAN_BRANCHES, findIfscByBankAndLocation, type CommonBranch } from "@/lib/indian-banks";

type IfscFinderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBank?: string;
  onSelectIfsc: (ifsc: string, bankName?: string, branch?: string) => void;
};

export function IfscFinderDialog({
  open,
  onOpenChange,
  defaultBank = "",
  onSelectIfsc,
}: IfscFinderDialogProps) {
  const [bankQuery, setBankQuery] = useState(defaultBank);
  const [locationQuery, setLocationQuery] = useState("");
  const [results, setResults] = useState<CommonBranch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [copiedIfsc, setCopiedIfsc] = useState<string | null>(null);

  // Sync bankQuery when defaultBank changes
  if (defaultBank && !bankQuery) {
    setBankQuery(defaultBank);
  }

  const handleSearch = async (e?: React.FormEvent, overrideBank?: string, overrideLoc?: string) => {
    if (e) e.preventDefault();
    const activeBank = overrideBank !== undefined ? overrideBank : bankQuery;
    const activeLoc = overrideLoc !== undefined ? overrideLoc : locationQuery;

    if (!activeBank.trim() && !activeLoc.trim()) {
      toast.error("Please enter a Bank Name or Branch/Location.");
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      // 1. Client-side instant directory match
      const localMatches = findIfscByBankAndLocation(activeBank, activeLoc);

      // 2. Fetch server matches if available
      const params = new URLSearchParams();
      if (activeBank.trim()) params.set("bank", activeBank.trim());
      if (activeLoc.trim()) params.set("location", activeLoc.trim());

      const res = await fetch(`/api/wallet/verify-bank-account?${params.toString()}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const serverResults = (data?.results as CommonBranch[]) || [];
        // Deduplicate
        const merged = [...localMatches];
        for (const item of serverResults) {
          if (!merged.some((m) => m.ifsc === item.ifsc)) {
            merged.push(item);
          }
        }
        setResults(merged);
      } else {
        setResults(localMatches);
      }
    } catch {
      setResults(findIfscByBankAndLocation(activeBank, activeLoc));
    } finally {
      setSearching(false);
    }
  };

  const handleCopy = (ifsc: string) => {
    navigator.clipboard.writeText(ifsc);
    setCopiedIfsc(ifsc);
    toast.success(`Copied IFSC: ${ifsc}`);
    setTimeout(() => {
      setCopiedIfsc((curr) => (curr === ifsc ? null : curr));
    }, 2500);
  };

  const handleApply = (branch: CommonBranch) => {
    onSelectIfsc(branch.ifsc, branch.bankName, `${branch.branch} (${branch.city})`);
    toast.success(`Applied ${branch.ifsc} (${branch.branch}) to form!`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Search className="h-5 w-5 text-primary" />
            Find Bank IFSC Code
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enter your Bank Name and Branch or City (e.g. Ikhar, Bharuch, Surat) to find the official 11-character IFSC code.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSearch(e)} className="space-y-3 pt-1">
          {/* Quick pick chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-muted-foreground">Quick pick:</span>
            {[
              { label: "Ikhar (Bank of Baroda)", bank: "Bank of Baroda", loc: "Ikhar" },
              { label: "Bharuch", loc: "Bharuch" },
              { label: "Surat", loc: "Surat" },
              { label: "Ahmedabad", loc: "Ahmedabad" },
              { label: "Mumbai", loc: "Mumbai" },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  if (chip.bank) setBankQuery(chip.bank);
                  setLocationQuery(chip.loc);
                  void handleSearch(undefined, chip.bank || bankQuery, chip.loc);
                }}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Label 1: Bank Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
              Bank Name
            </label>
            <input
              type="text"
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
              placeholder="e.g. Bank of Baroda, State Bank of India, HDFC Bank"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
            />
          </div>

          {/* Label 2: Branch / Location */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Branch / Location
            </label>
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="e.g. Ikhar, Amod, Bharuch, Surat, Andheri"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button
              type="submit"
              disabled={searching}
              className="w-full sm:w-auto h-9 px-4 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              {searching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" /> Find IFSC Code
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Results Section */}
        {hasSearched && (
          <div className="mt-3 border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {results.length > 0
                ? `Found ${results.length} Matching Branch${results.length > 1 ? "es" : ""}:`
                : "No matching branches found"}
            </p>

            {results.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {results.map((item) => {
                  const isCopied = copiedIfsc === item.ifsc;
                  return (
                    <div
                      key={item.ifsc}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 p-3 hover:border-primary/40 transition"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {item.bankName}
                          </p>
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                            {item.ifsc}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          Branch: {item.branch} · {item.city}, {item.state}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Copy Button with Copy Symbol */}
                        <button
                          type="button"
                          onClick={() => handleCopy(item.ifsc)}
                          className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                            isCopied
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                          title="Copy IFSC code"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Apply to Form Button */}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApply(item)}
                          className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                        >
                          Use IFSC
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No branch found matching your search. Please check the spelling or try searching by city name.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
