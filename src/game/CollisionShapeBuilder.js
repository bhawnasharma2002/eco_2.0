import Phaser from 'phaser'

function copyShapes(shapes) {
  return shapes.map((shape) => ({
    ...shape,
    ...(shape.points ? { points: shape.points.map((point) => ({ ...point })) } : {}),
  }))
}

export function validateShapeDocument(document) {
  if (!document || !Array.isArray(document.shapes)) {
    throw new Error('JSON must contain a "shapes" array.')
  }

  const ids = new Set()
  return document.shapes.map((shape, index) => {
    if (!shape || !['rectangle', 'circle', 'polygon'].includes(shape.type)) {
      throw new Error(`Shape ${index + 1} has an unsupported type.`)
    }

    const id = typeof shape.id === 'string' && shape.id.trim()
      ? shape.id.trim()
      : `collider_${index + 1}`
    if (ids.has(id)) throw new Error(`Duplicate shape id: ${id}`)
    ids.add(id)

    if (shape.type === 'rectangle') {
      if (![shape.x, shape.y, shape.width, shape.height].every(Number.isFinite) || shape.width <= 0 || shape.height <= 0) {
        throw new Error(`Rectangle ${id} needs finite center coordinates and positive width/height.`)
      }
      return {
        id,
        type: 'rectangle',
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        rotation: Number.isFinite(shape.rotation) ? shape.rotation : 0,
      }
    }

    if (shape.type === 'circle') {
      if (![shape.x, shape.y, shape.radius].every(Number.isFinite) || shape.radius <= 0) {
        throw new Error(`Circle ${id} needs finite center coordinates and a positive radius.`)
      }
      return { id, type: 'circle', x: shape.x, y: shape.y, radius: shape.radius }
    }

    if (!Array.isArray(shape.points) || shape.points.length < 3 || shape.points.length > 500) {
      throw new Error(`Polygon ${id} needs between 3 and 500 vertices.`)
    }
    const points = shape.points.map((point, pointIndex) => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new Error(`Polygon ${id}, vertex ${pointIndex + 1} needs finite x/y coordinates.`)
      }
      return { x: point.x, y: point.y }
    })
    return { id, type: 'polygon', points }
  })
}

export default class CollisionShapeBuilder {
  constructor(scene, initialShapes = [], onChange = () => {}) {
    this.scene = scene
    this.shapes = copyShapes(initialShapes)
    this.onChange = onChange
    this.tool = 'select'
    this.selectedId = null
    this.drawing = null
    this.drag = null
    this.nextId = this.shapes.length + 1
    this.graphics = scene.add.graphics().setDepth(20)

    this.handlePointerDown = this.pointerDown.bind(this)
    this.handlePointerMove = this.pointerMove.bind(this)
    this.handlePointerUp = this.pointerUp.bind(this)
    this.handleEnter = () => this.finishPolygon()
    this.handleEscape = () => this.cancelDrawing()
    this.handleDelete = () => this.deleteSelected()

    scene.input.on('pointerdown', this.handlePointerDown)
    scene.input.on('pointermove', this.handlePointerMove)
    scene.input.on('pointerup', this.handlePointerUp)
    scene.input.keyboard.on('keydown-ENTER', this.handleEnter)
    scene.input.keyboard.on('keydown-ESC', this.handleEscape)
    scene.input.keyboard.on('keydown-DELETE', this.handleDelete)
    scene.input.keyboard.on('keydown-BACKSPACE', this.handleDelete)
    scene.events.once('shutdown', this.destroy, this)

    this.redraw()
    this.notify()
  }

