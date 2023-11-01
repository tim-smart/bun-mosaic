import * as Worker from "@app/image/Worker/schema"
import { concurrency } from "@app/image/utils"
import { FileSystem, Path } from "@effect/platform"
import { Schema } from "@effect/schema"
import { Context, Effect, Layer, Stream } from "effect"

const make = (directory: string) =>
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem.FileSystem)
    const path = yield* _(Path.Path)

    yield* _(Effect.log("loading images"))
    const images = (yield* _(fs.readDirectory(directory)))
      .filter(_ => /\.(jpg|jpeg|png|webp)$/.test(_))
      .map(_ => path.join(directory, _))

    yield* _(Effect.log("calculating colors"))
    const colors = yield* _(
      Effect.gen(function* (_) {
        const worker = yield* _(Worker.client([], 10))
        return yield* _(
          Effect.forEach(
            images,
            image =>
              worker
                .getColor(image)
                .pipe(
                  Effect.zipLeft(Effect.sync(() => process.stdout.write("."))),
                ),
            { concurrency: "unbounded" },
          ),
        )
      }).pipe(Effect.scoped),
    )

    yield* _(Effect.log("sources ready"))

    const worker = yield* _(Worker.client(colors, 2))

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
              path,
              columns,
              shard,
              totalShards: columns,
            }),
          { concurrency },
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

export interface ImageDirectory {
  readonly _: unique symbol
}
export const ImageDirectory = Context.Tag<ImageDirectory, string>(
  "@app/image/ImageDirectory",
)

export interface Sources {
  readonly _: unique symbol
}
export const Sources = Context.Tag<
  Sources,
  Effect.Effect.Success<ReturnType<typeof make>>
>("@app/image/Sources")

export const SourcesLive = ImageDirectory.pipe(
  Effect.flatMap(make),
  Layer.scoped(Sources),
)

export class ImageTile extends Schema.Class<ImageTile>()({
  path: Schema.string,
  x: Schema.number,
  y: Schema.number,
}) {}
