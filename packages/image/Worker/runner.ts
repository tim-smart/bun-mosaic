import { Distance, DistanceLive, DistanceSources } from "@app/image/Distance"
import * as Runner from "@effect/platform/WorkerRunner"
import { Effect, Layer, Stream } from "effect"
import { Colors, ColorsLive } from "../Colors.ts"
import { Request } from "./schema.ts"

export const RunnerLive = Effect.gen(function* (_) {
  const colors = yield* _(Colors)

  yield* _(
    Runner.makeSerialized(Request, {
      SetSources: req =>
        DistanceLive.pipe(
          Layer.provide(Layer.succeed(DistanceSources, req.sources)),
        ),
      GetColor: ({ path }) => colors.color(path),
      GetTiles: req =>
        Distance.pipe(Stream.flatMap(_ => _.getClosestGrid(req))),
    }),
  )
  yield* _(Effect.log("runner live"))
  yield* _(Effect.addFinalizer(() => Effect.log("runner closed")))
}).pipe(Layer.scopedDiscard, Layer.provide(ColorsLive))
