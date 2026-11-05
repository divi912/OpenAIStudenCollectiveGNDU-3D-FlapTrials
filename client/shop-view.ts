import { ITEMS, SHOP, purchaseCount, purchaseProblem, hasItem } from '../shared/shop';
import type { RacerState } from '../shared/protocol';
import { escapeHtml } from './ui';

const drawings: Record<string, string> = {
  cell: '<rect x="12" y="8" width="24" height="32" rx="6"/><path d="M20 4h8m-3 12-8 10h8l-2 8 9-12h-8z"/>',
  guard: '<path d="M24 4 7 11v13c0 10 17 20 17 20s17-10 17-20V11z"/><path d="m15 24 6 6 13-14"/>',
  capacitor: '<path d="M14 8v32M34 8v32M4 24h10m20 0h10M24 7v9m0 16v9"/><path d="m25 18-5 8h8l-5 7"/>',
  jammer: '<circle cx="24" cy="27" r="5"/><path d="M24 32v11M13 16a15 15 0 0 0 0 22m22-22a15 15 0 0 1 0 22M6 9a25 25 0 0 0 0 36m36-36a25 25 0 0 1 0 36"/>',
  overdrive: '<path d="M7 37a20 20 0 1 1 34 0M24 27l12-13M12 16l3 3m18 14 3 3M8 27h5m11-20v6"/><circle cx="24" cy="27" r="4"/>',
};
export function itemGlyph(glyph: string): string {
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[glyph]}</svg>`;
}
export function shopTemplate(s: RacerState, halfway: boolean, solo: boolean, readyCount: number, total: number): string {
  return `<div class="modal-backdrop shop-backdrop"><section class="shop-screen" role="dialog" aria-modal="true" aria-labelledby="shop-title">
    <header class="shop-header"><div><span class="shop-round">${halfway ? 'HALFWAY' : 'BEFORE THE RACE'}</span><h1 id="shop-title">Flap Shop</h1></div>
      <div class="shop-wallet"><strong>${s.flapPoints}</strong><span>Flap Points</span></div><strong id="shop-timer" class="shop-timer" aria-label="Buy time remaining"></strong></header>
    <div class="shop-status"><span>${purchaseCount(s.boughtMask)} / ${SHOP.purchaseLimit} purchases</span><span>${halfway ? 'Race paused' : 'Save points for halfway'}</span></div>
    <div class="shop-items">${ITEMS.map(item => {
      const problem = purchaseProblem(s, item.id, solo);
      return `<button class="shop-item ${item.kind === 'Risk' ? 'shop-risk' : ''}" data-action="buy-item" data-item="${item.id}" ${problem ? 'disabled' : ''} aria-label="Buy ${item.name} for ${item.price} Flap Points">
        <span class="shop-item-art">${itemGlyph(item.glyph)}</span><span class="shop-item-kind">${item.kind}</span><strong>${item.name}</strong><span class="shop-item-detail">${item.detail}</span><span class="shop-item-price">${item.price} FP${problem ? `<small>${problem}</small>` : ''}</span>
      </button>`;
    }).join('')}</div>
    <footer class="shop-footer"><span>${solo ? 'Practice' : `${readyCount} / ${total} ready`}</span><button class="shop-done" data-action="shop-done" ${s.shopReady ? 'disabled' : ''}>${s.shopReady ? 'Waiting for players…' : halfway ? 'Ready to resume' : 'Ready to race'} <span aria-hidden="true">→</span></button></footer>
  </section></div>`;
}
export function loadoutText(s: RacerState): string {
  return [s.guardCharges ? 'Guard' : '', hasItem(s, 'capacitor') ? 'Capacitor' : '', s.jammerCharges ? 'Jammer armed' : '', hasItem(s, 'overdrive') ? 'Overdrive' : ''].filter(Boolean).map(escapeHtml).join(' · ');
}
