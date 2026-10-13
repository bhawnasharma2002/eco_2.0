import Phaser from 'phaser'
import leafImage from '../assets/leaf.png'
import BaseScene from './BaseScene'

export default class StormScene extends BaseScene {
  constructor() {
    super('StormScene')
    this.leaves = []
    this.windBands = []
    this.maxDuration = 20000
    this.windDuration = 10000
    this.startTime = 0
    this.showLandingMarkers = false
    this.zones = [
      {
        name: 'yard',
        xMin: 180,
        xMax: 980,
        yMin: 80,
        yMax: 280,
        settleMinX: 180,
        settleMaxX: 980,
        settleMinY: 330,
        settleMaxY: 560,
      },
      {
        name: 'outerArea',
        xMin: 20,
        xMax: 180,
        yMin: 120,
        yMax: 560,
        settleMinX: 20,
        settleMaxX: 180,
        settleMinY: 260,
        settleMaxY: 520,
      },
      {
        name: 'road',
        xMin: 980,
        xMax: 1360,
        yMin: 300,
        yMax: 620,
        settleMinX: 980,
        settleMaxX: 1360,
        settleMinY: 500,
        settleMaxY: 640,
      },
    ]
  }

  preload() {
    super.preload()
    this.load.image('leaf', leafImage)
  }

  create() {
    this.createMap()
    this.createWind()

    // These black circles are landing points, not leaf spawn points.
    // We will use these positions as the final grounded spots where leaves rest.
    this.landingMarkers = [
      { x: 260, y: 200, spread: 18, label: 1 ,leafCount: 40},
      { x: 550, y: 150, spread: 52, label: 2 ,leafCount: 60},
      { x: 700, y: 375, spread: 28, label: 3 ,leafCount: 60},
      { x: 600, y: 375, spread: 26, label: 4 ,leafCount: 60},
      { x: 650, y: 375, spread: 60, label: 5 ,leafCount: 60},
      { x: 845, y: 375, spread: 70, label: 6 ,leafCount: 60},
      { x: 845, y: 465, spread: 46, label: 7 ,leafCount: 30},
      { x: 650, y: 465, spread: 18, label: 8 ,leafCount: 60},
      { x: 700, y: 475, spread: 24, label: 9 ,leafCount: 60},
      { x: 600, y: 475, spread: 48, label: 10 ,leafCount: 60},
      { x: 400, y: 375, spread: 48, label: 11 ,leafCount: 60},
      { x: 420, y: 475, spread: 48, label: 12 ,leafCount: 60},
      { x: 1080, y: 300, spread: 46, label: 13 ,leafCount: 60},
      { x: 200, y: 640, spread: 22, label: 14 ,leafCount: 60},
      { x: 260, y: 640, spread: 20, label: 15 ,leafCount: 60},
      { x: 360, y: 640, spread: 24, label: 16 ,leafCount: 60}
    ]

    if (this.showLandingMarkers) {
      this.landingMarkers.forEach((marker) => {
        const circle = this.add.circle(marker.x, marker.y, 8, 0x000000)
        circle.setStrokeStyle(2, 0x000000)
        circle.setDepth(20)

        const label = this.add.text(marker.x + 12, marker.y - 10, String(marker.label), {
          fontSize: '12px',
          color: 'white',
          fontFamily: 'Arial',
        })
        label.setDepth(21)
      })
    }

    this.add.text(200, 80, 'A storm is blowing through the home yard...', {
      fontSize: '28px',
      fill: '#e5e7eb',
      fontFamily: 'Arial',
    })

    this.add.text(260, 120, 'Leaves are falling everywhere...', {
      fontSize: '22px',
      fill: '#d1d5db',
      fontFamily: 'Arial',
    })

    this.startTime = this.time.now
    this.createLeaves()
  }

  createWind() {
    // Short, light streaks make the wind read as moving air rather than map-wide lines.
    for (let i = 0; i < 12; i++) {
      const band = {
        x: Phaser.Math.Between(0, this.worldWidth),
        y: Phaser.Math.Between(40, this.worldHeight - 40),
        length: Phaser.Math.Between(120, 220),
        speed: Phaser.Math.Between(520, 700),
        alpha: Phaser.Math.FloatBetween(0.5, 0.65),
        width: 2,
        graphics: this.add.graphics(),
      }

      band.graphics.setDepth(7)
      this.windBands.push(band)
      this.drawWindBand(band)
    }
  }

