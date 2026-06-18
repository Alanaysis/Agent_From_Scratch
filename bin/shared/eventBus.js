import { EventEmitter } from 'events';
class TypedEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0);
    }
    emit(event, data) {
        return super.emit(event, data);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
}
export const eventBus = new TypedEventBus();
