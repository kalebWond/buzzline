import type { Clock } from "./game.js";

export class FakeClock implements Clock {
  private t = 1_000_000;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private seq = 0;

  now(): number {
    return this.t;
  }

  setTimeout(fn: () => void, ms: number): () => void {
    const id = this.seq++;
    this.timers.push({ at: this.t + ms, fn, id });
    return () => {
      this.timers = this.timers.filter((x) => x.id !== id);
    };
  }

  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      const due = this.timers.filter((x) => x.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((x) => x.id !== due.id);
      this.t = due.at;
      due.fn();
    }
    this.t = target;
  }
}
