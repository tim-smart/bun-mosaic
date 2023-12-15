import { Distance, DistanceLive, DistanceSources } from "@app/image/Distance"
import * as Runner from "@effect/platform/WorkerRunner"
import { Effect, Layer, Scope, Stream } from "effect"
import { Colors, ColorsLive, RGB } from "../Colors.ts"
import { Request } from "./schema.ts"

export const RunnerLive = Effect.gen(function* (_) {
  let sources: ReadonlyArray<RGB> = []
  const colors = yield* _(Colors)
  const distance = yield* _(Distance)

  yield* _(
    Runner.makeSerialized(Request, {
      SetSources: req =>
        Effect.sync(() => {
          sources = req.sources
        }),
      GetColor: ({ path }) => colors.color(path),
      GetTiles: req =>
        distance
          .getClosestGrid(req)
          .pipe(Stream.provideService(DistanceSources, sources)),
    }),
  )
  yield* _(Effect.log("runner live"))
  yield* _(Effect.addFinalizer(() => Effect.log("runner closed")))
}).pipe(
  Layer.scopedDiscard,
  Layer.provide(DistanceLive),
  Layer.provide(ColorsLive),
)
