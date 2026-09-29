export default function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  autoComplete,
  icon: Icon,
  rightSlot,
}) {
  return (
    <div className="field">
      {/* Conditionally render label only if it's provided */}
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className={`field__control ${error ? "field__control--error" : ""}`}>
        <label htmlFor={id} className="field__icon-wrapper">
          {Icon && (
            <Icon size={17} className="field__icon" aria-hidden="true" />
          )}
        </label>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-label={!label ? placeholder : undefined} // Screen reader fallback if no visible label
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {rightSlot}
      </div>
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
