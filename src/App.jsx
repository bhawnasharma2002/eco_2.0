import { useEffect, useRef, useState } from 'react'
import BootScene from './game/BootScene'
import StormScene from './game/StormScene'
import ColliderEditorScene from './game/ColliderEditorScene'
import { validateShapeDocument } from './game/CollisionShapeBuilder'
import Phaser from 'phaser'
import './App.css'

function App() {
  const gameRef = useRef(null)
  const loadFileRef = useRef(null)
  const [activeScene, setActiveScene] = useState('BootScene')
  const [editorPanelOpen, setEditorPanelOpen] = useState(true)
  const [editorState, setEditorState] = useState({ tool: 'select', selectedId: null, shapes: [] })
  const [editorMessage, setEditorMessage] = useState('')
  const [exportText, setExportText] = useState('')

  useEffect(() => {
    if (gameRef.current) return

    const config = {
      type: Phaser.AUTO,
      width: 1200,
      height: 660,
      parent: 'game-container',
      scale: {
        mode: Phaser.Scale.RESIZE,
      },
      backgroundColor: '#111827',
      scene: [BootScene, StormScene, ColliderEditorScene],
    }

    const game = new Phaser.Game(config)
    gameRef.current = game
    const handleEditorState = (state) => setEditorState(state)
    const handleEditorError = (message) => setEditorMessage(message)
    game.events.on('collider-editor:state', handleEditorState)
    game.events.on('collider-editor:error', handleEditorError)

    return () => {
      game.events.off('collider-editor:state', handleEditorState)
      game.events.off('collider-editor:error', handleEditorError)
      game.destroy(true)
      gameRef.current = null
    }
  }, [])

  const switchScene = (sceneKey) => {
    if (!gameRef.current) return
    gameRef.current.scene.start(sceneKey)
    setActiveScene(sceneKey)
    if (sceneKey === 'ColliderEditorScene') setEditorPanelOpen(true)
  }

  const getEditorBuilder = () => {
    const game = gameRef.current
    if (!game) return null
    return game.scene.getScene('ColliderEditorScene')?.builder ?? null
  }

  const exportDocument = () => ({
    version: 1,
    coordinateSpace: 'phaser-world',
    mapSize: { width: 1400, height: 700 },
    conventions: {
      rectangle: 'x/y are center coordinates; width/height are unrotated dimensions',
      rectangleTopLeft: 'x - width/2, y - height/2 before rotation',
      rotation: 'degrees clockwise on the screen',
      circle: 'x/y are center coordinates',
      polygon: 'vertices are Phaser world coordinates',
    },
    shapes: editorState.shapes,
  })

  const createExportText = () => {
    const text = JSON.stringify(exportDocument(), null, 2)
    setExportText(text)
    setEditorMessage(`Ready to export ${editorState.shapes.length} shape(s).`)
    return text
  }

  const copyExport = async () => {
    const text = createExportText()
    try {
      await navigator.clipboard.writeText(text)
      setEditorMessage('Shape JSON copied to clipboard.')
    } catch {
      const textarea = document.querySelector('.editor-json-output')
      textarea?.focus()
      textarea?.select()
      const copied = document.execCommand('copy')
      setEditorMessage(copied ? 'Shape JSON copied.' : 'Clipboard unavailable. Select and copy the JSON below.')
    }
  }

  const downloadExport = () => {
    const text = createExportText()
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'eco-detective-colliders.json'
    link.click()
    URL.revokeObjectURL(url)
    setEditorMessage('Collider JSON downloaded.')
  }

  const loadExport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const documentData = JSON.parse(await file.text())
      const shapes = validateShapeDocument(documentData)
      const builder = getEditorBuilder()
      if (!builder) throw new Error('Open the Collider Editor before loading a file.')
      builder.replaceShapes(shapes)
      setEditorMessage(`Loaded ${shapes.length} shape(s) from ${file.name}.`)
      setExportText('')
    } catch (error) {
      setEditorMessage(`Could not load JSON: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const setEditorTool = (tool) => getEditorBuilder()?.setTool(tool)
  const selectedShape = editorState.shapes.find((shape) => shape.id === editorState.selectedId)
  const displayShape = selectedShape ?? editorState.preview
  const setSelectedTool = (tool) => setEditorTool(tool)
  const clearAllShapes = () => {
    if (window.confirm('Clear all editor shapes? This does not change gameplay colliders.')) {
      getEditorBuilder()?.clearAll()
      setExportText('')
      setEditorMessage('All editor shapes cleared.')
    }
  }

  const topLeftX = displayShape?.type === 'rectangle' ? displayShape.x - displayShape.width / 2 : null
  const topLeftY = displayShape?.type === 'rectangle' ? displayShape.y - displayShape.height / 2 : null

  return (
   <div className="game-layout">
      <aside className="toolbox-panel">
        <h3>Toolbox</h3>
        <ul>
          <li>Broom</li>
          <li>Gloves</li>
          <li>Bucket</li>
        </ul>
      </aside>

      <div className="scene-switcher">
        <button type="button" onClick={() => switchScene('BootScene')}>Boot</button>
        <button type="button" onClick={() => switchScene('StormScene')}>Storm</button>
        <button type="button" onClick={() => switchScene('ColliderEditorScene')}>Collider Editor</button>
      </div>

      <div className="game-stage">
        <div id="game-container" />
      </div>

      <div className="groot-panel">
        <div className="groot-header">Mr. Groot</div>
        <p>Let’s keep the home clean and safe.</p>
      </div>

      {activeScene === 'ColliderEditorScene' && editorPanelOpen && (
        <aside className="collider-editor-panel">
          <header className="editor-panel-header">
            <div>
              <h2>Collision Shape Builder</h2>
              <p>Shapes stay in this editor until you export them.</p>
            </div>
            <button className="editor-panel-toggle" type="button" onClick={() => setEditorPanelOpen(false)} aria-label="Hide editor panel" title="Hide editor panel">Hide</button>
          </header>

          <div className="editor-tool-grid" aria-label="Shape tools">
            {[
              ['select', 'Select / Edit'],
              ['rectangle', 'Rectangle'],
              ['circle', 'Circle'],
              ['polygon', 'Polygon'],
            ].map(([tool, label]) => (
              <button
                className={editorState.tool === tool ? 'editor-tool active' : 'editor-tool'}
                key={tool}
                type="button"
                onClick={() => setSelectedTool(tool)}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="editor-instructions">
            {editorState.tool === 'select' && 'Click a shape to select it. Drag to move; use its handles to resize or rotate.'}
            {editorState.tool === 'rectangle' && 'Drag on the map to draw a rectangle.'}
            {editorState.tool === 'circle' && 'Click a center point and drag outward to set the radius.'}
            {editorState.tool === 'polygon' && 'Click to add vertices, then press Enter or Finish Polygon.'}
          </p>

          <div className="editor-action-row">
            <button type="button" onClick={() => getEditorBuilder()?.finishPolygon()} disabled={editorState.tool !== 'polygon'}>Finish Polygon</button>
            <button type="button" onClick={() => getEditorBuilder()?.cancelDrawing()}>Cancel Drawing</button>
          </div>

          <section className="editor-properties">
            <h3>{selectedShape ? `Selected: ${selectedShape.type}` : displayShape ? `Preview: ${displayShape.type}` : 'Shape Properties'}</h3>
            {displayShape ? (
              <dl>
                {selectedShape && <><dt>ID</dt><dd>{selectedShape.id}</dd></>}
                {displayShape.type === 'rectangle' && <>
                  <dt>Center X</dt><dd>{displayShape.x.toFixed(1)}</dd>
                  <dt>Center Y</dt><dd>{displayShape.y.toFixed(1)}</dd>
                  <dt>Top-left X (unrotated)</dt><dd>{topLeftX.toFixed(1)}</dd>
                  <dt>Top-left Y (unrotated)</dt><dd>{topLeftY.toFixed(1)}</dd>
                  <dt>Width</dt><dd>{displayShape.width.toFixed(1)}</dd>
                  <dt>Height</dt><dd>{displayShape.height.toFixed(1)}</dd>
                  <dt>Rotation</dt><dd>{(displayShape.rotation ?? 0).toFixed(1)}° clockwise</dd>
                </>}
                {displayShape.type === 'circle' && <>
                  <dt>Center X</dt><dd>{displayShape.x.toFixed(1)}</dd>
                  <dt>Center Y</dt><dd>{displayShape.y.toFixed(1)}</dd>
                  <dt>Radius</dt><dd>{displayShape.radius.toFixed(1)}</dd>
                </>}
                {displayShape.type === 'polygon' && <>
                  <dt>Vertices</dt><dd>{displayShape.points.length}</dd>
                  <div className="editor-vertices">
                    {displayShape.points.map((point, index) => (
                      <div key={`${selectedShape?.id ?? 'preview'}-${index}`}>V{index + 1}: ({point.x.toFixed(1)}, {point.y.toFixed(1)})</div>
                    ))}
                  </div>
                </>}
              </dl>
            ) : <p className="muted">Select a shape to inspect its world coordinates.</p>}
          </section>

          <div className="editor-action-row">
            <button type="button" onClick={() => getEditorBuilder()?.deleteSelected()} disabled={!selectedShape}>Delete Selected</button>
            <button type="button" onClick={clearAllShapes}>Clear All</button>
          </div>

          <div className="editor-action-row editor-export-row">
            <button type="button" onClick={createExportText}>Export Shapes</button>
            <button type="button" onClick={copyExport}>Copy JSON</button>
            <button type="button" onClick={downloadExport}>Save JSON</button>
            <button type="button" onClick={() => loadFileRef.current?.click()}>Load JSON</button>
            <input ref={loadFileRef} type="file" accept=".json,application/json" onChange={loadExport} hidden />
          </div>

          {editorMessage && <p className="editor-message" role="status">{editorMessage}</p>}
          {exportText && <textarea className="editor-json-output" value={exportText} readOnly aria-label="Exported collider JSON" />}
        </aside>
      )}

      {activeScene === 'ColliderEditorScene' && !editorPanelOpen && (
        <button className="editor-panel-reopen" type="button" onClick={() => setEditorPanelOpen(true)}>Show Editor</button>
      )}
    </div>
  )
}

export default App
