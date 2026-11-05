import './guide.css';
import { COURSES } from '../shared/courses';
import { BOOST } from '../shared/physics';
import { SHOP, ITEMS } from '../shared/shop';

document.querySelector('#course-list')!.innerHTML = ['easy', 'medium', 'hard'].map(tier => `<div><h3>${tier[0].toUpperCase() + tier.slice(1)}</h3><ol>${COURSES.filter(c => c.difficultyGroup === tier).map(c => `<li>${c.name}</li>`).join('')}</ol></div>`).join('');
document.querySelector('#boost-rules')!.innerHTML = [
  ['Starting reserve', `${BOOST.initial}%`],
  ['Using boost', `Spends ${BOOST.drainPerSecond}% per second. A new burst needs ${BOOST.activationMinimum}%; a full tank lasts ${BOOST.capacity / BOOST.drainPerSecond} seconds.`],
  ['Recharge', `${BOOST.regenPerSecond}% per second during normal flight, after a ${BOOST.regenDelayTicks / 60}-second delay.`],
  ['Clean gate', `+${BOOST.gateReward}% once per gate. Repeating a gate after a crash does not refill it again.`],
  ['Gold pickup', `+${BOOST.pickupReward}% reserve.`],
  ['Crash', `−${BOOST.crashCost}% reserve. Respawning does not refill it.`],
].map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join('');
document.querySelector('#shop-rules')!.innerHTML = [
  `Start with ${SHOP.startingPoints} Flap Points (FP). The first shop lasts up to ${SHOP.startSeconds} seconds, before the course preview and countdown.`,
  `Buy up to ${SHOP.purchaseLimit} different items per shop, or save your points.`,
  `When the first racer reaches halfway, everyone pauses and receives ${SHOP.halfwayPoints} more FP. The second shop lasts up to ${SHOP.halfwaySeconds} seconds.`,
  'Positions, time gaps and effect timers stay intact during the shared pause.',
  'Select Ready to race or Ready to resume when finished. The shop closes when everyone is ready or the timer ends.',
].map(rule => `<li>${rule}</li>`).join('');
document.querySelector('#item-list')!.innerHTML = ITEMS.map(item => `<tr><th>${item.name}</th><td class="price">${item.price} FP</td><td>${item.detail}${item.id === 'guard' ? ' Includes 1 second of protection after the hit. Course boundaries still cause crashes.' : item.id === 'overdrive' ? ' The overall speed cap still applies.' : ''}</td></tr>`).join('');
