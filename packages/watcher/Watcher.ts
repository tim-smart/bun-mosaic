import * as Fs from "node:fs"
import {
  Chunk,
  Context,
  Effect,
  Layer,
  PubSub,
  Schedule,
  Scope,
  Stream,
} from "effect"
import { ImageTile, Sources, SourcesLive } from "@app/image/Sources"
import { FileSystem, Path } from "@effect/platform"

const make = (directory: string) =>
  Effect.gen(function* (_) {
    const hub = yield* _(PubSub.unbounded<Chunk.Chunk<ImageTile>>())
    const sources = yield* _(Sources)
    const fs = yield* _(FileSystem.FileSystem)
    const path = yield* _(Path.Path)

    const tileStream = Stream.asyncScoped<Scope.Scope, never, string>(emit =>
      Effect.acquireRelease(
        Effect.sync(() =>
          Fs.watch(directory, { recursive: false }, (event, filename) => {
            if (event === "rename") {
              emit.single(filename as string)
            }
          }),
        ),
        watcher => Effect.sync(() => watcher.close()),
      ),
    ).pipe(
      Stream.map(_ => path.join(directory, _)),
      Stream.filterEffect(fs.exists),
      Stream.filter(_ => /\.(jpg|jpeg|png)$/.test(_)),
      Stream.tap(() => {
        const now = Date.now()
        const nextSecond = (Math.ceil(now / 1000) + 1) * 1000
        const delay = nextSecond - now
        return Effect.sleep(delay)
      }),
      Stream.tap(_ =>
        Effect.log("watcher processing").pipe(Effect.annotateLogs("image", _)),
      ),
      Stream.flatMap(
        path =>
          sources.getClosestGrid({
            path,
            columns: 100,
          }),
        { switch: true },
      ),
      Stream.chunks,
      Stream.tap(_ => PubSub.publish(hub, _)),
    )

    yield* _(Stream.runDrain(tileStream), Effect.forkScoped)

    const stream = Stream.fromChunkPubSub(hub)

    return { stream } as const
  })

export interface WatchDirectory {
  readonly _: unique symbol
}
export const WatchDirectory = Context.Tag<WatchDirectory, string>(
  "@app/watcher/WatchDirectory",
)

export interface Watcher {
  readonly _: unique symbol
}
export const Watcher = Context.Tag<
  Watcher,
  Effect.Effect.Success<ReturnType<typeof make>>
>("@app/watcher/Watcher")

export const WatcherLive = WatchDirectory.pipe(
  Effect.flatMap(make),
  Layer.scoped(Watcher),
).pipe(Layer.use(SourcesLive))
