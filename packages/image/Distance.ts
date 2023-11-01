import {
  Context,
  Effect,
  Layer,
  Order,
  ReadonlyArray,
  Stream,
  flow,
} from "effect"
import { Schema } from "@effect/schema"
import { Colors, RGB } from "@app/image/Colors"

const make = (sources: ReadonlyArray<RGB>) =>
  Effect.gen(function* (_) {
    const colors = yield* _(Colors)

    const closest = (target: RGB, index = 0) => {
      const order = Order.make((a: RGB, b: RGB) => {
        const distanceA = a.distance(target)
        const distanceB = b.distance(target)
        return distanceA < distanceB ? -1 : distanceA > distanceB ? 1 : 0
      })
      const item = ReadonlyArray.sort(sources, order)[index]
      return sources.indexOf(item)
    }

    const getClosestGrid = (options: {
      readonly path: string
      readonly columns: number
      readonly shard?: number
      readonly totalShards?: number
    }) =>
      Stream.suspend(() => {
        let count = 0
        return colors.colorGrid(options).pipe(
          Stream.map(
            target =>
              new IndexTile({
                index: closest(target.rgb, count++ % 20),
                x: target.x,
                y: target.y,
              }),
          ),
        )
      })

    return { getClosestGrid } as const
  })

export interface Distance {
  readonly _: unique symbol
}
export const Distance = Context.Tag<
  Distance,
  Effect.Effect.Success<ReturnType<typeof make>>
>("@app/image/Distance")
export const DistanceLive = flow(make, Layer.effect(Distance))

export class IndexTile extends Schema.Class<IndexTile>()({
  index: Schema.Int,
  x: Schema.Int,
  y: Schema.Int,
}) {}
