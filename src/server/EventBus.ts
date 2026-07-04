import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    // Increase listener limits if many monitors are running
    this.setMaxListeners(100);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
}

export const eventBus = EventBus.getInstance();
export default eventBus;
