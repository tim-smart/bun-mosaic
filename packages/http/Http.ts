import * as Sources from "@app/image/Sources"
import { Watcher, WatcherLive } from "@app/watcher/Watcher"
import * as Server from "@effect/platform/Http/Server"
import * as Http from "@effect/platform/HttpServer"
import * as Path from "@effect/platform/Path"
import { Schema } from "@effect/schema"
import { Effect, Layer, Stream } from "effect"

const encodeTile = Schema.compose(
  Schema.ParseJson,
  Schema.chunk(Sources.ImageTile),
).pipe(Schema.encode)

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
      Stream.chunks,
      Stream.mapEffect(encodeTile),
      Stream.map(_ => _ + "\r\n"),
      Stream.encodeText,
    ),
  )
})

const imageParams = Http.router.schemaParams(
  Schema.struct({
    image: Schema.string,
  }),
)

const serveImage = Effect.flatMap(
  Effect.zip(imageParams, Sources.ImageDirectory),
  ([{ image }, directory]) => Http.response.file(`${directory}/${image}`),
)

export const HttpLive = Http.router.empty.pipe(
  Http.router.get("/ping", Effect.succeed(Http.response.text("pong"))),
  Http.router.get("/stream", streamHandler),
  Http.router.get("/image/:image", serveImage),

  Effect.catchTag("RouteNotFound", _ =>
    Effect.succeed(Http.response.empty({ status: 404 })),
  ),

  Effect.map(Http.response.setHeader("Access-Control-Allow-Origin", "*")),

  Server.serve(),
  Layer.provide(WatcherLive)
)