  drawWindBand(band) {
    const g = band.graphics
    g.clear()
    g.lineStyle(band.width, 0xffffff, band.alpha)
    g.beginPath()
    g.moveTo(band.x, band.y)
    g.lineTo(band.x - band.length * 0.45, band.y - 4)
    g.lineTo(band.x - band.length, band.y + 3)
    g.strokePath()
  }

  createLeaves() {
    const remainingLeaves = this.landingMarkers.map((marker) => marker.leafCount ?? 60)
    this.leafSpawnQueue = []
    while (remainingLeaves.some((count) => count > 0)) {
      remainingLeaves.forEach((count, index) => {
        if (count > 0) {
          this.leafSpawnQueue.push(this.landingMarkers[index])
          remainingLeaves[index] -= 1
        }
      })
    }

    this.spawnLeavesBatch()
    this.leafSpawnTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.spawnLeavesBatch()
        if (this.leafSpawnQueue.length === 0) {
          this.leafSpawnTimer.remove(false)
        }
      },
    })
  }

  spawnLeavesBatch() {
    for (let i = 0; i < 20 && this.leafSpawnQueue.length > 0; i++) {
      const marker = this.leafSpawnQueue.shift()
      const leaf = this.add.image(
        this.worldWidth - 20 + Phaser.Math.FloatBetween(0, 120),
        Phaser.Math.FloatBetween(0, Math.min(120, marker.y - 30)),
        'leaf',
      )

      leaf.setScale(0.09 + Math.random() * 0.1)
      leaf.setRotation(Math.random() * Math.PI * 2)
      leaf.setAlpha(0.75 + Math.random() * 0.25)
      leaf.setDepth(8)

      this.leaves.push({
        sprite: leaf,
        settleX: marker.x + Phaser.Math.FloatBetween(-marker.spread, marker.spread),
        settleY: marker.y + Phaser.Math.FloatBetween(-marker.spread, marker.spread),
        speedX: Phaser.Math.FloatBetween(-220, -120),
        speedY: Phaser.Math.FloatBetween(30, 80),
        rotationSpeed: Phaser.Math.FloatBetween(-0.12, 0.12),
        phase: Math.random() * Math.PI * 2,
        settled: false,
      })
    }
  }

  update(time, delta) {
    const elapsed = this.time.now - this.startTime
    const frameScale = delta / 1000

    if (elapsed < this.windDuration) {
      for (const band of this.windBands) {
        band.x -= band.speed * frameScale
        if (band.x < -band.length) {
          band.x = this.worldWidth + Phaser.Math.Between(40, 240)
          band.y = Phaser.Math.Between(40, this.worldHeight - 40)
        }
        this.drawWindBand(band)
      }
    } else {
      for (const band of this.windBands) {
        band.alpha = 0
        this.drawWindBand(band)
      }
    }

    for (let index = this.leaves.length - 1; index >= 0; index--) {
      const item = this.leaves[index]

      if (item.settled) {
        item.sprite.x = item.settleX
        item.sprite.y = item.settleY
        continue
      }

      const gust = Math.sin(this.time.now * 0.0035 + item.phase) * 20
      const windPush = elapsed < this.windDuration ? 70 : 0

      item.sprite.x += (item.speedX + windPush + gust) * frameScale
      item.sprite.y += item.speedY * frameScale
      item.sprite.rotation += item.rotationSpeed * frameScale

      if (item.sprite.y >= item.settleY && item.sprite.x <= item.settleX) {
        item.settled = true
        item.sprite.x = item.settleX
        item.sprite.y = item.settleY
        item.speedY = 0
      }

      if (!item.settled && item.sprite.x < -item.sprite.displayWidth) {
        item.sprite.destroy()
        this.leaves.splice(index, 1)
        continue
      }

      item.sprite.y = Phaser.Math.Clamp(item.sprite.y, -30, this.worldHeight)
    }
  }
}