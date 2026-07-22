// VIOLATION: MUTABLE_EXPORT — export let creates shared mutable state
// VIOLATION: TIMER_NO_CLEANUP — setInterval without clearInterval

export let eventCount = 0;
export let lastEvent: string | null = null;

export function startPolling(): void {
  // VIOLATION: TIMER_NO_CLEANUP — no clearInterval anywhere in this file
  setInterval(() => {
    eventCount++;
    lastEvent = new Date().toISOString();
    console.log("Polling...", eventCount);
  }, 5000);

  setTimeout(() => {
    console.log("Delayed initialization complete");
  }, 1000);
}

export function handleEvent(event: string): void {
  eventCount++;
  lastEvent = event;
}
