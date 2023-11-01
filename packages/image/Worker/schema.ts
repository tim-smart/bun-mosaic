import { ColorError, IndexTile, RGB } from "../Colors.ts"
import * as RS from "@effect/rpc-workers/Schema"
import * as Client from "@effect/rpc-workers/Client"
import * as Resolver from "@effect/rpc-workers/Resolver"
import { Schema } from "@effect/schema"
import { Context, Effect, Layer } from "effect"
import { concurrency } from "@app/image/utils"

export const schema = RS.make({
  getColor: {
    input: Schema.string,
    output: RGB,
  },
  getTiles: {
    input: Schema.struct({
      sources: Schema.array(RGB),
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

const client = (spawn: () => unknown) =>
  Effect.gen(function* (_) {
    const pool = yield* _(
      Resolver.makePool({
        spawn,
        size: concurrency,
        permits: 3,
      }),
    )
    return Client.makeFromPool(schema, pool)
  })

export const ImageWorker = Context.Tag<
  ImageWorker,
  Effect.Effect.Success<ReturnType<typeof client>>
>("@app/image/Worker")

export const ImageWorkerLive = (spawn: () => unknown) =>
  Layer.scoped(ImageWorker, client(spawn))
