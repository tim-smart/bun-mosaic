import {
  Context,
  Effect,
  Layer,
  ReadonlyArray,
  Stream,
  SubscriptionRef,
} from "effect"
import * as Http from "@effect/platform-browser/HttpClient"
import * as Schema from "@effect/schema/Schema"
import { Rx, RxRef } from "@effect-rx/rx-react"

export class ImageTile extends Schema.Class<ImageTile>()({
  path: Schema.string,
  x: Schema.number,
  y: Schema.number,
}) {}

const parseTile = Schema.compose(Schema.ParseJson, ImageTile).pipe(
  Schema.decode,
)

const make = (url: string) =>
  Effect.gen(function* (_) {
    const client = Http.client
      .fetchOk()
      .pipe(Http.client.mapRequest(Http.request.prependUrl(url)))

    const grid = yield* _(
      SubscriptionRef.make<
        ReadonlyArray<ReadonlyArray<RxRef.RxRef<ImageTile | undefined>>>
      >(
        ReadonlyArray.range(0, 100).map(() =>
          Array.from({ length: 100 }, () =>
            RxRef.make<undefined | ImageTile>(undefined),
          ),
        ),
      ),
    )

    const stream = Http.request.get("/stream").pipe(
      client,
      Effect.map(r => r.stream),
      Stream.unwrap,
      Stream.decodeText(),
      Stream.splitLines,
      Stream.mapEffect(parseTile),
      Stream.map(
        tile =>
          new ImageTile({
            path: `${url}${tile.path}`,
            x: tile.x,
            y: tile.y,
          }),
      ),
      Stream.tap(tile =>
        SubscriptionRef.update(grid, tiles => {
          tiles[tile.y]?.[tile.x]?.set(tile)
          return tiles
        }),
      ),
    )

    yield* _(Stream.runDrain(stream), Effect.forkScoped)

    return { changes: grid.changes } as const
  })

export interface Grid {
  readonly _: unique symbol
}
export const Grid = Context.Tag<
  Grid,
  Effect.Effect.Success<ReturnType<typeof make>>
>("@app/ui/Grid")
const BunGrid = Layer.scoped(Grid, make("http://localhost:3000"))
const NodeGrid = Layer.scoped(Grid, make("http://localhost:3001"))

// rx

const bunRuntime = Rx.runtime(BunGrid)
const nodeRuntime = Rx.runtime(NodeGrid)

export const bunGridRx = Rx.stream(
  () =>
    Grid.pipe(
      Effect.map(_ => _.changes),
      Stream.unwrap,
    ),
  { runtime: bunRuntime },
)

export const nodeGridRx = Rx.stream(
  () =>
    Grid.pipe(
      Effect.map(_ => _.changes),
      Stream.unwrap,
    ),
  { runtime: nodeRuntime },
)
