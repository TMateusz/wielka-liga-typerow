type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  "aria-label": string;
};

const MAX_SCORE = 20;

/** Pole bramek — bez leading zero na mobile (np. „01” zamiast „1”). */
export function ScoreInput({ value, onChange, disabled, required, "aria-label": ariaLabel }: Props) {
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      onChange(0);
      return;
    }
    onChange(Math.min(MAX_SCORE, parseInt(digits, 10)));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      required={required}
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      className="input-score"
      aria-label={ariaLabel}
    />
  );
}
