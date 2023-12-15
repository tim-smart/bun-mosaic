import { ColorError, RGB } from "../Colors.ts"
import { Schema } from "@effect/schema"
import { Context, Effect, Layer } from "effect"
import { concurrency } from "@app/image/utils"
import { IndexTile } from "@app/image/Distance"
import * as Worker from "@effect/platform/Worker"

export class SetSources extends Schema.TaggedRequest<SetSources>()(
  "SetSources",
  Schema.never,
  Schema.void,
  { sources: Schema.array(RGB) },
) {}

export class GetColor extends Schema.TaggedRequest<GetColor>()(
  "GetColor",
  Schema.never,
  RGB,
  { path: Schema.string },
) {}

export class GetTiles extends Schema.TaggedRequest<GetTiles>()(
  "GetTiles",
  ColorError,
  IndexTile,
  {
    path: Schema.string,
    columns: Schema.number,
    shard: Schema.number,
    totalShards: Schema.number,
  },
) {}

export const Request = Schema.union(SetSources, GetColor, GetTiles)
export type Request = Schema.Schema.To<typeof Request>

export interface ImageWorker {
  readonly _: unique symbol
}

export const pool = (sources: ReadonlyArray<RGB>, permits: number) =>
  Effect.gen(function* (_) {
    const spawn = yield* _(ImageWorker)
    return yield* _(
      Worker.makePoolSerialized<unknown>()<Request>({
        spawn,
        size: concurrency,
        permits,
        initialMessage: () => new SetSources({ sources }),
      }),
    )
  })

export const ImageWorker = Context.Tag<ImageWorker, () => unknown>(
  "@app/image/Worker",
)

export const ImageWorkerLive = (spawn: () => unknown) =>
  Layer.succeed(ImageWorker, spawn)
