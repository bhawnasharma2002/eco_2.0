import Phaser from 'phaser'
import mapImage from '../assets/map2.png'
import playerImage from '../assets/player.png'
import spriteAnimationImage from '../assets/sprite_animation.png'
import bootColliderShapes from './bootColliderShapes'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
    this.worldWidth = 1380
    this.worldHeight = 752
    this.playerSpeed = 220
  }

  preload() {
    this.load.image('homeMap', mapImage)
    this.load.image('playerIdle', playerImage)
    this.load.spritesheet('playerWalk', spriteAnimationImage, {
      frameWidth: 163,
      frameHeight: 265,
      endFrame: 9,
    })
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a')

    this.add.rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x0f172a)

    this.add.rectangle(480, 420, 900, 180, 0x2f4f4f)
    this.add.rectangle(180, 360, 180, 90, 0x4b5563)
    this.add.rectangle(340, 320, 150, 60, 0x64748b)
    this.add.rectangle(620, 330, 180, 80, 0x6b7280)
    this.add.rectangle(820, 350, 160, 110, 0x475569)

    this.add.circle(210, 290, 22, 0x22c55e)
    this.add.circle(760, 280, 18, 0x10b981)
    this.add.circle(860, 280, 20, 0xf59e0b)

    this.add.text(120, 120, 'Home Area', {
      fontSize: '32px',
      fill: '#e2e8f0',
      fontFamily: 'Arial',
    })

    const map = this.add.image(this.worldWidth / 2, this.worldHeight / 2, 'homeMap')
    map.setDisplaySize(this.worldWidth, this.worldHeight)

    this.createCoordinateGrid()

    this.anims.create({
      key: 'playerWalkAnim',
      frames: this.anims.generateFrameNumbers('playerWalk', { start: 0, end: 9 }),
      frameRate: 10,
      repeat: -1,
    })

    this.player = this.add.sprite(820, 360, 'playerIdle')
    this.player.setScale(0.5)
    this.player.setOrigin(0.5, 0.9)
    this.player.setDepth(10)

    this.playerIdleTexture = 'playerIdle'
    this.playerWalkTexture = 'playerWalk'

    const camera = this.cameras.main
    camera.setBounds(0, 0, this.worldWidth, this.worldHeight)
    camera.setZoom(1.5)
    const followOffsetX = 60
    const followOffsetY = 140
    camera.centerOn(this.player.x - followOffsetX, this.player.y - followOffsetY)
    camera.startFollow(this.player, true, 0.08, 0.08, followOffsetX, followOffsetY)

    // Exported editor polygons stay independent of the editor and are only used by Boot gameplay.
    this.colliders = bootColliderShapes

    this.showColliderDebug = true
    if (this.showColliderDebug) {
      const debug = this.add.graphics().setDepth(30)
      const colors = [0xff4d6d, 0xff9f1c, 0xf9c74f, 0x4cc9f0, 0x80ed99, 0xb388eb]
      this.colliders.forEach((collider, index) => {
        const color = colors[index % colors.length]
        const points = collider.type === 'polygon'
          ? collider.points
          : this.getRectanglePoints(collider)
        if (points.length < 3) return

        debug.fillStyle(color, 0.16)
        debug.lineStyle(2, color, 0.9)
        debug.beginPath()
        debug.moveTo(points[0].x, points[0].y)
        points.slice(1).forEach((point) => debug.lineTo(point.x, point.y))
        debug.closePath()
        debug.fillPath()
        debug.strokePath()
      })
    }

    this.leafPile = this.add.circle(620, 320, 40, 0xf59e0b, 0.8)
    this.leafPile.setStrokeStyle(3, 0xfbbf24, 1)
    this.leafPile.setDepth(5)

    this.interactionText = this.add.text(220, 305, 'Move with arrows. Press E near leaves.', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Arial',
    })
    this.interactionText.setDepth(10)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.gridToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G)
    this.coordinateReadout = this.add.text(12, 12, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#10202ddd',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(40)
    this.canClean = false
  }

  createCoordinateGrid() {
    const grid = this.add.graphics().setDepth(2)

    for (let x = 0; x <= this.worldWidth; x += 50) {
      const majorLine = x % 100 === 0
      grid.lineStyle(1, 0xffffff, majorLine ? 0.28 : 0.12)
      grid.beginPath()
      grid.moveTo(x, 0)
      grid.lineTo(x, this.worldHeight)
      grid.strokePath()

      if (majorLine) {
        this.add.text(x + 3, 3, String(x), {
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: '#10202d99',
        }).setDepth(3).setData('coordinateLabel', true)
      }
    }

    for (let y = 0; y <= this.worldHeight; y += 50) {
      const majorLine = y % 100 === 0
      grid.lineStyle(1, 0xffffff, majorLine ? 0.28 : 0.12)
      grid.beginPath()
      grid.moveTo(0, y)
      grid.lineTo(this.worldWidth, y)
      grid.strokePath()

      if (majorLine) {
        this.add.text(3, y + 3, String(y), {
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: '#10202d99',
        }).setDepth(3).setData('coordinateLabel', true)
      }
    }

    this.coordinateGrid = this.add.container(0, 0, [grid])
    this.coordinateGrid.setDepth(2)
    this.showCoordinateGrid = false
    this.coordinateGrid.setVisible(false)
    this.children.list
      .filter((child) => child instanceof Phaser.GameObjects.Text && child.getData('coordinateLabel'))
      .forEach((label) => label.setVisible(false))
  }

  overlapsCollider(x, y) {
    const playerHalfWidth = 16
    const playerHeight = 28
    const playerCorners = [
      { x: x - playerHalfWidth, y: y - playerHeight },
      { x: x + playerHalfWidth, y: y - playerHeight },
      { x: x + playerHalfWidth, y },
      { x: x - playerHalfWidth, y },
    ]

    return this.colliders.some((collider) => {
      if (collider.type === 'polygon') {
        return this.polygonOverlapsPlayer(collider.points, playerCorners)
      }

      const angle = Phaser.Math.DegToRad(collider.rotation ?? 0)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const halfWidth = collider.width / 2
      const halfHeight = collider.height / 2
      const colliderCorners = [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight },
      ].map((point) => ({
        x: collider.x + point.x * cos - point.y * sin,
        y: collider.y + point.x * sin + point.y * cos,
      }))
      const axes = [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: cos, y: sin },
        { x: -sin, y: cos },
      ]

      return !axes.some((axis) => {
        const playerProjection = playerCorners.map((point) => point.x * axis.x + point.y * axis.y)
        const colliderProjection = colliderCorners.map((point) => point.x * axis.x + point.y * axis.y)
        const separated =
          Math.max(...playerProjection) < Math.min(...colliderProjection) ||
          Math.max(...colliderProjection) < Math.min(...playerProjection)
        return separated
      })
    })
  }

  getRectanglePoints(collider) {
    const angle = Phaser.Math.DegToRad(collider.rotation ?? 0)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const halfWidth = collider.width / 2
    const halfHeight = collider.height / 2

    return [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ].map((point) => ({
      x: collider.x + point.x * cos - point.y * sin,
      y: collider.y + point.x * sin + point.y * cos,
    }))
  }

  polygonOverlapsPlayer(polygon, playerCorners) {
    const left = Math.min(...playerCorners.map((point) => point.x))
    const right = Math.max(...playerCorners.map((point) => point.x))
    const top = Math.min(...playerCorners.map((point) => point.y))
    const bottom = Math.max(...playerCorners.map((point) => point.y))
    const playerEdges = playerCorners.map((point, index) => [point, playerCorners[(index + 1) % playerCorners.length]])

    const playerCornerInside = playerCorners.some((point) => this.pointInPolygon(point, polygon))
    const polygonPointInside = polygon.some((point) =>
      point.x >= left && point.x <= right && point.y >= top && point.y <= bottom,
    )
    if (playerCornerInside || polygonPointInside) return true

    for (let index = 0; index < polygon.length; index++) {
      const edge = [polygon[index], polygon[(index + 1) % polygon.length]]
      if (edge[0].x === edge[1].x && edge[0].y === edge[1].y) continue
      if (playerEdges.some((playerEdge) => this.segmentsIntersect(edge[0], edge[1], playerEdge[0], playerEdge[1]))) {
        return true
      }
    }
    return false
  }

  pointInPolygon(point, polygon) {
    let inside = false
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const currentPoint = polygon[index]
      const previousPoint = polygon[previous]
      const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
        point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) + currentPoint.x
      if (crosses) inside = !inside
    }
    return inside
  }

  segmentsIntersect(a, b, c, d) {
    const orientation = (first, second, third) =>
      (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x)
    const onSegment = (first, point, last) =>
      point.x >= Math.min(first.x, last.x) && point.x <= Math.max(first.x, last.x) &&
      point.y >= Math.min(first.y, last.y) && point.y <= Math.max(first.y, last.y)

    const abC = orientation(a, b, c)
    const abD = orientation(a, b, d)
    const cdA = orientation(c, d, a)
    const cdB = orientation(c, d, b)

    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
      ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true
    return (abC === 0 && onSegment(a, c, b)) ||
      (abD === 0 && onSegment(a, d, b)) ||
      (cdA === 0 && onSegment(c, a, d)) ||
      (cdB === 0 && onSegment(c, b, d))
  }

  update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(this.gridToggleKey)) {
      this.showCoordinateGrid = !this.showCoordinateGrid
      this.coordinateGrid.setVisible(this.showCoordinateGrid)
      this.children.list
        .filter((child) => child instanceof Phaser.GameObjects.Text && child.getData('coordinateLabel'))
        .forEach((label) => label.setVisible(this.showCoordinateGrid))
    }

    const pointer = this.cameras.main.getWorldPoint(
      this.input.activePointer.x,
      this.input.activePointer.y,
    )
    this.coordinateReadout.setText(
      `Pointer: x ${Math.round(pointer.x)}, y ${Math.round(pointer.y)}  |  G: toggle grid`,
    )

    let moveX = 0
    let moveY = 0

    if (this.cursors.left.isDown || this.cursors.a?.isDown) {
      moveX -= 1
    }
    if (this.cursors.right.isDown || this.cursors.d?.isDown) {
      moveX += 1
    }
    if (this.cursors.up.isDown || this.cursors.w?.isDown) {
      moveY -= 1
    }
    if (this.cursors.down.isDown || this.cursors.s?.isDown) {
      moveY += 1
    }

    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY) || 1
      const stepX = (moveX / length) * this.playerSpeed * delta / 1000
      const stepY = (moveY / length) * this.playerSpeed * delta / 1000
      const nextX = Phaser.Math.Clamp(this.player.x + stepX, 80, this.worldWidth - 80)
      const nextY = Phaser.Math.Clamp(this.player.y + stepY, 120, this.worldHeight - 20)

      if (!this.overlapsCollider(nextX, this.player.y)) {
        this.player.x = nextX
      }
      if (!this.overlapsCollider(this.player.x, nextY)) {
        this.player.y = nextY
      }

      if (!this.player.anims.isPlaying) {
        this.player.play('playerWalkAnim')
      }
      this.player.setFlipX(moveX < 0)
    } else {
      this.player.setTexture('playerIdle')
      this.player.anims.stop()
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.leafPile.x, this.leafPile.y)
    this.canClean = distance < 80

    if (this.canClean) {
      this.interactionText.setText('Press E to clean the leaves')
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.leafPile.setFillStyle(0x22c55e, 0.7)
        this.leafPile.setStrokeStyle(3, 0x86efac, 1)
        this.interactionText.setText('Leaves cleaned!')
      }
    } else {
      this.interactionText.setText('Move with arrows. Press E near leaves.')
    }
  }
}