  worldPoint(pointer) {
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y)
  }

  isInsideMap(point) {
    return point.x >= 0 && point.x <= this.scene.worldWidth &&
      point.y >= 0 && point.y <= this.scene.worldHeight
  }

  clampToMap(point) {
    return {
      x: Phaser.Math.Clamp(point.x, 0, this.scene.worldWidth),
      y: Phaser.Math.Clamp(point.y, 0, this.scene.worldHeight),
    }
  }

  setTool(tool) {
    if (!['select', 'rectangle', 'circle', 'polygon'].includes(tool)) return
    this.cancelDrawing(false)
    this.tool = tool
    this.drag = null
    this.redraw()
    this.notify()
  }

  getState() {
    let preview = null
    if (this.drawing?.type === 'rectangle' && this.drawing.current) {
      preview = {
        type: 'rectangle',
        x: (this.drawing.start.x + this.drawing.current.x) / 2,
        y: (this.drawing.start.y + this.drawing.current.y) / 2,
        width: Math.abs(this.drawing.current.x - this.drawing.start.x),
        height: Math.abs(this.drawing.current.y - this.drawing.start.y),
        rotation: 0,
      }
    } else if (this.drawing?.type === 'circle' && this.drawing.current) {
      preview = {
        type: 'circle',
        x: this.drawing.start.x,
        y: this.drawing.start.y,
        radius: Phaser.Math.Distance.Between(
          this.drawing.start.x,
          this.drawing.start.y,
          this.drawing.current.x,
          this.drawing.current.y,
        ),
      }
    } else if (this.drawing?.type === 'polygon') {
      preview = { type: 'polygon', points: copyShapes([{ points: this.drawing.points }])[0].points }
    }

    return {
      tool: this.tool,
      selectedId: this.selectedId,
      drawingType: this.drawing?.type ?? null,
      drawingPointCount: this.drawing?.points?.length ?? 0,
      preview,
      shapes: copyShapes(this.shapes),
    }
  }

  notify() {
    const state = this.getState()
    this.onChange(state.shapes)
    this.scene.game.events.emit('collider-editor:state', state)
  }

  createId() {
    let id
    do {
      id = `collider_${this.nextId++}`
    } while (this.shapes.some((shape) => shape.id === id))
    return id
  }

  getSelected() {
    return this.shapes.find((shape) => shape.id === this.selectedId) ?? null
  }

  pointerDown(pointer) {
    if (pointer.button !== 0) return
    const point = this.worldPoint(pointer)
    if (!this.isInsideMap(point)) return

    if (this.tool === 'polygon') {
      if (!this.drawing || this.drawing.type !== 'polygon') {
        this.drawing = { type: 'polygon', points: [] }
      }
      this.drawing.points.push({ x: point.x, y: point.y })
      this.redraw(point)
      this.notify()
      return
    }

    if (this.tool === 'rectangle' || this.tool === 'circle') {
      this.drawing = this.tool === 'rectangle'
        ? { type: 'rectangle', start: point, current: point }
        : { type: 'circle', start: point, current: point }
      this.redraw()
      return
    }

    const selected = this.getSelected()
    const handle = selected ? this.hitHandle(selected, point) : null
    if (handle) {
      this.drag = { mode: handle.mode, index: handle.index, shapeId: selected.id }
      if (handle.mode === 'rotate') {
        const pointerAngle = Math.atan2(point.y - selected.y, point.x - selected.x)
        this.drag.rotationOffset = Phaser.Math.DegToRad(selected.rotation ?? 0) - pointerAngle - Math.PI / 2
      }
      return
    }

    const shape = [...this.shapes].reverse().find((candidate) => this.contains(candidate, point))
    this.selectedId = shape?.id ?? null
    if (shape) {
      this.drag = {
        mode: 'move',
        shapeId: shape.id,
        start: point,
        original: copyShapes([shape])[0],
      }
    } else {
      this.drag = null
    }
    this.redraw()
    this.notify()
  }

  pointerMove(pointer) {
    const point = this.worldPoint(pointer)
    if (this.drawing) {
      const boundedPoint = this.clampToMap(point)
      if (this.drawing.type !== 'polygon') this.drawing.current = boundedPoint
      this.redraw(boundedPoint)
      this.notify()
      return
    }
    if (!this.drag) return

    const shape = this.shapes.find((item) => item.id === this.drag.shapeId)
    if (!shape) return

    if (this.drag.mode === 'move') {
      const dx = point.x - this.drag.start.x
      const dy = point.y - this.drag.start.y
      const original = this.drag.original
      if (shape.type === 'polygon') {
        shape.points = original.points.map((vertex) => ({ x: vertex.x + dx, y: vertex.y + dy }))
      } else {
        shape.x = original.x + dx
        shape.y = original.y + dy
      }
    } else if (this.drag.mode === 'resize' && shape.type === 'rectangle') {
      const local = this.toLocal(shape, point)
      shape.width = Math.max(8, Math.abs(local.x) * 2)
      shape.height = Math.max(8, Math.abs(local.y) * 2)
    } else if (this.drag.mode === 'radius' && shape.type === 'circle') {
      shape.radius = Math.max(4, Phaser.Math.Distance.Between(shape.x, shape.y, point.x, point.y))
    } else if (this.drag.mode === 'rotate' && shape.type === 'rectangle') {
      const pointerAngle = Math.atan2(point.y - shape.y, point.x - shape.x)
      shape.rotation = Phaser.Math.RadToDeg(pointerAngle + Math.PI / 2 + this.drag.rotationOffset)
    } else if (this.drag.mode === 'vertex' && shape.type === 'polygon') {
      shape.points[this.drag.index] = { x: point.x, y: point.y }
    }

    this.redraw()
    this.notify()
  }

  pointerUp(pointer) {
    if (this.drawing && this.drawing.type !== 'polygon') {
      if (pointer) this.drawing.current = this.clampToMap(this.worldPoint(pointer))
      const drawing = this.drawing
      const dx = drawing.current.x - drawing.start.x
      const dy = drawing.current.y - drawing.start.y
      if (drawing.type === 'rectangle' && Math.abs(dx) >= 4 && Math.abs(dy) >= 4) {
        this.shapes.push({
          id: this.createId(),
          type: 'rectangle',
          x: (drawing.start.x + drawing.current.x) / 2,
          y: (drawing.start.y + drawing.current.y) / 2,
          width: Math.abs(dx),
          height: Math.abs(dy),
          rotation: 0,
        })
      } else if (drawing.type === 'circle') {
        const radius = Phaser.Math.Distance.Between(drawing.start.x, drawing.start.y, drawing.current.x, drawing.current.y)
        if (radius >= 4) {
          this.shapes.push({ id: this.createId(), type: 'circle', x: drawing.start.x, y: drawing.start.y, radius })
        }
      }
      this.selectedId = this.shapes.at(-1)?.id ?? null
      this.drawing = null
      this.redraw()
      this.notify()
    }
    this.drag = null
  }

  finishPolygon() {
    if (this.drawing?.type !== 'polygon') return
    if (this.drawing.points.length < 3) {
      this.scene.game.events.emit('collider-editor:error', 'A polygon needs at least 3 vertices.')
      return
    }
    this.shapes.push({ id: this.createId(), type: 'polygon', points: this.drawing.points })
    this.selectedId = this.shapes.at(-1).id
    this.drawing = null
    this.redraw()
    this.notify()
  }

  cancelDrawing(emit = true) {
    if (!this.drawing) return
    this.drawing = null
    this.redraw()
    if (emit) this.notify()
  }

  deleteSelected() {
    if (!this.selectedId) return
    this.shapes = this.shapes.filter((shape) => shape.id !== this.selectedId)
    this.selectedId = null
    this.redraw()
    this.notify()
  }

  clearAll() {
    this.shapes = []
    this.selectedId = null
    this.drawing = null
    this.redraw()
    this.notify()
  }

  replaceShapes(shapes) {
    this.shapes = copyShapes(shapes)
    this.selectedId = null
    this.drawing = null
    this.nextId = this.shapes.length + 1
    this.redraw()
    this.notify()
  }

  handleFor(shape) {
    if (shape.type === 'rectangle') {
      const angle = Phaser.Math.DegToRad(shape.rotation ?? 0)
      const corners = [
        { x: -shape.width / 2, y: -shape.height / 2 },
        { x: shape.width / 2, y: -shape.height / 2 },
        { x: shape.width / 2, y: shape.height / 2 },
        { x: -shape.width / 2, y: shape.height / 2 },
      ].map((point) => this.toWorld(shape, point, angle))
      const rotate = this.toWorld(shape, { x: 0, y: -shape.height / 2 - 28 }, angle)
      return [...corners.map((point, index) => ({ ...point, mode: 'resize', index })), { ...rotate, mode: 'rotate' }]
    }
    if (shape.type === 'circle') return [{ x: shape.x + shape.radius, y: shape.y, mode: 'radius' }]
    if (shape.type === 'polygon') return shape.points.map((point, index) => ({ ...point, mode: 'vertex', index }))
    return []
  }

  hitHandle(shape, point) {
    return this.handleFor(shape).find((handle) =>
      Phaser.Math.Distance.Between(handle.x, handle.y, point.x, point.y) < 12,
    ) ?? null
  }

  toWorld(shape, point, angle = Phaser.Math.DegToRad(shape.rotation ?? 0)) {
    return {
      x: shape.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
      y: shape.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
    }
  }

  toLocal(shape, point) {
    const dx = point.x - shape.x
    const dy = point.y - shape.y
    const angle = Phaser.Math.DegToRad(shape.rotation ?? 0)
    return {
      x: dx * Math.cos(angle) + dy * Math.sin(angle),
      y: -dx * Math.sin(angle) + dy * Math.cos(angle),
    }
  }

  contains(shape, point) {
    if (shape.type === 'circle') {
      return Phaser.Math.Distance.Between(shape.x, shape.y, point.x, point.y) <= shape.radius
    }
    if (shape.type === 'rectangle') {
      const local = this.toLocal(shape, point)
      return Math.abs(local.x) <= shape.width / 2 && Math.abs(local.y) <= shape.height / 2
    }
    let inside = false
    for (let i = 0, j = shape.points.length - 1; i < shape.points.length; j = i++) {
      const a = shape.points[i]
      const b = shape.points[j]
      const crosses = (a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      if (crosses) inside = !inside
    }
    return inside
  }

  redraw(pointerPoint = null) {
    const graphics = this.graphics
    graphics.clear()

    this.shapes.forEach((shape) => {
      const selected = shape.id === this.selectedId
      const color = selected ? 0xffd166 : shape.type === 'circle' ? 0x38d9a9 : shape.type === 'polygon' ? 0xff6b6b : 0x54a0ff
      graphics.fillStyle(color, selected ? 0.27 : 0.19)
      graphics.lineStyle(selected ? 3 : 2, color, 0.95)

      if (shape.type === 'circle') {
        graphics.fillCircle(shape.x, shape.y, shape.radius)
        graphics.strokeCircle(shape.x, shape.y, shape.radius)
      } else {
        const points = shape.type === 'rectangle'
          ? [
              { x: -shape.width / 2, y: -shape.height / 2 },
              { x: shape.width / 2, y: -shape.height / 2 },
              { x: shape.width / 2, y: shape.height / 2 },
              { x: -shape.width / 2, y: shape.height / 2 },
            ].map((point) => this.toWorld(shape, point))
          : shape.points
        this.drawPolygon(graphics, points)
      }

      if (selected) this.drawHandles(graphics, shape)
    })

    if (this.drawing) {
      graphics.lineStyle(2, 0xffd166, 0.9)
      graphics.fillStyle(0xffd166, 0.18)
      if (this.drawing.type === 'rectangle' && this.drawing.current) {
        const left = Math.min(this.drawing.start.x, this.drawing.current.x)
        const top = Math.min(this.drawing.start.y, this.drawing.current.y)
        const width = Math.abs(this.drawing.current.x - this.drawing.start.x)
        const height = Math.abs(this.drawing.current.y - this.drawing.start.y)
        graphics.fillRect(left, top, width, height)
        graphics.strokeRect(left, top, width, height)
      } else if (this.drawing.type === 'circle' && this.drawing.current) {
        const radius = Phaser.Math.Distance.Between(this.drawing.start.x, this.drawing.start.y, this.drawing.current.x, this.drawing.current.y)
        graphics.fillCircle(this.drawing.start.x, this.drawing.start.y, radius)
        graphics.strokeCircle(this.drawing.start.x, this.drawing.start.y, radius)
      } else if (this.drawing.type === 'polygon') {
        const previewPoints = [...this.drawing.points]
        if (pointerPoint) previewPoints.push(pointerPoint)
        previewPoints.forEach((point, index) => {
          graphics.fillStyle(0xffd166, 1)
          graphics.fillCircle(point.x, point.y, index < this.drawing.points.length ? 4 : 3)
          if (index > 0) {
            const previous = previewPoints[index - 1]
            graphics.lineStyle(2, 0xffd166, 0.9)
            graphics.lineBetween(previous.x, previous.y, point.x, point.y)
          }
        })
      }
    }
  }

  drawPolygon(graphics, points) {
    if (points.length < 3) return
    graphics.beginPath()
    graphics.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y))
    graphics.closePath()
    graphics.fillPath()
    graphics.strokePath()
  }

  drawHandles(graphics, shape) {
    const handles = this.handleFor(shape)
    handles.forEach((handle) => {
      if (handle.mode === 'rotate') {
        const top = this.toWorld(shape, { x: 0, y: -shape.height / 2 })
        graphics.lineStyle(1, 0xffffff, 0.9)
        graphics.lineBetween(top.x, top.y, handle.x, handle.y)
      }
      graphics.fillStyle(handle.mode === 'rotate' ? 0xff8fab : 0xffffff, 1)
      graphics.lineStyle(2, 0x172033, 1)
      graphics.fillCircle(handle.x, handle.y, handle.mode === 'rotate' ? 6 : 5)
      graphics.strokeCircle(handle.x, handle.y, handle.mode === 'rotate' ? 6 : 5)
    })
  }

  destroy() {
    this.scene.input.off('pointerdown', this.handlePointerDown)
    this.scene.input.off('pointermove', this.handlePointerMove)
    this.scene.input.off('pointerup', this.handlePointerUp)
    this.scene.input.keyboard.off('keydown-ENTER', this.handleEnter)
    this.scene.input.keyboard.off('keydown-ESC', this.handleEscape)
    this.scene.input.keyboard.off('keydown-DELETE', this.handleDelete)
    this.scene.input.keyboard.off('keydown-BACKSPACE', this.handleDelete)
  }
}
