import * as Fs from "node:fs"
import { Context, Effect, Layer, PubSub, Scope, Stream } from "effect"
import { ImageTile, Sources } from "@app/image/Sources"
import { FileSystem, Path } from "@effect/platform"

const make = (directory: string) =>
  Effect.gen(function* (_) {
    const hub = yield* _(PubSub.unbounded<ImageTile>())
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
      Stream.tap(tile => PubSub.publish(hub, tile)),
    )

    yield* _(Stream.runDrain(tileStream), Effect.forkScoped)

    const stream = Stream.fromPubSub(hub)

    return { stream } as const
  })

export interface Watcher {
  readonly _: unique symbol
}
export const Watcher = Context.Tag<
  Watcher,
  Effect.Effect.Success<ReturnType<typeof make>>
>("@app/watcher/Watcher")

export const WatcherLive = (directory: string) =>
  Layer.scoped(Watcher, make(directory))
