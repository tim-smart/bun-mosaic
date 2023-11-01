import * as Sources from "@app/image/Sources"
import { Watcher, WatcherLive } from "@app/watcher/Watcher"
import { Path } from "@effect/platform"
import * as Server from "@effect/platform/Http/Server"
import * as Http from "@effect/platform/HttpServer"
import { Schema } from "@effect/schema"
import { Effect, Layer, Stream } from "effect"

const encodeTile = Schema.compose(Schema.ParseJson, Sources.ImageTile).pipe(
  Schema.encode,
)

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

const imageParams = Http.router.schemaParams(
  Schema.struct({
    image: Schema.string,
  }),
)

const serveImage = Effect.gen(function* (_) {
  const path = yield* _(Path.Path)
  const directory = yield* _(Sources.ImageDirectory)
  const { image } = yield* _(imageParams)
  return yield* _(Http.response.file(path.join(directory, image)))
}).pipe(Http.middleware.withLoggerDisabled)

const serve = Http.router.empty.pipe(
  Http.router.get("/ping", Effect.succeed(Http.response.text("pong"))),
  Http.router.get("/stream", streamHandler),
  Http.router.get("/image/:image", serveImage),

  Effect.catchTag("RouteNotFound", _ =>
    Effect.succeed(Http.response.empty({ status: 404 })),
  ),

  Effect.map(Http.response.setHeader("Access-Control-Allow-Origin", "*")),

  Server.serve(Http.middleware.logger),
)

export const HttpLive = Layer.scopedDiscard(serve).pipe(Layer.use(WatcherLive))
