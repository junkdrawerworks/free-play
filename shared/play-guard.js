// Keeps a swipe at the side of a phone's screen from throwing a player out of a machine.
//
// On a phone with gesture navigation (Mark's Pixel), a swipe that starts near either side of the screen is Back: a
// thumb on Tilt's flipper that rolls inward has its touch taken (the page gets pointercancel), and the Back that
// follows when it lifts left the machine. edge-guard.js (the junk drawer's module, kept here as it is) makes a Back
// like that a slip, which keeps the machine as it was.
//
// That module watches surfaces. Every machine here is drawn on a canvas that fills the window, under its cards too, so
// a deliberate swipe Back from the screen's side always starts on it, and would be taken for a slip as well. So the
// guard watches the touches a machine plays with instead: a flipper held, the ball dragged, a flick, the claw's button
// pressed. A machine hands each one to the function guardPlay() returns when it takes it, and the guard hears when it
// lifts or the browser takes it away, wherever that lands. While one is down, and for slipMs after, the page holds an
// extra step in its history for a slip to use up: a Back then keeps the machine as it was (or, a while after a finger
// simply lifted, goes on to the floor). At any other time there's no extra step, and Back (from a card, the menu,
// between rounds, or Back that closes an installed app) is just as it was. The prize counter's own step (counter.js)
// still closes it on Back.
import { guardEdges } from './edge-guard.js';

export function guardPlay({ slipMs } = {}) {
  // A copy saved as a single file may be inside someone else's page, whose history isn't its to add to.
  if ('single' in document.documentElement.dataset) return () => {};
  const play = new EventTarget(), down = new Set();
  const tell = (type, id) => play.dispatchEvent(new PointerEvent(type, { pointerId: id }));
  for (const type of ['pointerup', 'pointercancel']) {
    addEventListener(type, e => { if (down.delete(e.pointerId)) tell(type, e.pointerId); }, true);
  }
  guardEdges({ surfaces: [play], slipMs });
  return e => { if (!down.has(e.pointerId)) { down.add(e.pointerId); tell('pointerdown', e.pointerId); } };
}
