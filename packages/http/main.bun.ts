import * as Http from "@effect/platform-bun/HttpServer"
import { runMain } from "@effect/platform-bun/Runtime"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as Worker from "@effect/platform-bun/Worker"
import { Effect, Layer } from "effect"
import { ImageDirectory, app } from "./Http.ts"
import { ImageWorkerLive } from "@app/image/Worker/schema"
import { SourcesLive } from "@app/image/Sources"
import { WatcherLive } from "@app/watcher/Watcher"

const Server = Http.server.layer({
  port: 3000,
})

const WorkerLive = ImageWorkerLive(
  () =>
    new globalThis.Worker(
      new URL("../image/Worker/server.bun.ts", import.meta.url),
    ),
).pipe(Layer.use(Worker.layerManager))

const Sources = SourcesLive(process.argv[2]).pipe(
  Layer.use(WorkerLive),
  Layer.use(BunContext.layer),
)

const Watcher = WatcherLive(process.argv[3]).pipe(
  Layer.use(Sources),
  Layer.use(BunContext.layer),
)

const MainLive = Layer.mergeAll(Server, BunContext.layer, Sources, Watcher)

Effect.log("listening on http://localhost:3000").pipe(
  Effect.zipRight(Http.server.serve(app, Http.middleware.logger)),
  Effect.scoped,
  Effect.provideService(ImageDirectory, process.argv[2]),
  Effect.provide(MainLive),
  Effect.tapErrorCause(Effect.logError),
  runMain,
)
