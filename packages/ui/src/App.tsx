import { RxRef, useRxRef, useRxSuspenseSuccess } from "@effect-rx/rx-react"
import "./App.css"
import { ImageTile, bunGridRx, nodeGridRx } from "./services/Grid"
import { Suspense } from "react"

function App() {
  return (
    <Suspense>
      <div className="grids">
        <BunGrid />
        <NodeGrid />
      </div>
    </Suspense>
  )
}

function BunGrid() {
  const { value: grid } = useRxSuspenseSuccess(bunGridRx)

  return (
    <div className="grid">
      <h3 className="grid-label">Bun</h3>
      <div className="grid-content">
        {grid.map((row, y) =>
          row.map((tile, x) => <GridCell key={`${x}-${y}`} tile={tile} />),
        )}
      </div>
    </div>
  )
}

function NodeGrid() {
  const { value: grid } = useRxSuspenseSuccess(nodeGridRx)

  return (
    <div className="grid">
      <h3 className="grid-label">Node.js</h3>
      <div className="grid-content">
        {grid.map((row, y) =>
          row.map((tile, x) => <GridCell key={`${x}-${y}`} tile={tile} />),
        )}
      </div>
    </div>
  )
}

function GridCell({
  tile,
}: {
  readonly tile: RxRef.RxRef<ImageTile | undefined>
}) {
  const imageTile = useRxRef(tile)
  return (
    <>
      <div
        className="grid-cell"
        style={{
          backgroundImage: imageTile ? `url(${imageTile.path})` : undefined,
        }}
      ></div>
    </>
  )
}

export default App
