import { IndexTile } from "@app/image/Distance"
import * as Worker from "@app/image/Worker/schema"
import { concurrency } from "@app/image/utils"
import { FileSystem, KeyValueStore, Path } from "@effect/platform"
import { Schema } from "@effect/schema"
import { Chunk, Context, Effect, Layer, Stream } from "effect"
import * as Crypto from "node:crypto"

const make = (directory: string) =>
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem.FileSystem)
    const path = yield* _(Path.Path)
    const cache = yield* _(Cache.tag)

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

    const worker = yield* _(Worker.client(colors, 2))

    yield* _(Effect.log("sources ready"))

    const fileHash = yield* _(
      Effect.cachedFunction((path: string) =>
        Effect.flatMap(fs.readFile(path), buffer =>
          Effect.sync(() =>
            Crypto.createHash("sha1").update(buffer).digest("hex"),
          ),
        ),
      ),
    )

    const cacheKey = (path: string, columns: number, row: number) =>
      Effect.map(fileHash(path), hash => `${hash}-${columns}-${row}`)

    const getTiles = (path: string, columns: number, row: number) =>
      Effect.gen(function* (_) {
        const key = yield* _(cacheKey(path, columns, row))
        const cached = yield* _(cache.get(key))
        if (cached._tag === "Some") {
          return cached.value
        }

        const tiles = yield* _(
          worker.getTiles({ path, columns, shard: row, totalShards: columns }),
          Effect.map(
            Chunk.map(
              tile =>
                new ImageTile({
                  path: images[tile.index],
                  x: tile.x,
                  y: tile.y,
                }),
            ),
          ),
        )
        yield* _(cache.set(key, tiles))
        return tiles
      })

    const getClosestGrid = ({
      path,
      columns,
    }: {
      readonly path: string
      readonly columns: number
    }) =>
      Stream.range(0, columns - 1).pipe(
        Stream.mapEffect(row => getTiles(path, columns, row), { concurrency }),
        Stream.flattenChunks,
      )

    return { getClosestGrid } as const
  }).pipe(
    Effect.withLogSpan("Sources.make"),
    Effect.annotateLogs("directory", directory),
  )

export interface ImageDirectory {
  readonly _: unique symbol
}
export const ImageDirectory = Context.Tag<ImageDirectory, string>(
  "@app/image/ImageDirectory",
)

export class ImageTile extends Schema.Class<ImageTile>()({
  path: Schema.string,
  x: Schema.number,
  y: Schema.number,
}) {}

export const Cache = KeyValueStore.layerSchema(
  Schema.chunk(ImageTile),
  "@app/image/Sources/Cache",
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
  Layer.use(Cache.layer),
)
