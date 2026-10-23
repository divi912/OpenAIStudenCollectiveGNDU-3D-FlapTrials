import type { ConnectionProgress } from './network/connection';

export class LoadingFeedback {
  private root = document.createElement('section');
  private title = document.createElement('h2');
  private detail = document.createElement('p');
  private count = document.createElement('span');
  private cancel = document.createElement('button');
  constructor(parent: HTMLElement, cancel: () => void) {
    this.root.id = 'loading-feedback'; this.root.hidden = true;
    this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite');
    const card = document.createElement('div'); card.className = 'loading-card';
    const spinner = document.createElement('span'); spinner.className = 'loading-spinner'; spinner.setAttribute('aria-hidden', 'true');
    this.cancel.className = 'button secondary'; this.cancel.textContent = 'Cancel connection'; this.cancel.onclick = cancel;
    card.append(spinner, this.title, this.detail, this.count, this.cancel); this.root.append(card); parent.append(this.root);
  }
  connection(state?: ConnectionProgress) {
    if (!state) { if (this.root.dataset.kind !== 'race') this.hide(); return; }
    this.show(state.kind, state.title, state.detail, state.kind === 'connecting');
  }
  race(loaded: number, total: number, remaining: number, sceneReady: boolean) {
    this.show('race', sceneReady ? 'Waiting for the flock…' : 'Loading birds and stadium…', sceneReady ? 'Everyone starts together once their course is ready.' : 'Preparing the 3D world. Please keep this tab open.', false);
    const count = `${loaded} / ${total} players ready · ${Math.max(0, Math.ceil(remaining))}s loading window`;
    if (this.count.textContent !== count) this.count.textContent = count;
  }
  hide() { this.root.hidden = true; this.root.dataset.kind = ''; }
  private show(kind: string, title: string, detail: string, cancel: boolean) {
    if (this.root.dataset.kind !== kind) this.count.textContent = '';
    this.root.hidden = false; this.root.dataset.kind = kind;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.detail.textContent !== detail) this.detail.textContent = detail;
    this.cancel.hidden = !cancel;
  }
}
