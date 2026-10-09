export function todayDateValue() {
  return new Date().toLocaleDateString("en-CA");
}

export function overdueCutoffDateValue() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}
