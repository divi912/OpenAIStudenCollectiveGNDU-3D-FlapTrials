import type { PlayerSnapshot } from '../../shared/protocol';

export class NameTags {
  private tags = new Map<string, HTMLDivElement>();
  constructor(private container: HTMLElement) {}

  update(players: PlayerSnapshot[], marker: (id: string) => { x: number; y: number } | undefined, localId: string) {
    const seen = new Set<string>();
    for (const player of players) {
      seen.add(player.playerId);
      let tag = this.tags.get(player.playerId);
      if (!tag) {
        tag = document.createElement('div'); tag.className = 'bird-nametag';
        tag.dataset.playerId = player.playerId;
        this.container.append(tag); this.tags.set(player.playerId, tag);
      }
      if (tag.textContent !== player.name) tag.textContent = player.name;
      tag.classList.toggle('local', player.playerId === localId);
      tag.style.setProperty('--bird-color', player.color);
      const point = marker(player.playerId);
      tag.hidden = !point;
      if (point) { tag.style.left = `${point.x}%`; tag.style.top = `${point.y}%`; }
    }
    for (const [id, tag] of this.tags) if (!seen.has(id)) { tag.remove(); this.tags.delete(id); }
  }
}
