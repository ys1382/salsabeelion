/**
 * Minimal Phaser stage — 4-dir walk/idle, 2× pixel scale. Reusable across projects.
 */
(function () {
  const TILE = 32;
  const COLS = 14;
  const ROWS = 10;
  const PIXEL_SCALE = 2;
  const GAME_W = TILE * COLS * PIXEL_SCALE;
  const GAME_H = TILE * ROWS * PIXEL_SCALE;
  const WALK_FRAME_RATE = 16;

  class LabScene extends Phaser.Scene {
    constructor() {
      super('LabScene');
    }

    preload() {
      PixelWalkSprite.buildGrassTexture(this, 't_grass', 0);
      PixelWalkSprite.buildGrassTexture(this, 't_grass2', 1);
      PixelWalkSprite.buildPlayerTexture(this);
    }

    create() {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const key = (row + col) % 2 === 0 ? 't_grass' : 't_grass2';
          this.add
            .image(col * TILE * PIXEL_SCALE + TILE * PIXEL_SCALE / 2, row * TILE * PIXEL_SCALE + TILE * PIXEL_SCALE / 2, key)
            .setScale(PIXEL_SCALE)
            .setDepth(0);
        }
      }

      this.player = this.physics.add.sprite(
        (COLS / 2) * TILE * PIXEL_SCALE,
        (ROWS / 2) * TILE * PIXEL_SCALE,
        'player'
      );
      this.player.setScale(PIXEL_SCALE);
      this.player.setDepth(10);
      this.player.body.setSize(13 * PIXEL_SCALE, 10 * PIXEL_SCALE);
      this.player.body.setOffset(1 * PIXEL_SCALE, 10 * PIXEL_SCALE);

      this.facing = 'down';
      this.walkFrameRate = WALK_FRAME_RATE;
      this._createWalkIdleAnims(this.walkFrameRate);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      });

      this.cameras.main.setBounds(0, 0, GAME_W, GAME_H);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

      this._wirePanel();
    }

    _createWalkIdleAnims(frameRate) {
      const dirs = ['down', 'left', 'right', 'up'];
      dirs.forEach((dir) => {
        const walkKey = `walk-${dir}`;
        const idleKey = `idle-${dir}`;
        if (this.anims.exists(walkKey)) this.anims.remove(walkKey);
        if (this.anims.exists(idleKey)) this.anims.remove(idleKey);
        this.anims.create({
          key: walkKey,
          frames: [0, 1, 2, 3].map((i) => ({ key: 'player', frame: `${dir}${i}` })),
          frameRate,
          repeat: -1,
        });
        this.anims.create({
          key: idleKey,
          frames: [0, 1, 2, 3].map((i) => ({ key: 'player', frame: `${dir}${i}` })),
          frameRate,
          repeat: -1,
        });
      });
      this.player.play(`idle-${this.facing}`, true);
    }

    _wirePanel() {
      const slider = document.getElementById('frame-rate');
      const val = document.getElementById('frame-rate-val');
      const stat = document.getElementById('anim-stat');
      if (!slider || !val || !stat) return;

      slider.value = String(this.walkFrameRate);
      val.textContent = String(this.walkFrameRate);
      slider.addEventListener('input', () => {
        this.walkFrameRate = Number(slider.value);
        val.textContent = slider.value;
        this._createWalkIdleAnims(this.walkFrameRate);
      });

      this._statEl = stat;
    }

    update(time) {
      const { cursors, wasd, player } = this;
      const speed = 105;
      let vx = 0;
      let vy = 0;

      if (cursors.left.isDown || wasd.left.isDown) {
        vx = -speed;
        this.facing = 'left';
      } else if (cursors.right.isDown || wasd.right.isDown) {
        vx = speed;
        this.facing = 'right';
      }
      if (cursors.up.isDown || wasd.up.isDown) {
        vy = -speed;
        this.facing = 'up';
      } else if (cursors.down.isDown || wasd.down.isDown) {
        vy = speed;
        this.facing = 'down';
      }

      const moving = vx !== 0 || vy !== 0;
      const buzz = Math.sin(time * 0.018) * (moving ? 18 : 6);
      player.setVelocity(vx, vy + buzz);

      player.play(moving ? `walk-${this.facing}` : `idle-${this.facing}`, true);

      if (this._statEl) {
        const anim = moving ? 'walk' : 'idle';
        const frame = player.anims.currentFrame ? player.anims.currentFrame.index : 0;
        this._statEl.textContent = `${anim} · ${this.facing} · frame ${frame} · ${this.walkFrameRate} fps`;
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: 'game',
    backgroundColor: '#5a4038',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_W,
      height: GAME_H,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: LabScene,
  });

  window.addEventListener('resize', () => game.scale.refresh());
})();
