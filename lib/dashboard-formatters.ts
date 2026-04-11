const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function getRelativeUnit(deltaMs: number) {
  const seconds = Math.round(deltaMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30);

  if (Math.abs(seconds) < 60) {
    return { value: seconds, unit: "second" as const };
  }
  if (Math.abs(minutes) < 60) {
    return { value: minutes, unit: "minute" as const };
  }
  if (Math.abs(hours) < 24) {
    return { value: hours, unit: "hour" as const };
  }
  if (Math.abs(days) < 7) {
    return { value: days, unit: "day" as const };
  }
  if (Math.abs(weeks) < 5) {
    return { value: weeks, unit: "week" as const };
  }

  return { value: months, unit: "month" as const };
}

export function formatRelativeTime(timestamp: number) {
  const { value, unit } = getRelativeUnit(timestamp - Date.now());
  return relativeFormatter.format(value, unit);
}

export function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatExactDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
