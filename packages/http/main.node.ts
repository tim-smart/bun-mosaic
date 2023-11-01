import * as Http from "@effect/platform-node/HttpServer"
import { runMain } from "@effect/platform-node/Runtime"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as Worker from "@effect/platform-node/Worker"
import { Effect, Layer } from "effect"
import { ImageDirectory, app } from "./Http.ts"
import { ImageWorkerLive } from "@app/image/Worker/schema"
import { SourcesLive } from "@app/image/Sources"
import { WatcherLive } from "@app/watcher/Watcher"
import * as WT from "node:worker_threads"
import { createServer } from "node:http"

const Server = Http.server.layer(createServer, {
  port: 3001,
})

const WorkerLive = ImageWorkerLive(
  () =>
    new WT.Worker(new URL("../image/Worker/server.node.ts", import.meta.url)),
).pipe(Layer.use(Worker.layerManager))

const Sources = SourcesLive(process.argv[2]).pipe(
  Layer.use(WorkerLive),
  Layer.use(NodeContext.layer),
)

const Watcher = WatcherLive(process.argv[3]).pipe(
  Layer.use(Sources),
  Layer.use(NodeContext.layer),
)

const MainLive = Layer.mergeAll(Server, NodeContext.layer, Sources, Watcher)

Effect.log("listening on http://localhost:3001").pipe(
  Effect.zipRight(Http.server.serve(app, Http.middleware.logger)),
  Effect.scoped,
  Effect.provideService(ImageDirectory, process.argv[2]),
  Effect.provide(MainLive),
  Effect.tapErrorCause(Effect.logError),
  runMain,
)
