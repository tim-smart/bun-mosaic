import { Distance, DistanceLive } from "@app/image/Distance"
import { Colors, ColorsLive } from "../Colors.ts"
import { schema } from "./schema.ts"
import * as Router from "@effect/rpc-workers/Router"
import { Effect, Layer, Stream } from "effect"

export const router = Router.make(schema, {
  __setup: ({ sources }) =>
    DistanceLive(sources).pipe(Layer.useMerge(ColorsLive)),
  getColor: path => Effect.flatMap(Colors, _ => _.color(path)),
  getTiles: options =>
    Effect.flatMap(Distance, _ =>
      _.getClosestGrid(options).pipe(Stream.runCollect),
    ),
})
