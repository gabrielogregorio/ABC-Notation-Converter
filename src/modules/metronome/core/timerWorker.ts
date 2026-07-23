/**
 * Timer em Web Worker ("worker-timer trick").
 *
 * Abas/telas em background têm `setInterval` na main thread limitado a ≥1000ms -
 * o que faria o metrônomo engasgar. Um Worker não sofre esse throttling: roda o
 * `setInterval` e só faz `postMessage('tick')`; a main thread agenda o áudio no
 * relógio do AudioContext. Assim o metrônomo continua preciso com a aba oculta.
 */
let intervalId: ReturnType<typeof setInterval> | null = null;

interface StartMsg { command: 'start'; interval: number }
interface StopMsg { command: 'stop' }
interface IntervalMsg { command: 'interval'; interval: number }
type TimerMsg = StartMsg | StopMsg | IntervalMsg;

self.onmessage = (e: MessageEvent<TimerMsg>) => {
  const msg = e.data;
  if (msg.command === 'start') {
    if (intervalId != null) clearInterval(intervalId);
    intervalId = setInterval(() => self.postMessage('tick'), msg.interval);
  } else if (msg.command === 'stop') {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  } else if (msg.command === 'interval') {
    if (intervalId != null) clearInterval(intervalId);
    intervalId = setInterval(() => self.postMessage('tick'), msg.interval);
  }
};
