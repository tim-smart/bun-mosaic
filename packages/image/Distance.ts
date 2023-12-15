import { Context, Effect, Layer, Order, Stream } from "effect"
import { Schema } from "@effect/schema"
import { Colors, RGB } from "@app/image/Colors"

const make = Effect.gen(function* (_) {
  const colors = yield* _(Colors)

  const closest = (sources: ReadonlyArray<RGB>, target: RGB, index = 0) => {
    const order = Order.make((a: RGB, b: RGB) => {
      const distanceA = a.distance(target)
      const distanceB = b.distance(target)
      return distanceA < distanceB ? -1 : distanceA > distanceB ? 1 : 0
    })
    return sources.indexOf(sources.toSorted(order)[index])
  }

  const getClosestGrid = (options: {
    readonly path: string
    readonly columns: number
    readonly shard?: number
    readonly totalShards?: number
  }) =>
    Stream.flatMap(DistanceSources, sources => {
      let count = 0
      return colors.colorGrid(options).pipe(
        Stream.map(
          target =>
            new IndexTile({
              index: closest(sources, target.rgb, count++ % 20),
              x: target.x,
              y: target.y,
            }),
        ),
      )
    })

  return { getClosestGrid } as const
})

export interface DistanceSources {
  readonly _: unique symbol
}
export const DistanceSources = Context.Tag<DistanceSources, ReadonlyArray<RGB>>(
  "@app/image/DistanceSources",
)

export interface Distance {
  readonly _: unique symbol
}
export const Distance = Context.Tag<
  Distance,
  Effect.Effect.Success<typeof make>
>("@app/image/Distance")
export const DistanceLive = Layer.effect(Distance, make)

export class IndexTile extends Schema.Class<IndexTile>()({
  index: Schema.Int,
  x: Schema.Int,
  y: Schema.Int,
}) {}
