export function Progress({ value }: { value: number }) {
  return (
    <progress
      className="progress"
      max={100}
      value={value}
      aria-label={`Прогресс: ${value}%`}
    >
      {value}%
    </progress>
  );
}
