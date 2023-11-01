import { ImageDirectory } from "@app/image/Sources"
import { ImageWorkerLive } from "@app/image/Worker/schema"
import { WatchDirectory } from "@app/watcher/Watcher"
import * as Http from "@effect/platform-node/HttpServer"
import * as NodeContext from "@effect/platform-node/NodeContext"
import { runMain } from "@effect/platform-node/Runtime"
import * as Worker from "@effect/platform-node/Worker"
import { Effect, Layer } from "effect"
import { createServer } from "node:http"
import * as WT from "node:worker_threads"
import { HttpLive } from "@app/http/Http"

const Server = Http.server.layer(createServer, {
  host: "0.0.0.0",
  port: 3001,
})

const WorkerLive = ImageWorkerLive(
  () =>
    new WT.Worker(new URL("../image/Worker/server.node.ts", import.meta.url)),
).pipe(Layer.use(Worker.layerManager))

const MainLive = HttpLive.pipe(
  Layer.use(Server),
  Layer.use(WorkerLive),
  Layer.use(NodeContext.layer),
  Layer.use(Layer.succeed(ImageDirectory, process.argv[2])),
  Layer.use(Layer.succeed(WatchDirectory, process.argv[3])),
)

Effect.log("listening on http://localhost:3001").pipe(
  Effect.zipRight(Layer.launch(MainLive)),
  Effect.tapErrorCause(Effect.logError),
  runMain,
)
