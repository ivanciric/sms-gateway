import { EventEmitter } from 'events';

export const activityBus = new EventEmitter();
activityBus.setMaxListeners(200);

export function emitActivity(type, data) {
  activityBus.emit('activity', { type, data });
}
