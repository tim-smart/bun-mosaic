/// <reference lib="DOM" />

import { RxRef, useRxRef, useRxSuspenseSuccess } from "@effect-rx/rx-react"
import "./App.css"
import { gridRx } from "./services/Grid"
import { Suspense } from "react"

const bunUrl = new URL(location.href)
bunUrl.port = "3000"

const nodeUrl = new URL(location.href)
nodeUrl.port = "3001"

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
  return <Grid label="Bun" cells={useRxSuspenseSuccess(gridRx(bunUrl)).value} />
}

function NodeGrid() {
  return (
    <Grid label="Node.js" cells={useRxSuspenseSuccess(gridRx(nodeUrl)).value} />
  )
}

function Grid({
  label,
  cells,
}: {
  readonly label: string
  readonly cells: Array<Array<RxRef.RxRef<string | undefined>>>
}) {
  return (
    <div className="grid">
      <h3 className="grid-label">{label}</h3>
      <div className="grid-content">
        {cells.map((row, y) =>
          row.map((src, x) => <GridCell key={`${x}-${y}`} src={src} />),
        )}
      </div>
    </div>
  )
}

function GridCell({ src }: { readonly src: RxRef.RxRef<string | undefined> }) {
  const url = useRxRef(src)
  return url ? (
    <img className="grid-cell" src={url} alt="" />
  ) : (
    <div className="grid-cell" />
  )
}

export default App
