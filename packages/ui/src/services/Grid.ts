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

const make = Effect.gen(function* (_) {
  const client = Http.client
    .fetchOk()
    .pipe(
      Http.client.mapRequest(Http.request.prependUrl("http://localhost:3000")),
    )

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
export const Grid = Context.Tag<Grid, Effect.Effect.Success<typeof make>>(
  "@app/ui/Grid",
)
export const GridLive = Layer.scoped(Grid, make)

// rx

const runtimeRx = Rx.runtime(GridLive)

export const gridRx = Rx.stream(
  () =>
    Grid.pipe(
      Effect.map(_ => _.changes),
      Stream.unwrap,
    ),
  { runtime: runtimeRx },
)
