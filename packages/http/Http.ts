import { Context, Effect, Stream } from "effect"
import * as Http from "@effect/platform/HttpServer"
import { Schema } from "@effect/schema"
import * as Sources from "@app/image/Sources"
import * as OS from "node:os"
import { Path } from "@effect/platform"
import { Watcher } from "@app/watcher/Watcher"

const encodeTile = Schema.compose(Schema.ParseJson, Sources.ImageTile).pipe(
  Schema.encode,
)

const uploadHandler = Effect.gen(function* (_) {
  const path = yield* _(Path.Path)
  const sources = yield* _(Sources.Sources)
  const image = (yield* _(
    Http.request.schemaFormData(
      Schema.struct({
        image: Http.formData.filesSchema.pipe(Schema.itemsCount(1)),
      }),
    ),
  )).image[0]

  return Http.response.stream(
    sources
      .getClosestGrid({
        path: image.name,
        columns: 100,
      })
      .pipe(
        Stream.map(
          tile =>
            new Sources.ImageTile({
              path: "/image/" + path.basename(tile.path),
              x: tile.x,
              y: tile.y,
            }),
        ),
        Stream.mapEffect(encodeTile),
        Stream.intersperse("\r\n"),
        Stream.encodeText,
      ),
  )
})

const streamHandler = Effect.gen(function* (_) {
  const watcher = yield* _(Watcher)
  const path = yield* _(Path.Path)

  return Http.response.stream(
    watcher.stream.pipe(
      Stream.map(
        tile =>
          new Sources.ImageTile({
            path: "/image/" + path.basename(tile.path),
            x: tile.x,
            y: tile.y,
          }),
      ),
      Stream.mapEffect(encodeTile),
      Stream.intersperse("\r\n"),
      Stream.encodeText,
    ),
  )
})

export interface ImageDirectory {
  readonly _: unique symbol
}
export const ImageDirectory = Context.Tag<ImageDirectory, string>(
  "@app/http/ImageDirectory",
)

const imageParams = Http.router.schemaParams(
  Schema.struct({
    image: Schema.string,
  }),
)

const serveImage = Effect.gen(function* (_) {
  const path = yield* _(Path.Path)
  const directory = yield* _(ImageDirectory)
  const { image } = yield* _(imageParams)
  return yield* _(Http.response.file(path.join(directory, image)))
}).pipe(Http.middleware.withLoggerDisabled)

export const app = Http.router.empty.pipe(
  Http.router.get("/ping", Effect.succeed(Http.response.text("pong"))),
  Http.router.post("/", uploadHandler),
  Http.router.get("/stream", streamHandler),
  Http.router.get("/image/:image", serveImage),

  Effect.catchTag("RouteNotFound", _ =>
    Effect.succeed(Http.response.empty({ status: 404 })),
  ),

  Effect.map(Http.response.setHeader("Access-Control-Allow-Origin", "*")),
)
