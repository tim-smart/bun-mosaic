import { ImageWorker } from "@app/image/Worker/schema"
import { FileSystem, Path } from "@effect/platform"
import { Schema } from "@effect/schema"
import { Context, Effect, Layer, Stream } from "effect"
import * as OS from "node:os"

const make = (directory: string) =>
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem.FileSystem)
    const path = yield* _(Path.Path)
    const worker = yield* _(ImageWorker)

    yield* _(Effect.log("loading images"))
    const images = (yield* _(fs.readDirectory(directory)))
      .filter(_ => /\.(jpg|jpeg|png|webp)$/.test(_))
      .map(_ => path.join(directory, _))

    yield* _(Effect.log("calculating colors"))
    const colors = yield* _(
      Effect.forEach(
        images,
        image =>
          worker
            .getColor(image)
            .pipe(Effect.zipLeft(Effect.sync(() => process.stdout.write(".")))),
        { concurrency: "unbounded" },
      ),
    )

    yield* _(Effect.log("sources ready"))

    const getClosestGrid = ({
      path,
      columns,
    }: {
      readonly path: string
      readonly columns: number
    }) =>
      Stream.range(0, columns - 1).pipe(
        Stream.mapEffect(
          shard =>
            worker.getTiles({
              sources: colors,
              path,
              columns,
              shard,
              totalShards: columns,
            }),
          { concurrency: OS.cpus().length },
        ),
        Stream.flatMap(Stream.fromChunk),
        Stream.map(
          tile =>
            new ImageTile({
              path: images[tile.index],
              x: tile.x,
              y: tile.y,
            }),
        ),
      )

    return { getClosestGrid } as const
  }).pipe(
    Effect.withLogSpan("Sources.make"),
    Effect.annotateLogs("directory", directory),
    Effect.annotateSpans("directory", directory),
  )

export interface Sources {
  readonly _: unique symbol
}
export const Sources = Context.Tag<
  Sources,
  Effect.Effect.Success<ReturnType<typeof make>>
>("@app/image/Sources")

export const SourcesLive = (directory: string) =>
  Layer.effect(Sources, make(directory))

export class ImageTile extends Schema.Class<ImageTile>()({
  path: Schema.string,
  x: Schema.number,
  y: Schema.number,
}) {}
