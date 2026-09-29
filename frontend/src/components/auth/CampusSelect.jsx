import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

export default function CampusSelect({
  id,
  label,
  options,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  optional = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    function onClickOutside(e) {
      if (!open) return;
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
        // onBlur?.();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, onBlur]);

  const filtered = query
    ? options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()))
    : options;

  function selectOption(opt) {
    onChange(opt);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="field" ref={rootRef}>
      <label className="field__label" htmlFor={id}>
        {label}{" "}
        {optional && <span className="field__optional">(optional)</span>}
      </label>

      <div
        className={`field__control select__control ${error ? "field__control--error" : ""}`}
        onClick={() => setOpen(true)}
      >
        <Search size={17} className="field__icon" aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? query : value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange("");
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <ChevronDown
          size={16}
          className={`select__chevron ${open ? "select__chevron--open" : ""}`}
        />
      </div>

      {open && (
        <ul className="select__menu" id={listId} role="listbox">
          {filtered.length === 0 && (
            <li className="select__empty">No matches found</li>
          )}
          {filtered.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              className={`select__option ${opt === value ? "select__option--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
            >
              <span>{opt}</span>
              {opt === value && <Check size={14} />}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
