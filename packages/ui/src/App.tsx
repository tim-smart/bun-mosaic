import { RxRef, useRxRef, useRxSuspenseSuccess } from "@effect-rx/rx-react"
import "./App.css"
import { ImageTile, gridRx } from "./services/Grid"

function App() {
  return <Grid />
}

function Grid() {
  const { value: grid } = useRxSuspenseSuccess(gridRx)

  return (
    <div className="grid">
      {grid.map((row, y) =>
        row.map((tile, x) => <GridCell key={`${x}-${y}`} tile={tile} />),
      )}
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
      <div className="grid-cell">
        {imageTile && <img src={`http://localhost:3000${imageTile.path}`} />}
      </div>
    </>
  )
}

export default App
