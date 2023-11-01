import { ColorError, RGB } from "../Colors.ts"
import * as RS from "@effect/rpc-workers/Schema"
import * as Client from "@effect/rpc-workers/Client"
import * as Resolver from "@effect/rpc-workers/Resolver"
import { Schema } from "@effect/schema"
import { Context, Effect, Layer } from "effect"
import { concurrency } from "@app/image/utils"
import { IndexTile } from "@app/image/Distance"

export const schema = RS.make({
  __setup: {
    input: Schema.struct({
      sources: Schema.array(RGB),
    }),
  },
  getColor: {
    input: Schema.string,
    output: RGB,
  },
  getTiles: {
    input: Schema.struct({
      path: Schema.string,
      columns: Schema.number,
      shard: Schema.number,
      totalShards: Schema.number,
    }),
    error: ColorError,
    output: Schema.chunk(IndexTile),
  },
})

export interface ImageWorker {
  readonly _: unique symbol
}

export const client = (sources: ReadonlyArray<RGB>, permits = 3) =>
  Effect.gen(function* (_) {
    const spawn = yield* _(ImageWorker)
    const pool = yield* _(
      Resolver.makePool({
        spawn,
        size: concurrency,
        permits,
      }),
    )
    return yield* _(Client.makeFromPool(schema, pool, { sources }))
  })

export const ImageWorker = Context.Tag<ImageWorker, () => unknown>(
  "@app/image/Worker",
)

export const ImageWorkerLive = (spawn: () => unknown) =>
  Layer.succeed(ImageWorker, spawn)
