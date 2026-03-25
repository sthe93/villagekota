import { useEffect, useRef, useState, type RefObject } from "react";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { searchSouthAfricaAddresses, type AddressSuggestion } from "@/lib/maps";

type AddressAutocompleteFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSuggestionSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  selected?: boolean;
  selectedMessage?: string;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
  suggestionsClassName?: string;
  textareaId?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  hasError?: boolean;
};

export default function AddressAutocompleteField({
  label,
  value,
  onValueChange,
  onSuggestionSelect,
  placeholder,
  rows = 3,
  required = false,
  selected = false,
  selectedMessage = "Address suggestion selected",
  className,
  labelClassName,
  textareaClassName,
  suggestionsClassName,
  textareaId,
  textareaRef,
  hasError = false,
}: AddressAutocompleteFieldProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const normalizedValue = value.trim();

    if (!normalizedValue || normalizedValue !== selectedValue) {
      setSelectedValue((current) => (normalizedValue === current ? current : null));
    }

    if (normalizedValue.length < 3 || selected || normalizedValue === selectedValue) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const nextSuggestions = await searchSouthAfricaAddresses(normalizedValue, controller.signal);
        setSuggestions(nextSuggestions);
        setShowSuggestions(nextSuggestions.length > 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selected, selectedValue, value]);

  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    setSelectedValue(suggestion.place_name.trim());
    onValueChange(suggestion.place_name);
    onSuggestionSelect?.(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={boxRef} className={className || "relative"}>
      <label className={labelClassName || "mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"}>
        {label}
        {required ? " *" : ""}
      </label>

      <textarea
        id={textareaId}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setSelectedValue(null);
          onValueChange(event.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        rows={rows}
        className={
          textareaClassName ||
          `w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${
            hasError ? "border-destructive focus:border-destructive" : "border-border"
          }`
        }
        required={required}
      />

      {loading && (
        <div className="absolute right-3 top-11 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {selected && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {selectedMessage}
        </p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          className={
            suggestionsClassName ||
            "absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card"
          }
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionSelect(suggestion)}
              className="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm text-foreground">{suggestion.place_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
