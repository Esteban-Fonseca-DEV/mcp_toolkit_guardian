import { EventEmitter } from "events";
import { GuardianEventMap } from "./events";

export class GuardianEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends keyof GuardianEventMap>(event: K, data: GuardianEventMap[K]): void {
    this.emitter.emit(event, data);
  }

  on<K extends keyof GuardianEventMap>(
    event: K,
    handler: (data: GuardianEventMap[K]) => void
  ): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof GuardianEventMap>(
    event: K,
    handler: (data: GuardianEventMap[K]) => void
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  listenerCount(event: keyof GuardianEventMap): number {
    return this.emitter.listenerCount(event);
  }
}
