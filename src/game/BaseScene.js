import Phaser from 'phaser'
import mapImage from '../assets/map2.png'


export default class BaseScene extends Phaser.Scene {
  constructor(key) {
    super(key)

    this.worldWidth = 1380
    this.worldHeight = 752
    this.groundY = 560
  }

  preload() {
    this.load.image('homeMap', mapImage)
  }

  createMap() {
    this.cameras.main.setBackgroundColor('#101827')
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight)

    this.map = this.add.image(this.worldWidth / 2, this.worldHeight / 2, 'homeMap')
    this.map.setDisplaySize(this.worldWidth, this.worldHeight)
  }
}
