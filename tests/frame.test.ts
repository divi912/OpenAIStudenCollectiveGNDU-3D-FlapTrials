import { expect, it } from 'vitest';
import { presentFrame } from '../client/game/frame';
import { GameScene } from '../client/game/scene';

it('routes the actual game render callback through begin, render and submission', () => {
  const calls: string[] = [];
  const game = Object.assign(Object.create(GameScene.prototype), {
    mode: 'menu', menuBirds: [], menuRoot: { rotation: { y: 0 } }, puffs: [],
    settings: { reducedMotion: true, quality: 'high' },
    engine: { beginFrame: () => { calls.push('begin'); }, endFrame: () => { calls.push('submit'); } },
    scene: { render: () => { calls.push('render'); } },
  }) as GameScene;
  game.render(1000, 1 / 60);
  expect(calls).toEqual(['begin', 'render', 'submit']);
});

it('submits each rendered frame through the Babylon lifecycle, including error cleanup', () => {
  const calls: string[] = [];
  const engine = { beginFrame: () => { calls.push('begin'); }, endFrame: () => { calls.push('submit'); } };
  presentFrame(engine, { render: () => { calls.push('render'); } });
  expect(calls).toEqual(['begin', 'render', 'submit']);
  calls.length = 0;
  expect(() => presentFrame(engine, { render: () => { throw new Error('GPU error'); } })).toThrow('GPU error');
  expect(calls).toEqual(['begin', 'submit']);
});
