import { useRef, useState } from "react";

import { mutationErrorMessage } from "../api";

interface InlineInputFieldProps<Value> {
  label: string;
  displayValue: string;
  editValue: string;
  onSave: (value: Value) => Promise<void>;
  parse: (value: string) => Value;
  className?: string;
  inputType?: "text" | "number" | "time";
  inputMode?: "decimal" | "numeric";
  min?: string;
  placeholder?: string;
  step?: string;
  unit?: string;
}

export function InlineInputField<Value>({
  label,
  displayValue,
  editValue,
  onSave,
  parse,
  className = "",
  inputType = "text",
  inputMode,
  min,
  placeholder,
  step,
  unit,
}: InlineInputFieldProps<Value>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const cancellingRef = useRef(false);

  function beginEditing(): void {
    cancellingRef.current = false;
    setDraft(editValue);
    setError(null);
    setIsEditing(true);
  }

  function cancel(): void {
    cancellingRef.current = true;
    setDraft(editValue);
    setError(null);
    setIsEditing(false);
  }

  async function save(): Promise<void> {
    if (savingRef.current) {
      return;
    }

    if (draft === editValue) {
      setError(null);
      setIsEditing(false);
      return;
    }

    let value: Value;
    try {
      value = parse(draft);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Check this value");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(value);
      setIsEditing(false);
    } catch (saveError) {
      setError(mutationErrorMessage(saveError));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        className={`editable-value ${className}`.trim()}
        type="button"
        aria-label={`Edit ${label}`}
        onClick={beginEditing}
      >
        {displayValue}
      </button>
    );
  }

  return (
    <div className={`inline-editor ${className}`.trim()}>
      <span className="inline-control">
        <input
          autoFocus
          aria-label={label}
          type={inputType}
          inputMode={inputMode}
          min={min}
          step={step}
          placeholder={placeholder}
          value={draft}
          disabled={isSaving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (cancellingRef.current) {
              cancellingRef.current = false;
              return;
            }
            void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        />
        {unit && <span className="inline-unit">{unit}</span>}
      </span>
      {isSaving && <span className="field-state" role="status">Saving...</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

interface SelectOption<Value extends string> {
  value: Value;
  label: string;
}

interface InlineSelectFieldProps<Value extends string> {
  label: string;
  value: Value;
  displayValue: string;
  options: Array<SelectOption<Value>>;
  onSave: (value: Value) => Promise<void>;
  className?: string;
}

export function InlineSelectField<Value extends string>({
  label,
  value,
  displayValue,
  options,
  onSave,
  className = "",
}: InlineSelectFieldProps<Value>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  function beginEditing(): void {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  }

  async function save(nextValue: Value): Promise<void> {
    if (savingRef.current) {
      return;
    }
    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(nextValue);
      setIsEditing(false);
    } catch (saveError) {
      setError(mutationErrorMessage(saveError));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        className={`editable-value ${className}`.trim()}
        type="button"
        aria-label={`Edit ${label}`}
        onClick={beginEditing}
      >
        {displayValue}
      </button>
    );
  }

  return (
    <div className={`inline-editor ${className}`.trim()}>
      <select
        autoFocus
        aria-label={label}
        value={draft}
        disabled={isSaving}
        onChange={(event) => {
          const nextValue = event.target.value as Value;
          setDraft(nextValue);
          void save(nextValue);
        }}
        onBlur={() => {
          if (!savingRef.current && !error) {
            setIsEditing(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
            setError(null);
            setIsEditing(false);
          }
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {isSaving && <span className="field-state" role="status">Saving...</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}
