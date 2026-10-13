import BaseScene from './BaseScene'
import CollisionShapeBuilder from './CollisionShapeBuilder'

export default class ColliderEditorScene extends BaseScene {
  constructor() {
    super('ColliderEditorScene')
    this.editorShapes = []
  }

  preload() {
    super.preload()
  }

  create() {
    this.createMap()
    const camera = this.cameras.main
    camera.stopFollow()
    camera.removeBounds()
    this.fitMapToViewport()
    this.scale.on('resize', this.fitMapToViewport, this)

    this.builder = new CollisionShapeBuilder(this, this.editorShapes, (shapes) => {
      this.editorShapes = shapes
    })
  }

  fitMapToViewport() {
    const camera = this.cameras.main
    camera.setZoom(Math.min(camera.width / this.worldWidth, camera.height / this.worldHeight))
    camera.centerOn(this.worldWidth / 2, this.worldHeight / 2)
  }
}
